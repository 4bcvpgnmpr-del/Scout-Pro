import { Router, type IRouter } from "express";
import { eq, desc, avg, count, sql, and, gte, lte } from "drizzle-orm";
import { db, reportsTable, playersTable, teamsTable, gamesTable } from "@workspace/db";
import {
  CreateReportBody,
  UpdateReportBody,
  GetReportParams,
  UpdateReportParams,
  DeleteReportParams,
  ListReportsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/reports", async (req, res): Promise<void> => {
  const query = ListReportsQueryParams.safeParse(req.query);

  let baseQuery = db
    .select({
      id: reportsTable.id,
      playerId: reportsTable.playerId,
      playerName: playersTable.name,
      gameId: reportsTable.gameId,
      scoutName: reportsTable.scoutName,
      date: reportsTable.date,
      rating: reportsTable.rating,
      offensiveRating: reportsTable.offensiveRating,
      defensiveRating: reportsTable.defensiveRating,
      athleticismRating: reportsTable.athleticismRating,
      iQRating: reportsTable.iQRating,
      points: reportsTable.points,
      rebounds: reportsTable.rebounds,
      offensiveRebounds: reportsTable.offensiveRebounds,
      defensiveRebounds: reportsTable.defensiveRebounds,
      assists: reportsTable.assists,
      steals: reportsTable.steals,
      blocks: reportsTable.blocks,
      turnovers: reportsTable.turnovers,
      minutesPlayed: reportsTable.minutesPlayed,
      fieldGoalsMade: reportsTable.fieldGoalsMade,
      fieldGoalsAttempted: reportsTable.fieldGoalsAttempted,
      threesMade: reportsTable.threesMade,
      threesAttempted: reportsTable.threesAttempted,
      freeThrowsMade: reportsTable.freeThrowsMade,
      freeThrowsAttempted: reportsTable.freeThrowsAttempted,
      strengths: reportsTable.strengths,
      weaknesses: reportsTable.weaknesses,
      summary: reportsTable.summary,
      recommendation: reportsTable.recommendation,
      createdAt: reportsTable.createdAt,
    })
    .from(reportsTable)
    .leftJoin(playersTable, eq(reportsTable.playerId, playersTable.id))
    .$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];
  if (query.success && query.data.playerId) {
    conditions.push(eq(reportsTable.playerId, query.data.playerId));
  }
  const seasonYear = req.query.season ? parseInt(req.query.season as string, 10) : null;
  if (seasonYear && !Number.isNaN(seasonYear)) {
    const seasonStart = `${seasonYear}-08-01`;
    const seasonEnd   = `${seasonYear + 1}-07-31`;
    conditions.push(gte(reportsTable.date, seasonStart) as ReturnType<typeof eq>);
    conditions.push(lte(reportsTable.date, seasonEnd) as ReturnType<typeof eq>);
  }
  if (conditions.length > 0) {
    baseQuery = baseQuery.where(conditions.length === 1 ? conditions[0]! : and(...conditions)!);
  }

  const reports = await baseQuery.orderBy(desc(reportsTable.createdAt));
  res.json(reports);
});

router.post("/reports", async (req, res): Promise<void> => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [report] = await db.insert(reportsTable).values(parsed.data).returning();
  const [withPlayer] = await db
    .select({
      id: reportsTable.id,
      playerId: reportsTable.playerId,
      playerName: playersTable.name,
      gameId: reportsTable.gameId,
      scoutName: reportsTable.scoutName,
      date: reportsTable.date,
      rating: reportsTable.rating,
      offensiveRating: reportsTable.offensiveRating,
      defensiveRating: reportsTable.defensiveRating,
      athleticismRating: reportsTable.athleticismRating,
      iQRating: reportsTable.iQRating,
      points: reportsTable.points,
      rebounds: reportsTable.rebounds,
      offensiveRebounds: reportsTable.offensiveRebounds,
      defensiveRebounds: reportsTable.defensiveRebounds,
      assists: reportsTable.assists,
      steals: reportsTable.steals,
      blocks: reportsTable.blocks,
      turnovers: reportsTable.turnovers,
      minutesPlayed: reportsTable.minutesPlayed,
      fieldGoalsMade: reportsTable.fieldGoalsMade,
      fieldGoalsAttempted: reportsTable.fieldGoalsAttempted,
      threesMade: reportsTable.threesMade,
      threesAttempted: reportsTable.threesAttempted,
      freeThrowsMade: reportsTable.freeThrowsMade,
      freeThrowsAttempted: reportsTable.freeThrowsAttempted,
      strengths: reportsTable.strengths,
      weaknesses: reportsTable.weaknesses,
      summary: reportsTable.summary,
      recommendation: reportsTable.recommendation,
      createdAt: reportsTable.createdAt,
    })
    .from(reportsTable)
    .leftJoin(playersTable, eq(reportsTable.playerId, playersTable.id))
    .where(eq(reportsTable.id, report.id));
  res.status(201).json(withPlayer);
});

router.get("/reports/:id", async (req, res): Promise<void> => {
  const params = GetReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [report] = await db
    .select({
      id: reportsTable.id,
      playerId: reportsTable.playerId,
      playerName: playersTable.name,
      gameId: reportsTable.gameId,
      scoutName: reportsTable.scoutName,
      date: reportsTable.date,
      rating: reportsTable.rating,
      offensiveRating: reportsTable.offensiveRating,
      defensiveRating: reportsTable.defensiveRating,
      athleticismRating: reportsTable.athleticismRating,
      iQRating: reportsTable.iQRating,
      points: reportsTable.points,
      rebounds: reportsTable.rebounds,
      offensiveRebounds: reportsTable.offensiveRebounds,
      defensiveRebounds: reportsTable.defensiveRebounds,
      assists: reportsTable.assists,
      steals: reportsTable.steals,
      blocks: reportsTable.blocks,
      turnovers: reportsTable.turnovers,
      minutesPlayed: reportsTable.minutesPlayed,
      fieldGoalsMade: reportsTable.fieldGoalsMade,
      fieldGoalsAttempted: reportsTable.fieldGoalsAttempted,
      threesMade: reportsTable.threesMade,
      threesAttempted: reportsTable.threesAttempted,
      freeThrowsMade: reportsTable.freeThrowsMade,
      freeThrowsAttempted: reportsTable.freeThrowsAttempted,
      strengths: reportsTable.strengths,
      weaknesses: reportsTable.weaknesses,
      summary: reportsTable.summary,
      recommendation: reportsTable.recommendation,
      createdAt: reportsTable.createdAt,
    })
    .from(reportsTable)
    .leftJoin(playersTable, eq(reportsTable.playerId, playersTable.id))
    .where(eq(reportsTable.id, params.data.id));
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(report);
});

router.patch("/reports/:id", async (req, res): Promise<void> => {
  const params = UpdateReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(reportsTable).set(parsed.data).where(eq(reportsTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const [withPlayer] = await db
    .select({
      id: reportsTable.id,
      playerId: reportsTable.playerId,
      playerName: playersTable.name,
      gameId: reportsTable.gameId,
      scoutName: reportsTable.scoutName,
      date: reportsTable.date,
      rating: reportsTable.rating,
      offensiveRating: reportsTable.offensiveRating,
      defensiveRating: reportsTable.defensiveRating,
      athleticismRating: reportsTable.athleticismRating,
      iQRating: reportsTable.iQRating,
      points: reportsTable.points,
      rebounds: reportsTable.rebounds,
      offensiveRebounds: reportsTable.offensiveRebounds,
      defensiveRebounds: reportsTable.defensiveRebounds,
      assists: reportsTable.assists,
      steals: reportsTable.steals,
      blocks: reportsTable.blocks,
      turnovers: reportsTable.turnovers,
      minutesPlayed: reportsTable.minutesPlayed,
      fieldGoalsMade: reportsTable.fieldGoalsMade,
      fieldGoalsAttempted: reportsTable.fieldGoalsAttempted,
      threesMade: reportsTable.threesMade,
      threesAttempted: reportsTable.threesAttempted,
      freeThrowsMade: reportsTable.freeThrowsMade,
      freeThrowsAttempted: reportsTable.freeThrowsAttempted,
      strengths: reportsTable.strengths,
      weaknesses: reportsTable.weaknesses,
      summary: reportsTable.summary,
      recommendation: reportsTable.recommendation,
      createdAt: reportsTable.createdAt,
    })
    .from(reportsTable)
    .leftJoin(playersTable, eq(reportsTable.playerId, playersTable.id))
    .where(eq(reportsTable.id, updated.id));
  res.json(withPlayer);
});

router.delete("/reports/:id", async (req, res): Promise<void> => {
  const params = DeleteReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [report] = await db.delete(reportsTable).where(eq(reportsTable.id, params.data.id)).returning();
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
