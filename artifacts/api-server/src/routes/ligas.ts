import { Router, type IRouter } from "express";
import { eq, sql, ilike, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { leagues, syncTeams, syncPlayers, playerStats, seasons, standings } from "@workspace/db";

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

// GET /api/liga-jugadores — stat_players with their current-season stats
// Query params: liga (shortName), posicion, buscar, limit (default 200)
router.get("/liga-jugadores", async (req, res): Promise<void> => {
  const { liga, teamId, posicion, buscar, limit: limitParam } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(limitParam ?? "200", 10) || 200, 500);

  const conditions = [];

  if (liga) {
    conditions.push(eq(leagues.shortName, liga));
  }
  if (teamId) {
    conditions.push(eq(syncTeams.id, teamId));
  }
  if (posicion) {
    conditions.push(eq(syncPlayers.position, posicion));
  }
  if (buscar) {
    conditions.push(
      sql`(upper(${syncPlayers.firstName} || ' ' || ${syncPlayers.lastName}) LIKE upper(${"%" + buscar + "%"}) OR upper(${syncTeams.name}) LIKE upper(${"%" + buscar + "%"}))`,
    );
  }

  const rows = await db
    .select({
      id:          syncPlayers.id,
      firstName:   syncPlayers.firstName,
      lastName:    syncPlayers.lastName,
      position:    syncPlayers.position,
      nationality: syncPlayers.nationality,
      photoUrl:    syncPlayers.photoUrl,
      teamId:      syncTeams.id,
      teamName:    syncTeams.name,
      leagueName:  leagues.shortName,
      leagueFullName: leagues.name,
      gender:      leagues.gender,
      seasonName:  seasons.name,
      gamesPlayed: playerStats.gamesPlayed,
      minutesAvg:  playerStats.minutesAvg,
      points:      playerStats.points,
      rebounds:    playerStats.rebounds,
      assists:     playerStats.assists,
      steals:      playerStats.steals,
      blocks:      playerStats.blocks,
      turnovers:   playerStats.turnovers,
      fg2Made:     playerStats.fg2Made,
      fg2Att:      playerStats.fg2Att,
      fg3Made:     playerStats.fg3Made,
      fg3Att:      playerStats.fg3Att,
      ftMade:      playerStats.ftMade,
      ftAtt:       playerStats.ftAtt,
      pir:         playerStats.pir,
    })
    .from(playerStats)
    .innerJoin(syncPlayers, eq(playerStats.playerId, syncPlayers.id))
    .innerJoin(syncTeams,   eq(playerStats.teamId,   syncTeams.id))
    .innerJoin(seasons,     eq(playerStats.seasonId, seasons.id))
    .innerJoin(leagues,     eq(syncTeams.leagueId,   leagues.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${playerStats.points} DESC NULLS LAST`)
    .limit(limit);

  res.json(rows);
});

// GET /api/liga-jugadores/ligas — distinct leagues that have player stats
router.get("/liga-jugadores/ligas", async (_req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({
      shortName: leagues.shortName,
      name:      leagues.name,
      gender:    leagues.gender,
    })
    .from(playerStats)
    .innerJoin(syncTeams, eq(playerStats.teamId, syncTeams.id))
    .innerJoin(leagues,   eq(syncTeams.leagueId, leagues.id))
    .orderBy(leagues.shortName);

  res.json(rows);
});

// GET /api/liga-jugadores/equipos?liga=X — all teams in a league (with optional player count)
router.get("/liga-jugadores/equipos", async (req, res): Promise<void> => {
  const { liga } = req.query as Record<string, string | undefined>;

  const rows = await db
    .select({
      id:          syncTeams.id,
      name:        syncTeams.name,
      logoUrl:     syncTeams.logoUrl,
      leagueName:  leagues.shortName,
      leagueFullName: leagues.name,
      gender:      leagues.gender,
      playerCount: sql<number>`count(distinct ${playerStats.playerId})::int`,
    })
    .from(syncTeams)
    .innerJoin(leagues,    eq(syncTeams.leagueId, leagues.id))
    .leftJoin(playerStats, eq(playerStats.teamId, syncTeams.id))
    .where(liga ? eq(leagues.shortName, liga) : undefined)
    .groupBy(syncTeams.id, syncTeams.name, syncTeams.logoUrl, leagues.shortName, leagues.name, leagues.gender)
    .orderBy(leagues.shortName, syncTeams.name);

  res.json(rows);
});

// GET /api/standings/by-team/:externalId — full standings for the league of this team
router.get("/standings/by-team/:externalId", async (req, res): Promise<void> => {
  const { externalId } = req.params;

  const team = await db.query.syncTeams.findFirst({
    where: eq(syncTeams.externalId, externalId),
    with: { league: true },
  });

  if (!team) {
    res.status(404).json({ error: "Equipo no encontrado" });
    return;
  }

  const season = await db.query.seasons.findFirst({
    where: and(eq(seasons.leagueId, team.leagueId), eq(seasons.isCurrent, true)),
  });

  if (!season) {
    res.json({ standings: [], leagueShortName: team.league.shortName, leagueName: team.league.name, currentTeamExternalId: externalId });
    return;
  }

  const rows = await db
    .select({
      rank:          standings.rank,
      group:         standings.group,
      gamesPlayed:   standings.gamesPlayed,
      wins:          standings.wins,
      losses:        standings.losses,
      winPct:        standings.winPct,
      pointsFor:     standings.pointsFor,
      pointsAgainst: standings.pointsAgainst,
      pointDiff:     standings.pointDiff,
      teamExternalId: syncTeams.externalId,
      teamName:       syncTeams.name,
    })
    .from(standings)
    .innerJoin(syncTeams, eq(standings.teamId, syncTeams.id))
    .where(and(eq(standings.seasonId, season.id), sql`${standings.rank} > 0`))
    .orderBy(standings.rank);

  res.json({
    standings: rows,
    leagueShortName: team.league.shortName,
    leagueName: team.league.name,
    seasonName: season.name,
    currentTeamExternalId: externalId,
  });
});

export default router;
