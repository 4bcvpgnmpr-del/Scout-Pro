import { Router } from "express";
import bcrypt from "bcrypt";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, teamsTable, leagues, syncTeams } from "@workspace/db";

const router = Router();

const SALT_ROUNDS = 10;

function safeUser(u: typeof usersTable.$inferSelect) {
  return {
    id:                      u.id,
    email:                   u.email,
    name:                    u.name,
    role:                    u.role,
    subscriptionTier:        u.subscriptionTier,
    selectedTeamId:          u.selectedTeamId,
    selectedLeagueShortName: u.selectedLeagueShortName,
  };
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────

router.post("/register", async (req, res): Promise<void> => {
  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Email y contraseña son requeridos" });
    return;
  }

  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email.toLowerCase()),
  });
  if (existing) {
    res.status(409).json({ error: "Ya existe una cuenta con ese email" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await db.insert(usersTable).values({
    email:    email.toLowerCase(),
    passwordHash,
    name:     name ?? null,
  }).returning();

  const safe = safeUser(user);
  req.session.userId = user.id;
  req.session.user   = safe;

  res.status(201).json(safe);
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────

router.post("/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Email y contraseña son requeridos" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email.toLowerCase()),
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Email o contraseña incorrectos" });
    return;
  }

  const safe = safeUser(user);
  req.session.userId = user.id;
  req.session.user   = safe;

  res.json(safe);
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

router.post("/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

router.get("/me", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.session.userId),
  });

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  res.json(safeUser(user));
});

// ─── PATCH /api/auth/me/subscription ────────────────────────────────────────

router.patch("/me/subscription", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const { tier } = req.body as { tier?: string };
  if (tier !== "amateur" && tier !== "professional") {
    res.status(400).json({ error: "Tier debe ser 'amateur' o 'professional'" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ subscriptionTier: tier })
    .where(eq(usersTable.id, req.session.userId))
    .returning();

  const safe = safeUser(updated);
  if (req.session.user) {
    (req.session.user as typeof safe).subscriptionTier = tier;
  }

  res.json(safe);
});

// ─── PATCH /api/auth/select-team ─────────────────────────────────────────────
//
// Body: { teamId: string, leagueShortName: string }
// teamId      = stat_teams.external_id of the chosen team (or team name for manual leagues)
// leagueShortName = stat_leagues.short_name (e.g. "liga_fem_eb", "manual-own")
//
// Side-effect: syncs the `teams` scouting table so the Scout page sees the
// correct own/rival teams without any manual setup.

router.patch("/select-team", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const { teamId, leagueShortName } = req.body as {
    teamId?: string | null;
    leagueShortName?: string | null;
  };

  // 1. Persist selection on user record
  const [updatedUser] = await db
    .update(usersTable)
    .set({
      selectedTeamId:          teamId          ?? null,
      selectedLeagueShortName: leagueShortName ?? null,
    })
    .where(eq(usersTable.id, req.session.userId))
    .returning();

  if (req.session.user) {
    req.session.user.selectedTeamId          = teamId          ?? null;
    req.session.user.selectedLeagueShortName = leagueShortName ?? null;
  }

  // 2. Sync stat_teams → scouting teams table (skip manual leagues)
  if (teamId && leagueShortName && !leagueShortName.startsWith("manual")) {
    try {
      await syncLeagueTeams(teamId, leagueShortName);
    } catch (err) {
      // Sync failure is non-fatal — selection is already saved
      req.log?.warn({ err }, "league sync failed after team selection");
    }
  }

  res.json({ ok: true, user: safeUser(updatedUser) });
});

// ─── Helper: sync stat_teams → teams table ───────────────────────────────────

async function syncLeagueTeams(
  selectedExternalId: string,
  leagueShortName: string,
): Promise<void> {
  // Find the stat_league
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.shortName, leagueShortName),
  });
  if (!league) return;

  // Get all stat_teams in this league
  const statTeamRows = await db
    .select()
    .from(syncTeams)
    .where(eq(syncTeams.leagueId, league.id));

  if (statTeamRows.length === 0) return;

  // Load existing scouting teams that are already linked to stat data
  const existingLinked = await db
    .select()
    .from(teamsTable)
    .where(isNotNull(teamsTable.statTeamExternalId));

  const linkedMap = new Map(
    existingLinked.map((t) => [t.statTeamExternalId!, t]),
  );

  for (const st of statTeamRows) {
    const extId    = st.externalId ?? st.name;
    const isOwn    = extId === selectedExternalId;
    const teamType = isOwn ? "own" : "rival";

    const existing = linkedMap.get(extId);

    if (existing) {
      await db
        .update(teamsTable)
        .set({
          teamType,
          name:    st.name,
          logoUrl: st.logoUrl ?? existing.logoUrl,
          league:  leagueShortName,
        })
        .where(eq(teamsTable.id, existing.id));
    } else {
      await db.insert(teamsTable).values({
        name:               st.name,
        league:             leagueShortName,
        logoUrl:            st.logoUrl ?? null,
        teamType,
        statTeamExternalId: extId,
      });
    }
  }

  // Ensure any previously-own team in the same league is now rival
  // (handles the "user changes their team" scenario for manually-linked teams)
  await db
    .update(teamsTable)
    .set({ teamType: "rival" })
    .where(
      eq(teamsTable.league, leagueShortName),
    );

  // Re-apply own to the selected one
  const ownRow = await db.query.teamsTable.findFirst({
    where: eq(teamsTable.statTeamExternalId, selectedExternalId),
  });
  if (ownRow) {
    await db
      .update(teamsTable)
      .set({ teamType: "own" })
      .where(eq(teamsTable.id, ownRow.id));
  }
}

export default router;
