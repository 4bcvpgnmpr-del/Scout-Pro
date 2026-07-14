import { Router } from "express";
import { db } from "@workspace/db";
import { syncLog, leagues, syncTeams, teamsTable } from "@workspace/db";
import { desc, gte, eq, or, sql } from "drizzle-orm";
import { syncHandlers, upsertHistoricalYearData } from "../jobs/sync.job.js";
import { requireAuth, requirePro } from "../lib/auth.middleware.js";
import { syncLeagueTeams } from "./auth.routes.js";
import { logger } from "../lib/logger.js";
import { scrapeBEVAllLeaguePlayers, scrapeBEVAllLeagueLogos } from "../scrapers/feb-scraper.js";
import { normalizeBEVPlayerStats } from "../db/normalizer.js";

const router = Router();

// ─── GET /log ─────────────────────────────────────────────────────────────────

router.get("/log", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(syncLog)
      .orderBy(desc(syncLog.startedAt))
      .limit(50);

    const formatted = rows.map((r) => ({
      id:               r.id,
      source:           r.source,
      status:           r.status,
      recordsProcessed: r.recordsProcessed ?? 0,
      durationSeconds:  r.finishedAt
        ? Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)
        : 0,
      errorMessage: r.errorMessage,
      startedAt:    r.startedAt,
    }));

    res.json(formatted);
  } catch (_err) {
    res.status(500).json({ error: "Error fetching sync log" });
  }
});

// ─── GET /stats ───────────────────────────────────────────────────────────────

router.get("/stats", async (_req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayLogs = await db
      .select()
      .from(syncLog)
      .where(gte(syncLog.startedAt, todayStart));

    const recordsToday = todayLogs.reduce((sum, l) => sum + (l.recordsProcessed ?? 0), 0);
    const errorsToday  = todayLogs.filter((l) => l.status === "error").length;

    const lastSuccess = await db
      .select()
      .from(syncLog)
      .where(eq(syncLog.status, "success"))
      .orderBy(desc(syncLog.startedAt))
      .limit(1);

    const activeSources = new Set(todayLogs.map((l) => l.source)).size;

    res.json({
      activeSources: activeSources || 3,
      recordsToday,
      lastSyncTime: lastSuccess[0] ? formatRelativeTime(lastSuccess[0].startedAt) : "—",
      errorsToday,
    });
  } catch (_err) {
    res.status(500).json({ error: "Error fetching sync stats" });
  }
});

// ─── GET /status ──────────────────────────────────────────────────────────────

router.get("/status", async (_req, res) => {
  try {
    const allLeagues = await db.select().from(leagues);

    const lastLogs = await db
      .select()
      .from(syncLog)
      .orderBy(desc(syncLog.startedAt))
      .limit(20);

    const sourcesMap: Record<string, any> = {};

    for (const league of allLeagues) {
      const key = league.source;
      if (!sourcesMap[key]) {
        sourcesMap[key] = {
          id:          key,
          name:        key.toUpperCase(),
          leagues:     [],
          status:      "pending",
          lastSync:    null,
          recordsLast: 0,
        };
      }
      sourcesMap[key].leagues.push(league.name);
    }

    for (const log of lastLogs) {
      if (sourcesMap[log.source] && !sourcesMap[log.source].lastSync) {
        sourcesMap[log.source].status      = log.status;
        sourcesMap[log.source].lastSync    = formatRelativeTime(log.startedAt);
        sourcesMap[log.source].recordsLast = log.recordsProcessed ?? 0;
      }
    }

    res.json(Object.values(sourcesMap));
  } catch (_err) {
    res.status(500).json({ error: "Error fetching sync status" });
  }
});

// ─── POST /all ────────────────────────────────────────────────────────────────

router.post("/all", requireAuth, async (_req, res) => {
  try {
    Promise.allSettled([
      syncHandlers.feb(),
      syncHandlers.euroleague(),
    ]).catch((_err) => {});

    res.json({ message: "Sincronización de todas las fuentes iniciada" });
  } catch (_err) {
    res.status(500).json({ error: "Error starting full sync" });
  }
});

// ─── POST /year/:startYear ─────────────────────────────────────────────────────

router.post("/year/:startYear", async (req, res): Promise<void> => {
  // Dev-only open access (evaluated at request time, not at module load)
  const isDev = String(process.env["NODE_ENV"]) === "development";
  if (!isDev && !req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const startYear = parseInt(req.params.startYear, 10);
  if (isNaN(startYear) || startYear < 2015 || startYear > new Date().getFullYear()) {
    res.status(400).json({ error: `Año inválido: ${req.params.startYear}` });
    return;
  }
  upsertHistoricalYearData(startYear).catch((_err) => {});
  res.json({ message: `Sync histórico para ${startYear}-${startYear + 1} iniciado en segundo plano` });
});

// ─── POST /player-stats/:leagueId ─────────────────────────────────────────────
// Re-sync player stats for a single BEV league (e.g. "lf2"). Dev-only open.

router.post("/player-stats/:leagueId", async (req, res): Promise<void> => {
  const isDev = String(process.env["NODE_ENV"]) === "development";
  if (!isDev && !req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const { leagueId } = req.params;
  const startYearParam = req.query["year"] as string | undefined;
  const startYear = startYearParam ? parseInt(startYearParam, 10) : undefined;

  const run = async () => {
    const allData = await scrapeBEVAllLeaguePlayers(startYear, leagueId);
    let total = 0;
    for (const data of allData) {
      total += await normalizeBEVPlayerStats(data, startYear);
    }
    req.log?.info({ leagueId, startYear, total }, "[player-stats sync] completed");
  };

  run().catch((err) => req.log?.error({ err, leagueId }, "[player-stats sync] failed"));
  res.json({ message: `Player stats sync para ${leagueId} iniciado en segundo plano` });
});

// ─── POST /scouting-league/:leagueShortName ───────────────────────────────────

router.post("/scouting-league/:leagueShortName", async (req, res): Promise<void> => {
  const isDev = String(process.env["NODE_ENV"]) === "development";
  if (!isDev && !req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const { leagueShortName } = req.params;
  const selectedExtId = (req.query["selectedTeam"] as string) ?? "";
  syncLeagueTeams(selectedExtId, leagueShortName).catch((_err) => {});
  res.json({ message: `Scouting sync para ${leagueShortName} iniciado` });
});

// ─── POST /team-logos ─────────────────────────────────────────────────────────
// Scrapes logos from BEV team pages and propagates them to stat_teams + teams.
// Dev-only open access.

router.post("/team-logos", async (req, res): Promise<void> => {
  const isDev = String(process.env["NODE_ENV"]) === "development";
  if (!isDev && !req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const leagueId = req.query["leagueId"] as string | undefined;

  const run = async () => {
    const logos = await scrapeBEVAllLeagueLogos(leagueId);
    let updated = 0;

    for (const { bevId, name, logoUrl } of logos) {
      // Normalise name for comparison: uppercase, collapse spaces
      const bevNorm = name.replace(/\s+/g, " ").trim().toUpperCase();

      // 1. Try match by external_id = 'bev-{bevId}'
      const byExtId = await db.query.syncTeams.findFirst({
        where: (t, { eq: eq_ }) => eq_(t.externalId, `bev-${bevId}`),
      });

      if (byExtId) {
        await db.update(syncTeams).set({ logoUrl, updatedAt: new Date() })
          .where(eq(syncTeams.id, byExtId.id));
        await db.update(teamsTable).set({ logoUrl })
          .where(eq(teamsTable.statTeamExternalId, `bev-${bevId}`));
        updated++;
        continue;
      }

      // 2. Try match by exact team name (case-insensitive)
      const byName = await db.query.syncTeams.findFirst({
        where: (t, { sql: sql_ }) =>
          sql_`UPPER(REGEXP_REPLACE(${t.name}, '\\s+', ' ', 'g')) = ${bevNorm}`,
      });

      if (byName) {
        await db.update(syncTeams).set({ logoUrl, updatedAt: new Date() })
          .where(eq(syncTeams.id, byName.id));
        // Propagate to scouting teams table
        await db.update(teamsTable).set({ logoUrl })
          .where(eq(teamsTable.statTeamExternalId, byName.externalId ?? ""));
        updated++;
      }
    }

    // Also sync logos from stat_teams → teams for any already-populated rows
    await db.execute(
      sql`UPDATE teams t
          SET logo_url = st.logo_url
          FROM stat_teams st
          WHERE t.stat_team_external_id = st.external_id
            AND st.logo_url IS NOT NULL
            AND (t.logo_url IS NULL OR t.logo_url != st.logo_url)`,
    );

    logger.info({ total: logos.length, updated }, "[team-logos sync] completado");
  };

  run().catch((err) => {
    logger.error({ err }, "[team-logos sync] failed");
  });

  res.json({ message: "Sincronización de escudos iniciada en segundo plano" });
});

// ─── POST /scouting-all ────────────────────────────────────────────────────────

router.post("/scouting-all", async (req, res): Promise<void> => {
  const isDev = String(process.env["NODE_ENV"]) === "development";
  if (!isDev && !req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const leagueList = ["lf2", "lf-challenge", "liga-femenina-endesa", "primera-feb", "segunda-feb", "tercera-feb"];
  const selectedByLeague: Record<string, string> = {
    lf2: (req.query["lf2Team"] as string) ?? "",
  };
  // Run leagues sequentially to avoid race conditions creating duplicate teams,
  // then trigger logo sync so shields appear in the Teams page.
  const runAll = async () => {
    for (const l of leagueList) {
      await syncLeagueTeams(selectedByLeague[l] ?? "", l);
    }
    // Auto-sync team logos after player/team data is up-to-date
    const logos = await scrapeBEVAllLeagueLogos();
    let updated = 0;
    for (const { bevId, name, logoUrl } of logos) {
      const bevNorm = name.replace(/\s+/g, " ").trim().toUpperCase();
      const byExtId = await db.query.syncTeams.findFirst({
        where: (t, { eq: eq_ }) => eq_(t.externalId, `bev-${bevId}`),
      });
      if (byExtId) {
        await db.update(syncTeams).set({ logoUrl, updatedAt: new Date() })
          .where(eq(syncTeams.id, byExtId.id));
        await db.update(teamsTable).set({ logoUrl })
          .where(eq(teamsTable.statTeamExternalId, `bev-${bevId}`));
        updated++;
        continue;
      }
      const byName = await db.query.syncTeams.findFirst({
        where: (t, { sql: sql_ }) =>
          sql_`UPPER(REGEXP_REPLACE(${t.name}, '\\s+', ' ', 'g')) = ${bevNorm}`,
      });
      if (byName) {
        await db.update(syncTeams).set({ logoUrl, updatedAt: new Date() })
          .where(eq(syncTeams.id, byName.id));
        await db.update(teamsTable).set({ logoUrl })
          .where(eq(teamsTable.statTeamExternalId, byName.externalId ?? ""));
        updated++;
      }
    }
    // Final pass: propagate stat_teams.logo_url → teams.logo_url
    await db.execute(
      sql`UPDATE teams t
          SET logo_url = st.logo_url
          FROM stat_teams st
          WHERE t.stat_team_external_id = st.external_id
            AND st.logo_url IS NOT NULL
            AND (t.logo_url IS NULL OR t.logo_url != st.logo_url)`,
    );
    logger.info({ updated }, "[scouting-all] logos sincronizados");
  };
  runAll().catch((_err) => {});
  res.json({ message: "Scouting sync para todas las ligas iniciado" });
});

// ─── POST /:source ────────────────────────────────────────────────────────────

router.post("/:source", requireAuth, async (req, res): Promise<void> => {
  const { source } = req.params;
  const handler = syncHandlers[source as keyof typeof syncHandlers];

  if (!handler) {
    res.status(400).json({ error: `Fuente desconocida: ${source}` });
    return;
  }

  handler().catch((_err) => {});
  res.json({ message: `Sincronización de ${source} iniciada` });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date | string): string {
  const diffMin = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (diffMin < 1)  return "ahora mismo";
  if (diffMin < 60) return `hace ${diffMin}min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.round(h / 24)}d`;
}

export default router;
