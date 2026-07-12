import { Router, type IRouter } from "express";
import { eq, sql, and, desc } from "drizzle-orm";
import { db, playersTable, teamsTable, reportsTable, playerStats, syncPlayers, seasons } from "@workspace/db";
import {
  CreatePlayerBody,
  UpdatePlayerBody,
  GetPlayerParams,
  UpdatePlayerParams,
  DeletePlayerParams,
  GetPlayerStatsParams,
  GetTopPlayersQueryParams,
  ListPlayersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/players/top", async (req, res): Promise<void> => {
  const query = GetTopPlayersQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 5;

  const topPlayers = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      position: playersTable.position,
      photoUrl: playersTable.photoUrl,
      teamName: teamsTable.name,
      avgPoints: sql<number>`COALESCE(AVG(${reportsTable.points}), 0)`,
      avgRebounds: sql<number>`COALESCE(AVG(${reportsTable.rebounds}), 0)`,
      avgAssists: sql<number>`COALESCE(AVG(${reportsTable.assists}), 0)`,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .leftJoin(reportsTable, eq(reportsTable.playerId, playersTable.id))
    .groupBy(playersTable.id, teamsTable.name)
    .orderBy(sql`COALESCE(AVG(${reportsTable.points}), 0) DESC`)
    .limit(limit);

  res.json(topPlayers);
});

router.get("/players", async (req, res): Promise<void> => {
  const query = ListPlayersQueryParams.safeParse(req.query);

  let baseQuery = db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      position: playersTable.position,
      teamId: playersTable.teamId,
      teamName: teamsTable.name,
      teamLogoUrl: teamsTable.logoUrl,
      jerseyNumber: playersTable.jerseyNumber,
      age: playersTable.age,
      height: playersTable.height,
      weight: playersTable.weight,
      nationality: playersTable.nationality,
      handedness: playersTable.handedness,
      photoUrl: playersTable.photoUrl,
      notes: playersTable.notes,
      watchlisted: playersTable.watchlisted,
      seasonYear: playersTable.seasonYear,
      statPlayerExternalId: playersTable.statPlayerExternalId,
      createdAt: playersTable.createdAt,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .$dynamic();

  const conditions = [];

  if (query.success && query.data.teamId) {
    conditions.push(eq(playersTable.teamId, query.data.teamId));
  }

  if (query.success && query.data.position) {
    conditions.push(eq(playersTable.position, query.data.position));
  }

  if (query.success && query.data.watchlisted != null) {
    conditions.push(eq(playersTable.watchlisted, query.data.watchlisted));
  }

  // seasonYear: filter by year, or null to include manually-added players (no season)
  const rawSeasonYear = req.query.seasonYear;
  if (rawSeasonYear != null) {
    const sy = parseInt(String(rawSeasonYear), 10);
    if (!isNaN(sy)) {
      conditions.push(eq(playersTable.seasonYear, sy));
    }
  }

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  const players = await baseQuery.orderBy(playersTable.name);
  res.json(players);
});

router.post("/players", async (req, res): Promise<void> => {
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [player] = await db.insert(playersTable).values(parsed.data).returning();
  const [withTeam] = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      position: playersTable.position,
      teamId: playersTable.teamId,
      teamName: teamsTable.name,
      teamLogoUrl: teamsTable.logoUrl,
      jerseyNumber: playersTable.jerseyNumber,
      age: playersTable.age,
      height: playersTable.height,
      weight: playersTable.weight,
      nationality: playersTable.nationality,
      handedness: playersTable.handedness,
      photoUrl: playersTable.photoUrl,
      notes: playersTable.notes,
      watchlisted: playersTable.watchlisted,
      createdAt: playersTable.createdAt,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(eq(playersTable.id, player.id));
  res.status(201).json(withTeam);
});

router.get("/players/:id/stats", async (req, res): Promise<void> => {
  const params = GetPlayerStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const zeros = {
    playerId: params.data.id,
    gamesPlayed: 0,
    avgPoints: 0,
    avgRebounds: 0,
    avgAssists: 0,
    avgSteals: 0,
    avgBlocks: 0,
    avgMinutes: 0,
    avgFieldGoalPct: null,
    avgThreePointPct: null,
    avgFreeThrowPct: null,
  };

  // 1. Try manual scouting reports first
  const [reportStats] = await db
    .select({
      playerId: reportsTable.playerId,
      gamesPlayed: sql<number>`COUNT(${reportsTable.id})`,
      avgPoints: sql<number>`COALESCE(AVG(${reportsTable.points}), 0)`,
      avgRebounds: sql<number>`COALESCE(AVG(${reportsTable.rebounds}), 0)`,
      avgAssists: sql<number>`COALESCE(AVG(${reportsTable.assists}), 0)`,
      avgSteals: sql<number>`COALESCE(AVG(${reportsTable.steals}), 0)`,
      avgBlocks: sql<number>`COALESCE(AVG(${reportsTable.blocks}), 0)`,
      avgMinutes: sql<number>`COALESCE(AVG(${reportsTable.minutesPlayed}), 0)`,
      avgFieldGoalPct: sql<number | null>`CASE WHEN SUM(${reportsTable.fieldGoalsAttempted}) > 0 THEN SUM(${reportsTable.fieldGoalsMade})::float / SUM(${reportsTable.fieldGoalsAttempted}) ELSE NULL END`,
      avgThreePointPct: sql<number | null>`CASE WHEN SUM(${reportsTable.threesAttempted}) > 0 THEN SUM(${reportsTable.threesMade})::float / SUM(${reportsTable.threesAttempted}) ELSE NULL END`,
      avgFreeThrowPct: sql<number | null>`CASE WHEN SUM(${reportsTable.freeThrowsAttempted}) > 0 THEN SUM(${reportsTable.freeThrowsMade})::float / SUM(${reportsTable.freeThrowsAttempted}) ELSE NULL END`,
    })
    .from(reportsTable)
    .where(eq(reportsTable.playerId, params.data.id))
    .groupBy(reportsTable.playerId);

  if (reportStats && Number(reportStats.gamesPlayed) > 0) {
    res.json(reportStats);
    return;
  }

  // 2. Fall back to BEV scraped stats via statPlayerExternalId
  const [player] = await db
    .select({ statPlayerExternalId: playersTable.statPlayerExternalId })
    .from(playersTable)
    .where(eq(playersTable.id, params.data.id));

  if (player?.statPlayerExternalId) {
    const [bev] = await db
      .select({
        gamesPlayed:  playerStats.gamesPlayed,
        minutesAvg:   playerStats.minutesAvg,
        points:       playerStats.points,
        rebounds:     playerStats.rebounds,
        assists:      playerStats.assists,
        steals:       playerStats.steals,
        blocks:       playerStats.blocks,
        fg2Made:      playerStats.fg2Made,
        fg2Att:       playerStats.fg2Att,
        fg3Made:      playerStats.fg3Made,
        fg3Att:       playerStats.fg3Att,
        ftMade:       playerStats.ftMade,
        ftAtt:        playerStats.ftAtt,
      })
      .from(playerStats)
      .innerJoin(syncPlayers, eq(syncPlayers.id, playerStats.playerId))
      .innerJoin(seasons, eq(seasons.id, playerStats.seasonId))
      .where(eq(syncPlayers.externalId, player.statPlayerExternalId))
      .orderBy(desc(seasons.startYear))
      .limit(1);

    if (bev && bev.gamesPlayed > 0) {
      const gp = bev.gamesPlayed;
      const fgAtt = (bev.fg2Att ?? 0) + (bev.fg3Att ?? 0);
      const fgMade = (bev.fg2Made ?? 0) + (bev.fg3Made ?? 0);
      res.json({
        playerId: params.data.id,
        gamesPlayed: gp,
        avgPoints:   (bev.points   ?? 0) / gp,
        avgRebounds: (bev.rebounds ?? 0) / gp,
        avgAssists:  (bev.assists  ?? 0) / gp,
        avgSteals:   (bev.steals   ?? 0) / gp,
        avgBlocks:   (bev.blocks   ?? 0) / gp,
        avgMinutes:  bev.minutesAvg ?? 0,
        avgFieldGoalPct:    fgAtt  > 0 ? fgMade  / fgAtt  : null,
        avgThreePointPct:   (bev.fg3Att ?? 0) > 0 ? (bev.fg3Made ?? 0) / (bev.fg3Att ?? 0) : null,
        avgFreeThrowPct:    (bev.ftAtt  ?? 0) > 0 ? (bev.ftMade  ?? 0) / (bev.ftAtt  ?? 0) : null,
      });
      return;
    }
  }

  res.json(zeros);
});

router.get("/players/:id", async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [player] = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      position: playersTable.position,
      teamId: playersTable.teamId,
      teamName: teamsTable.name,
      teamLogoUrl: teamsTable.logoUrl,
      jerseyNumber: playersTable.jerseyNumber,
      age: playersTable.age,
      height: playersTable.height,
      weight: playersTable.weight,
      nationality: playersTable.nationality,
      handedness: playersTable.handedness,
      photoUrl: playersTable.photoUrl,
      notes: playersTable.notes,
      createdAt: playersTable.createdAt,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(eq(playersTable.id, params.data.id));

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(player);
});

router.patch("/players/:id", async (req, res): Promise<void> => {
  const params = UpdatePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(playersTable).set(parsed.data).where(eq(playersTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  const [withTeam] = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      position: playersTable.position,
      teamId: playersTable.teamId,
      teamName: teamsTable.name,
      teamLogoUrl: teamsTable.logoUrl,
      jerseyNumber: playersTable.jerseyNumber,
      age: playersTable.age,
      height: playersTable.height,
      weight: playersTable.weight,
      nationality: playersTable.nationality,
      handedness: playersTable.handedness,
      photoUrl: playersTable.photoUrl,
      notes: playersTable.notes,
      watchlisted: playersTable.watchlisted,
      createdAt: playersTable.createdAt,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(eq(playersTable.id, updated.id));
  res.json(withTeam);
});

router.delete("/players/:id", async (req, res): Promise<void> => {
  const params = DeletePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [player] = await db.delete(playersTable).where(eq(playersTable.id, params.data.id)).returning();
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
