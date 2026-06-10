import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, playersTable, teamsTable, reportsTable } from "@workspace/db";
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
      jerseyNumber: playersTable.jerseyNumber,
      age: playersTable.age,
      height: playersTable.height,
      weight: playersTable.weight,
      nationality: playersTable.nationality,
      photoUrl: playersTable.photoUrl,
      notes: playersTable.notes,
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

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`);
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
      jerseyNumber: playersTable.jerseyNumber,
      age: playersTable.age,
      height: playersTable.height,
      weight: playersTable.weight,
      nationality: playersTable.nationality,
      photoUrl: playersTable.photoUrl,
      notes: playersTable.notes,
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

  const [stats] = await db
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

  if (!stats) {
    res.json({
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
    });
    return;
  }

  res.json(stats);
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
      jerseyNumber: playersTable.jerseyNumber,
      age: playersTable.age,
      height: playersTable.height,
      weight: playersTable.weight,
      nationality: playersTable.nationality,
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
      jerseyNumber: playersTable.jerseyNumber,
      age: playersTable.age,
      height: playersTable.height,
      weight: playersTable.weight,
      nationality: playersTable.nationality,
      photoUrl: playersTable.photoUrl,
      notes: playersTable.notes,
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
