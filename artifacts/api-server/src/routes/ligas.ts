import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { leagues, syncTeams } from "@workspace/db";

const router: IRouter = Router();

// GET /api/ligas — all active leagues with team counts (deduped by short_name)
router.get("/ligas", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      shortName:   leagues.shortName,
      name:        leagues.name,
      source:      leagues.source,
      gender:      leagues.gender,
      level:       leagues.level,
      isAutomated: leagues.isAutomated,
      teamCount:   sql<number>`count(${syncTeams.id})::int`,
    })
    .from(leagues)
    .leftJoin(syncTeams, eq(syncTeams.leagueId, leagues.id))
    .where(eq(leagues.isActive, true))
    .groupBy(
      leagues.id,
      leagues.shortName,
      leagues.name,
      leagues.source,
      leagues.gender,
      leagues.level,
      leagues.isAutomated,
    )
    .orderBy(leagues.source, leagues.level);

  // Dedupe by name — keep the one with most teams; drop duplicates with 0 teams
  const deduped = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const key = row.name.toLowerCase().trim();
    const existing = deduped.get(key);
    if (!existing || row.teamCount > existing.teamCount) {
      deduped.set(key, row);
    }
  }

  // Only show leagues that actually have teams
  const result = [...deduped.values()].filter((r) => r.teamCount > 0);
  res.json(result);
});

// GET /api/equipos/:ligaId — teams for a given league slug
router.get("/equipos/:ligaId", async (req, res): Promise<void> => {
  const { ligaId } = req.params;

  const teams = await db
    .select({
      id:        syncTeams.externalId,
      nombre:    syncTeams.name,
      shortName: syncTeams.shortName,
      logoUrl:   syncTeams.logoUrl,
    })
    .from(syncTeams)
    .innerJoin(leagues, eq(syncTeams.leagueId, leagues.id))
    .where(eq(leagues.shortName, ligaId))
    .orderBy(syncTeams.name);

  res.json({ equipos: teams });
});

export default router;
