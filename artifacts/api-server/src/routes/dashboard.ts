import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, playersTable, teamsTable, reportsTable, gamesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [{ totalPlayers }] = await db.select({ totalPlayers: sql<number>`COUNT(*)` }).from(playersTable);
  const [{ totalTeams }] = await db.select({ totalTeams: sql<number>`COUNT(*)` }).from(teamsTable);
  const [{ totalReports }] = await db.select({ totalReports: sql<number>`COUNT(*)` }).from(reportsTable);
  const [{ totalGames }] = await db.select({ totalGames: sql<number>`COUNT(*)` }).from(gamesTable);
  const [{ avgRating }] = await db.select({ avgRating: sql<number | null>`AVG(${reportsTable.rating})` }).from(reportsTable);

  const recentReports = await db
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
    .orderBy(desc(reportsTable.createdAt))
    .limit(5);

  const positionBreakdown = await db
    .select({
      position: playersTable.position,
      count: sql<number>`COUNT(*)`,
    })
    .from(playersTable)
    .groupBy(playersTable.position)
    .orderBy(sql`COUNT(*) DESC`);

  res.json({
    totalPlayers: Number(totalPlayers),
    totalTeams: Number(totalTeams),
    totalReports: Number(totalReports),
    totalGames: Number(totalGames),
    avgRating: avgRating ? Number(avgRating) : null,
    recentReports,
    positionBreakdown: positionBreakdown.map(p => ({ position: p.position, count: Number(p.count) })),
  });
});

export default router;
