import { eq, and, desc, or, lte, sql } from "drizzle-orm";
import {
  db,
  teamsTable,
  gamesTable,
  playersTable,
  syncTeams,
  syncPlayers,
  playerStats,
  standings,
  seasons,
  leagues,
} from "@workspace/db";
import {
  assessStandingAvailability,
  getReliableAggregateGamesPlayed,
} from "./scouting-stats-availability.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeamOverviewData {
  teamId: number;
  teamName: string;
  logoUrl: string | null;
  league: string | null;
  seasonName: string | null;
  gamesPlayed: number;
  wins: number | null;
  losses: number | null;
  winPct: number | null;
  rank: number | null;
  ppg: number | null;
  oppg: number | null;
  diff: number | null;
  fgPct: number | null;
  fg2Pct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
  offReb: number;
  defReb: number;
  totReb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  fouls: number;
  pir: number | null;
  availability: {
    standings: boolean;
    record: boolean;
    rank: boolean;
    pointsFor: boolean;
    pointsAgainst: boolean;
    diff: boolean;
    playerStats: boolean;
  };
  provenance: {
    standings: "official" | "partial" | "none";
    playerStats: "season_aggregate" | "none";
  };
  updatedAt: string;
}

// ─── Resolve scouting team → latest stat team/season ────────────────────────

export async function resolveStatTeam(teamId: number) {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) return null;

  if (!team.statTeamExternalId) return { team, statTeam: null, season: null, league: null };

  const rows = await db
    .select({
      statTeam: syncTeams,
      season: seasons,
      league: leagues,
    })
    .from(syncTeams)
    .innerJoin(leagues, eq(leagues.id, syncTeams.leagueId))
    .innerJoin(seasons, eq(seasons.leagueId, leagues.id))
    .where(eq(syncTeams.externalId, team.statTeamExternalId))
    .orderBy(desc(seasons.startYear));

  // pick the latest season that actually has standings or player stats for this team
  for (const r of rows) {
    const [st] = await db
      .select({ id: standings.id })
      .from(standings)
      .where(and(eq(standings.teamId, r.statTeam.id), eq(standings.seasonId, r.season.id)))
      .limit(1);
    if (st) return { team, statTeam: r.statTeam, season: r.season, league: r.league };
    const [ps] = await db
      .select({ id: playerStats.id })
      .from(playerStats)
      .where(and(eq(playerStats.teamId, r.statTeam.id), eq(playerStats.seasonId, r.season.id)))
      .limit(1);
    if (ps) return { team, statTeam: r.statTeam, season: r.season, league: r.league };
  }
  const first = rows[0];
  return { team, statTeam: first?.statTeam ?? null, season: first?.season ?? null, league: first?.league ?? null };
}

// ─── Team aggregate from player_stats ────────────────────────────────────────

export async function getTeamAggregate(statTeamId: string, seasonId: string) {
  const [agg] = await db
    .select({
      points: sql<number>`COALESCE(SUM(${playerStats.points}), 0)`,
      fg2Made: sql<number>`COALESCE(SUM(${playerStats.fg2Made}), 0)`,
      fg2Att: sql<number>`COALESCE(SUM(${playerStats.fg2Att}), 0)`,
      fg3Made: sql<number>`COALESCE(SUM(${playerStats.fg3Made}), 0)`,
      fg3Att: sql<number>`COALESCE(SUM(${playerStats.fg3Att}), 0)`,
      ftMade: sql<number>`COALESCE(SUM(${playerStats.ftMade}), 0)`,
      ftAtt: sql<number>`COALESCE(SUM(${playerStats.ftAtt}), 0)`,
      offReb: sql<number>`COALESCE(SUM(${playerStats.offRebounds}), 0)`,
      defReb: sql<number>`COALESCE(SUM(${playerStats.defRebounds}), 0)`,
      totReb: sql<number>`COALESCE(SUM(${playerStats.rebounds}), 0)`,
      ast: sql<number>`COALESCE(SUM(${playerStats.assists}), 0)`,
      tov: sql<number>`COALESCE(SUM(${playerStats.turnovers}), 0)`,
      stl: sql<number>`COALESCE(SUM(${playerStats.steals}), 0)`,
      blk: sql<number>`COALESCE(SUM(${playerStats.blocks}), 0)`,
      fouls: sql<number>`COALESCE(SUM(${playerStats.fouls}), 0)`,
      pir: sql<number>`COALESCE(SUM(${playerStats.pir}), 0)`,
      rowCount: sql<number>`COUNT(*)`,
      pirCount: sql<number>`COUNT(${playerStats.pir})`,
    })
    .from(playerStats)
    .where(and(eq(playerStats.teamId, statTeamId), eq(playerStats.seasonId, seasonId)));
  return agg ?? null;
}

// ─── Team overview ───────────────────────────────────────────────────────────

export async function getTeamOverview(teamId: number): Promise<TeamOverviewData | null> {
  const resolved = await resolveStatTeam(teamId);
  if (!resolved) return null;
  const { team, statTeam, season, league } = resolved;

  const base: TeamOverviewData = {
    teamId: team.id,
    teamName: team.name,
    logoUrl: team.logoUrl,
    league: league?.name ?? team.league,
    seasonName: season ? `${season.startYear}/${String(season.endYear).slice(2)}` : null,
    gamesPlayed: 0, wins: null, losses: null, winPct: null, rank: null,
    ppg: null, oppg: null, diff: null,
    fgPct: null, fg2Pct: null, fg3Pct: null, ftPct: null,
    offReb: 0, defReb: 0, totReb: 0, ast: 0, tov: 0, stl: 0, blk: 0, fouls: 0, pir: null,
    availability: {
      standings: false,
      record: false,
      rank: false,
      pointsFor: false,
      pointsAgainst: false,
      diff: false,
      playerStats: false,
    },
    provenance: {
      standings: "none",
      playerStats: "none",
    },
    updatedAt: new Date().toISOString(),
  };

  if (!statTeam || !season) return base;

  const [st] = await db
    .select()
    .from(standings)
    .where(and(eq(standings.teamId, statTeam.id), eq(standings.seasonId, season.id)));

  let standingsGp = st?.gamesPlayed ?? 0;
  let aggregateGp = getReliableAggregateGamesPlayed(st);
  if (aggregateGp === 0) {
    // No standings row — fall back to the roster's max games played so player-
    // stat aggregates (shooting %, rebounds, etc.) are still surfaced.
    const [mx] = await db
      .select({ gp: sql<number>`COALESCE(MAX(${playerStats.gamesPlayed}), 0)` })
      .from(playerStats)
      .where(and(eq(playerStats.teamId, statTeam.id), eq(playerStats.seasonId, season.id)));
    aggregateGp = Number(mx?.gp ?? 0);
    base.gamesPlayed = aggregateGp;
  }
  if (st) {
    base.gamesPlayed = standingsGp;
    const standingAvailability = assessStandingAvailability(st);
    base.availability.standings = standingAvailability.standings;
    base.availability.record = standingAvailability.record;
    base.availability.rank = standingAvailability.rank;
    base.availability.pointsFor = standingAvailability.pointsFor;
    base.availability.pointsAgainst = standingAvailability.pointsAgainst;
    base.availability.diff = standingAvailability.diff;
    base.provenance.standings = standingAvailability.provenance;
    if (base.availability.record) {
      base.wins = st.wins;
      base.losses = st.losses;
      base.winPct = st.winPct;
    }
    if (base.availability.rank) base.rank = st.rank;
    if (base.availability.pointsFor) base.ppg = st.pointsFor / standingsGp;
    if (base.availability.pointsAgainst) base.oppg = st.pointsAgainst / standingsGp;
    if (base.availability.diff) base.diff = st.pointDiff / standingsGp;
    base.updatedAt = st.updatedAt.toISOString();
  }

  const agg = await getTeamAggregate(statTeam.id, season.id);
  if (agg && Number(agg.rowCount) > 0 && aggregateGp > 0) {
    base.availability.playerStats = true;
    base.provenance.playerStats = "season_aggregate";
    const fgMade = agg.fg2Made + agg.fg3Made;
    const fgAtt = agg.fg2Att + agg.fg3Att;
    base.fgPct = fgAtt > 0 ? fgMade / fgAtt : null;
    base.fg2Pct = agg.fg2Att > 0 ? agg.fg2Made / agg.fg2Att : null;
    base.fg3Pct = agg.fg3Att > 0 ? agg.fg3Made / agg.fg3Att : null;
    base.ftPct = agg.ftAtt > 0 ? agg.ftMade / agg.ftAtt : null;
    base.offReb = agg.offReb / aggregateGp;
    base.defReb = agg.defReb / aggregateGp;
    base.totReb = agg.totReb / aggregateGp;
    base.ast = agg.ast / aggregateGp;
    base.tov = agg.tov / aggregateGp;
    base.stl = agg.stl / aggregateGp;
    base.blk = agg.blk / aggregateGp;
    base.fouls = agg.fouls / aggregateGp;
    base.pir = Number(agg.pirCount) > 0 ? agg.pir / aggregateGp : null;
  }
  return base;
}

// ─── Player stats table for a scouting team ──────────────────────────────────

export async function getTeamPlayerStats(teamId: number) {
  const resolved = await resolveStatTeam(teamId);
  const roster = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      position: playersTable.position,
      jerseyNumber: playersTable.jerseyNumber,
      photoUrl: playersTable.photoUrl,
      statPlayerExternalId: playersTable.statPlayerExternalId,
      height: playersTable.height,
      age: playersTable.age,
      nationality: playersTable.nationality,
    })
    .from(playersTable)
    .where(eq(playersTable.teamId, teamId))
    .orderBy(playersTable.jerseyNumber);

  if (!resolved?.statTeam || !resolved.season) {
    return { seasonName: null, players: roster.map((p) => ({ ...p, stats: null })) };
  }

  const stats = await db
    .select({
      externalId: syncPlayers.externalId,
      gamesPlayed: playerStats.gamesPlayed,
      minutesAvg: playerStats.minutesAvg,
      points: playerStats.points,
      rebounds: playerStats.rebounds,
      assists: playerStats.assists,
      steals: playerStats.steals,
      blocks: playerStats.blocks,
      turnovers: playerStats.turnovers,
      fg2Made: playerStats.fg2Made,
      fg2Att: playerStats.fg2Att,
      fg3Made: playerStats.fg3Made,
      fg3Att: playerStats.fg3Att,
      ftMade: playerStats.ftMade,
      ftAtt: playerStats.ftAtt,
      pir: playerStats.pir,
    })
    .from(playerStats)
    .innerJoin(syncPlayers, eq(syncPlayers.id, playerStats.playerId))
    .where(and(eq(playerStats.teamId, resolved.statTeam.id), eq(playerStats.seasonId, resolved.season.id)));

  const byExt = new Map(stats.map((s) => [s.externalId, s]));

  const players = roster.map((p) => {
    const s = p.statPlayerExternalId ? byExt.get(p.statPlayerExternalId) : null;
    if (!s || s.gamesPlayed === 0) return { ...p, stats: null };
    const gp = s.gamesPlayed;
    const fgAtt = s.fg2Att + s.fg3Att;
    const fgMade = s.fg2Made + s.fg3Made;
    return {
      ...p,
      stats: {
        gamesPlayed: gp,
        min: s.minutesAvg,
        pts: s.points / gp,
        reb: s.rebounds / gp,
        ast: s.assists / gp,
        stl: s.steals / gp,
        blk: s.blocks / gp,
        tov: s.turnovers / gp,
        fgPct: fgAtt > 0 ? fgMade / fgAtt : null,
        fg2Pct: s.fg2Att > 0 ? s.fg2Made / s.fg2Att : null,
        fg3Pct: s.fg3Att > 0 ? s.fg3Made / s.fg3Att : null,
        ftPct: s.ftAtt > 0 ? s.ftMade / s.ftAtt : null,
        pir: s.pir != null ? s.pir / gp : null,
        fg2Made: s.fg2Made, fg2Att: s.fg2Att,
        fg3Made: s.fg3Made, fg3Att: s.fg3Att,
        ftMade: s.ftMade, ftAtt: s.ftAtt,
      },
    };
  });

  return {
    seasonName: `${resolved.season.startYear}/${String(resolved.season.endYear).slice(2)}`,
    players,
  };
}

// ─── Trends from the games table (games involving a team name) ───────────────

export async function getTeamGameTrends(teamName: string, range: "last5" | "last10" | "season") {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(gamesTable)
    .where(
      and(
        or(eq(gamesTable.homeTeam, teamName), eq(gamesTable.awayTeam, teamName)),
        lte(gamesTable.date, today),
      ),
    )
    .orderBy(desc(gamesTable.date));

  const played = rows.filter((g) => g.homeScore != null && g.awayScore != null);
  const limit = range === "last5" ? 5 : range === "last10" ? 10 : played.length;
  const selectedGames = played.slice(0, limit).reverse();

  return selectedGames.map((g) => {
    const isHome = g.homeTeam === teamName;
    const pf = isHome ? g.homeScore! : g.awayScore!;
    const pa = isHome ? g.awayScore! : g.homeScore!;
    return {
      gameId: g.id,
      date: g.date,
      opponent: isHome ? g.awayTeam : g.homeTeam,
      isHome,
      pointsFor: pf,
      pointsAgainst: pa,
      diff: pf - pa,
      win: pf > pa,
    };
  });
}

// ─── Team vs league averages ─────────────────────────────────────────────────

export async function getTeamVsLeague(teamId: number) {
  const resolved = await resolveStatTeam(teamId);
  if (!resolved?.statTeam || !resolved.season) return null;
  const { statTeam, season, league } = resolved;

  const team = await getTeamOverview(teamId);
  if (!team) return null;

  // Compute standings averages only from fields that are genuinely available.
  // Historical BEV rows contain games and points-for, but use sentinel zeroes
  // for W/L, points-against and differential.
  const leagueStandingRows = await db
    .select()
    .from(standings)
    .where(eq(standings.seasonId, season.id));
  const average = (values: number[]): number | null =>
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const leaguePpg = average(
    leagueStandingRows
      .filter((row) => assessStandingAvailability(row).pointsFor)
      .map((row) => row.pointsFor / row.gamesPlayed),
  );
  const leagueOppg = average(
    leagueStandingRows
      .filter((row) => assessStandingAvailability(row).pointsAgainst)
      .map((row) => row.pointsAgainst / row.gamesPlayed),
  );
  const leagueWinPct = average(
    leagueStandingRows
      .filter((row) => assessStandingAvailability(row).record)
      .map((row) => row.winPct),
  );

  // League per-game averages from player_stats joined with each team's games played
  const perTeam = await db
    .select({
      teamId: playerStats.teamId,
      points: sql<number>`SUM(${playerStats.points})`,
      reb: sql<number>`SUM(${playerStats.rebounds})`,
      ast: sql<number>`SUM(${playerStats.assists})`,
      tov: sql<number>`SUM(${playerStats.turnovers})`,
      stl: sql<number>`SUM(${playerStats.steals})`,
      fg2Made: sql<number>`SUM(${playerStats.fg2Made})`,
      fg2Att: sql<number>`SUM(${playerStats.fg2Att})`,
      fg3Made: sql<number>`SUM(${playerStats.fg3Made})`,
      fg3Att: sql<number>`SUM(${playerStats.fg3Att})`,
      ftMade: sql<number>`SUM(${playerStats.ftMade})`,
      ftAtt: sql<number>`SUM(${playerStats.ftAtt})`,
    })
    .from(playerStats)
    .where(eq(playerStats.seasonId, season.id))
    .groupBy(playerStats.teamId);

  const gpByTeam = new Map(
    (
      await db
        .select({
          teamId: standings.teamId,
          gamesPlayed: standings.gamesPlayed,
          wins: standings.wins,
          losses: standings.losses,
        })
        .from(standings)
        .where(eq(standings.seasonId, season.id))
    ).map((row) => [row.teamId, getReliableAggregateGamesPlayed(row)]),
  );

  let sumReb = 0, sumAst = 0, sumTov = 0, sumStl = 0, n = 0;
  let fgMade = 0, fgAtt = 0, fg3Made = 0, fg3Att = 0, ftMade = 0, ftAtt = 0;
  for (const t of perTeam) {
    const gp = gpByTeam.get(t.teamId) ?? 0;
    if (gp <= 0) continue;
    sumReb += Number(t.reb) / gp;
    sumAst += Number(t.ast) / gp;
    sumTov += Number(t.tov) / gp;
    sumStl += Number(t.stl) / gp;
    n++;
    fgMade += Number(t.fg2Made) + Number(t.fg3Made);
    fgAtt += Number(t.fg2Att) + Number(t.fg3Att);
    fg3Made += Number(t.fg3Made);
    fg3Att += Number(t.fg3Att);
    ftMade += Number(t.ftMade);
    ftAtt += Number(t.ftAtt);
  }

  const plausibleAverage = (sum: number, count: number, min: number, max: number): number | null => {
    if (count === 0) return null;
    const value = sum / count;
    return value >= min && value <= max ? value : null;
  };

  return {
    leagueName: league?.name ?? null,
    seasonName: team.seasonName,
    team,
    league_: {
      ppg: leaguePpg,
      oppg: leagueOppg,
      winPct: leagueWinPct,
      reb: plausibleAverage(sumReb, n, 10, 80),
      ast: plausibleAverage(sumAst, n, 3, 45),
      tov: plausibleAverage(sumTov, n, 2, 40),
      stl: plausibleAverage(sumStl, n, 1, 25),
      fgPct: fgAtt > 0 ? fgMade / fgAtt : null,
      fg3Pct: fg3Att > 0 ? fg3Made / fg3Att : null,
      ftPct: ftAtt > 0 ? ftMade / ftAtt : null,
    },
  };
}

// ─── Automated insights ──────────────────────────────────────────────────────

export async function generateInsights(teamId: number): Promise<Array<{ id: string; text: string }>> {
  const overview = await getTeamOverview(teamId);
  if (!overview) return [];
  const insights: Array<{ id: string; text: string }> = [];
  const name = overview.teamName;
  const fmt = (v: number, d = 1) => v.toFixed(d);
  const pct = (v: number | null) => (v != null ? `${(v * 100).toFixed(1)}%` : null);

  if (overview.wins != null && overview.losses != null && overview.winPct != null) {
    insights.push({ id: "record", text: `${name} tiene un balance de ${overview.wins}V-${overview.losses}D (${(overview.winPct * 100).toFixed(0)}% de victorias)${overview.rank ? `, ocupando la posición ${overview.rank} de la clasificación` : ""}.` });
  }
  if (overview.ppg != null) {
    insights.push({
      id: "ppg",
      text: overview.oppg != null
        ? `${name} promedia ${fmt(overview.ppg)} puntos por partido y concede ${fmt(overview.oppg)}.`
        : `${name} promedia ${fmt(overview.ppg)} puntos por partido.`,
    });
  }
  if (overview.diff != null) {
    const diffTxt = overview.diff >= 0 ? `un diferencial positivo de +${fmt(overview.diff)}` : `un diferencial negativo de ${fmt(overview.diff)}`;
    insights.push({ id: "diff", text: `El equipo presenta ${diffTxt} puntos por partido.` });
  }
  if (overview.fg3Pct != null) {
    insights.push({ id: "fg3", text: `${name} convierte el ${pct(overview.fg3Pct)} de sus triples — ${overview.fg3Pct >= 0.33 ? "amenaza exterior real: cerrar las líneas de pase al perímetro" : "porcentaje exterior bajo: se puede conceder el tiro de tres"}.` });
  }
  if (overview.ftPct != null) {
    insights.push({ id: "ft", text: `Desde la línea de tiros libres convierte el ${pct(overview.ftPct)}${overview.ftPct < 0.68 ? " — hacer faltas tácticas al final puede ser rentable" : ""}.` });
  }
  if (overview.tov > 0) {
    insights.push({ id: "tov", text: `Pierde ${fmt(overview.tov)} balones por partido — ${overview.tov >= 15 ? "presionar la subida de balón puede forzar pérdidas" : "equipo cuidadoso con el balón"}.` });
  }
  if (overview.totReb > 0) {
    insights.push({ id: "reb", text: `Captura ${fmt(overview.totReb)} rebotes por partido (${fmt(overview.offReb)} ofensivos): ${overview.offReb >= 11 ? "es clave cerrar el rebote tras cada tiro" : "no domina especialmente el rebote ofensivo"}.` });
  }

  // Top scorer
  const { players } = await getTeamPlayerStats(teamId);
  const withStats = players.filter((p) => p.stats != null);
  if (withStats.length > 0) {
    const top = withStats.slice().sort((a, b) => (b.stats!.pts ?? 0) - (a.stats!.pts ?? 0))[0]!;
    insights.push({ id: "topscorer", text: `${top.name} es su máxima anotadora con ${fmt(top.stats!.pts)} puntos por partido${top.stats!.fg3Pct != null && top.stats!.fg3Pct > 0.35 ? ` y un ${pct(top.stats!.fg3Pct)} en triples` : ""}.` });
    const topPir = withStats.slice().sort((a, b) => (b.stats!.pir ?? -99) - (a.stats!.pir ?? -99))[0]!;
    if (topPir.id !== top.id && topPir.stats!.pir != null) {
      insights.push({ id: "toppir", text: `${topPir.name} es la jugadora más valorada (${fmt(topPir.stats!.pir!)} de valoración media).` });
    }
  }

  return insights.slice(0, 8);
}
