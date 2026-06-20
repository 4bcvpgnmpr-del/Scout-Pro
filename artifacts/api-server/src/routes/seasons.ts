import { Router, type IRouter } from "express";
import { desc, sql, eq } from "drizzle-orm";
import { db, seasons, leagues } from "@workspace/db";

const router: IRouter = Router();

// ─── GET /api/seasons ─────────────────────────────────────────────────────────
// Returns distinct seasons (deduplicated across leagues, grouped by startYear).

router.get("/seasons", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      startYear: seasons.startYear,
      endYear:   seasons.endYear,
      name:      sql<string>`MIN(${seasons.name})`,
      isCurrent: sql<boolean>`BOOL_OR(${seasons.isCurrent})`,
      leagueCount: sql<number>`COUNT(*)::integer`,
    })
    .from(seasons)
    .groupBy(seasons.startYear, seasons.endYear)
    .orderBy(desc(seasons.startYear));

  res.json(rows.map((s) => ({
    id:          `${s.startYear}-${s.endYear}`,
    name:        s.name,
    startYear:   s.startYear,
    endYear:     s.endYear,
    isCurrent:   Boolean(s.isCurrent),
    leagueCount: Number(s.leagueCount),
  })));
});

// ─── GET /api/seasons/leagues ─────────────────────────────────────────────────
// Helper for the admin UI to know which leagues exist.

router.get("/seasons/leagues", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ id: leagues.id, name: leagues.name, shortName: leagues.shortName })
    .from(leagues)
    .orderBy(leagues.name);
  res.json(rows);
});

// ─── POST /api/admin/seasons ──────────────────────────────────────────────────
// Creates a new season for a league and marks it isCurrent, clearing previous.

router.post("/admin/seasons", async (req, res): Promise<void> => {
  const { leagueId, name, startYear, endYear } = req.body as {
    leagueId?: string;
    name?: string;
    startYear?: number;
    endYear?: number;
  };

  if (!leagueId || !name || startYear == null || endYear == null) {
    res.status(400).json({ error: "leagueId, name, startYear y endYear son requeridos" });
    return;
  }

  await db
    .update(seasons)
    .set({ isCurrent: false })
    .where(eq(seasons.leagueId, leagueId));

  const [row] = await db
    .insert(seasons)
    .values({ leagueId, name, startYear, endYear, isCurrent: true })
    .returning();

  res.status(201).json({
    id:          `${row.startYear}-${row.endYear}`,
    name:        row.name,
    startYear:   row.startYear,
    endYear:     row.endYear,
    isCurrent:   row.isCurrent,
    leagueCount: 1,
  });
});

export default router;
