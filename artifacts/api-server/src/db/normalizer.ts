import { db } from "@workspace/db";
import {
  leagues, seasons, syncTeams, syncPlayers, playerStats, standings,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type { CompeticionData } from "../scrapers/feb-scraper.js";
import type { EuroPlayerStat, EuroStanding } from "../scrapers/euroleague.client.js";
import { logger } from "../lib/logger.js";

// ─── In-run caches (reset between sync runs) ─────────────────────────────────

const _leagueCache = new Map<string, string>();
const _seasonCache = new Map<string, string>();
const _teamCache   = new Map<string, string>();
const _playerCache = new Map<string, string>();

export function clearNormalizerCaches() {
  _leagueCache.clear();
  _seasonCache.clear();
  _teamCache.clear();
  _playerCache.clear();
}

// ─── Season helpers ───────────────────────────────────────────────────────────

function febSeasonYears(): { startYear: number; endYear: number } {
  const now = new Date();
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 7 ? year : year - 1;
  return { startYear, endYear: startYear + 1 };
}

function euroSeasonYears(code: string): { startYear: number; endYear: number } {
  const m = code.match(/(\d{4})/);
  const startYear = m ? parseInt(m[1], 10) : new Date().getFullYear() - 1;
  return { startYear, endYear: startYear + 1 };
}

// ─── Find-or-create helpers ───────────────────────────────────────────────────

async function findOrCreateLeague(opts: {
  name: string;
  shortName: string;
  source: "feb" | "euroleague" | "eurocup";
  externalId: string;
  gender?: string;
}): Promise<string> {
  const key = `${opts.source}:${opts.externalId}`;
  if (_leagueCache.has(key)) return _leagueCache.get(key)!;

  let row = await db.query.leagues.findFirst({
    where: (l, { and, eq: eq_ }) =>
      and(eq_(l.source, opts.source), eq_(l.externalId, opts.externalId)),
  });

  if (!row) {
    const inserted = await db
      .insert(leagues)
      .values({
        name:       opts.name,
        shortName:  opts.shortName,
        source:     opts.source,
        externalId: opts.externalId,
        country:    opts.source === "euroleague" || opts.source === "eurocup" ? "EU" : "ES",
        gender:     opts.gender ?? "M",
      })
      .onConflictDoNothing()
      .returning();
    row = inserted[0] ?? await db.query.leagues.findFirst({
      where: (l, { and, eq: eq_ }) =>
        and(eq_(l.source, opts.source), eq_(l.externalId, opts.externalId)),
    });
  }

  const id = row!.id;
  _leagueCache.set(key, id);
  return id;
}

async function findOrCreateSeason(
  leagueId: string,
  startYear: number,
  endYear: number,
): Promise<string> {
  const key = `${leagueId}:${startYear}`;
  if (_seasonCache.has(key)) return _seasonCache.get(key)!;

  let row = await db.query.seasons.findFirst({
    where: (s, { and, eq: eq_ }) =>
      and(eq_(s.leagueId, leagueId), eq_(s.startYear, startYear)),
  });

  if (!row) {
    const inserted = await db
      .insert(seasons)
      .values({
        leagueId,
        name:      `${startYear}-${String(endYear).slice(-2)}`,
        startYear,
        endYear,
        isCurrent: true,
      })
      .onConflictDoNothing()
      .returning();
    row = inserted[0] ?? await db.query.seasons.findFirst({
      where: (s, { and, eq: eq_ }) =>
        and(eq_(s.leagueId, leagueId), eq_(s.startYear, startYear)),
    });
  }

  const id = row!.id;
  _seasonCache.set(key, id);
  return id;
}

async function findOrCreateTeam(
  leagueId: string,
  externalId: string,
  name: string,
): Promise<string> {
  const key = `${leagueId}:${externalId}`;
  if (_teamCache.has(key)) return _teamCache.get(key)!;

  let row = await db.query.syncTeams.findFirst({
    where: (t, { and, eq: eq_ }) =>
      and(eq_(t.leagueId, leagueId), eq_(t.externalId, externalId)),
  });

  if (!row) {
    const inserted = await db
      .insert(syncTeams)
      .values({
        leagueId,
        name,
        shortName:  externalId.slice(0, 10),
        externalId,
      })
      .onConflictDoNothing()
      .returning();
    row = inserted[0] ?? await db.query.syncTeams.findFirst({
      where: (t, { and, eq: eq_ }) =>
        and(eq_(t.leagueId, leagueId), eq_(t.externalId, externalId)),
    });
  }

  const id = row!.id;
  _teamCache.set(key, id);
  return id;
}

async function findOrCreatePlayer(externalId: string, fullName: string): Promise<string> {
  if (_playerCache.has(externalId)) return _playerCache.get(externalId)!;

  let row = await db.query.syncPlayers.findFirst({
    where: (p, { eq: eq_ }) => eq_(p.externalId, externalId),
  });

  if (!row) {
    const parts     = fullName.trim().split(/\s+/);
    const lastName  = parts.length > 1 ? parts.slice(-1)[0] : fullName;
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : fullName;
    const inserted  = await db
      .insert(syncPlayers)
      .values({ externalId, firstName, lastName })
      .onConflictDoNothing()
      .returning();
    row = inserted[0] ?? await db.query.syncPlayers.findFirst({
      where: (p, { eq: eq_ }) => eq_(p.externalId, externalId),
    });
  }

  const id = row!.id;
  _playerCache.set(externalId, id);
  return id;
}

// ─── Standings upsert (handles NULL group safely) ────────────────────────────
// PostgreSQL does NOT match NULL = NULL in unique indexes, so ON CONFLICT
// won't fire when group IS NULL. We do a manual select → insert/update instead.

async function upsertStanding(data: {
  teamId:        string;
  seasonId:      string;
  group:         string | null;
  rank:          number;
  gamesPlayed:   number;
  wins:          number;
  losses:        number;
  winPct:        number;
  pointsFor:     number;
  pointsAgainst: number;
  pointDiff:     number;
}) {
  const existing = await db.query.standings.findFirst({
    where: (s, { and, eq: eq_, isNull }) =>
      and(
        eq_(s.teamId,   data.teamId),
        eq_(s.seasonId, data.seasonId),
        data.group != null ? eq_(s.group, data.group) : isNull(s.group),
      ),
  });

  const payload = {
    rank:          data.rank,
    gamesPlayed:   data.gamesPlayed,
    wins:          data.wins,
    losses:        data.losses,
    winPct:        data.winPct,
    pointsFor:     data.pointsFor,
    pointsAgainst: data.pointsAgainst,
    pointDiff:     data.pointDiff,
    updatedAt:     new Date(),
  };

  if (existing) {
    await db.update(standings).set(payload).where(eq(standings.id, existing.id));
  } else {
    await db
      .insert(standings)
      .values({ teamId: data.teamId, seasonId: data.seasonId, group: data.group, ...payload })
      .onConflictDoNothing();
  }
}

// ─── FEB normalizers ──────────────────────────────────────────────────────────

export async function normalizeFebStats(
  ligaId: string,
  data: CompeticionData,
): Promise<number> {
  if (!data.clasificacion?.length) return 0;

  const isFem =
    data.liga.startsWith("LF") || data.liga.toLowerCase().includes("femenin");

  const leagueId = await findOrCreateLeague({
    name:       data.liga,
    shortName:  ligaId,
    source:     "feb",
    externalId: ligaId,
    gender:     isFem ? "F" : "M",
  });

  const { startYear, endYear } = febSeasonYears();
  const seasonId = await findOrCreateSeason(leagueId, startYear, endYear);

  let count = 0;
  for (const row of data.clasificacion) {
    if (!row.equipo) continue;
    const externalId = row.equipo.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const teamId     = await findOrCreateTeam(leagueId, externalId, row.equipo);

    await upsertStanding({
      teamId,
      seasonId,
      group:         null,
      rank:          row.posicion,
      gamesPlayed:   row.pj,
      wins:          row.pg,
      losses:        row.pp,
      winPct:        row.pj > 0 ? row.pg / row.pj : 0,
      pointsFor:     row.pf,
      pointsAgainst: row.pc,
      pointDiff:     row.pf - row.pc,
    });
    count++;
  }

  logger.info({ liga: data.liga, rows: count }, "[normalizer] FEB standings upserted");
  return count;
}

// FEB scraper gives standings only — alias kept so sync job can call both names.
export const normalizeFebStanding = normalizeFebStats;

// ─── EuroLeague normalizers ───────────────────────────────────────────────────

const EURO_META: Record<string, { name: string; source: "euroleague" | "eurocup" }> = {
  E: { name: "EuroLeague", source: "euroleague" },
  U: { name: "EuroCup",    source: "eurocup"    },
};

export async function normalizeEuroStats(stat: EuroPlayerStat): Promise<void> {
  if (!stat.playerCode || !stat.teamCode) return;

  const meta     = EURO_META[stat.competitionCode] ?? { name: "EuroLeague", source: "euroleague" as const };
  const leagueId = await findOrCreateLeague({
    name: meta.name, shortName: stat.competitionCode,
    source: meta.source, externalId: stat.competitionCode, gender: "M",
  });

  const { startYear, endYear } = euroSeasonYears(stat.season);
  const seasonId = await findOrCreateSeason(leagueId, startYear, endYear);
  const teamId   = await findOrCreateTeam(leagueId, stat.teamCode, stat.teamName || stat.teamCode);
  const playerId = await findOrCreatePlayer(stat.playerCode, stat.playerName || stat.playerCode);

  const existing = await db.query.playerStats.findFirst({
    where: (ps, { and, eq: eq_ }) =>
      and(eq_(ps.playerId, playerId), eq_(ps.teamId, teamId), eq_(ps.seasonId, seasonId)),
  });

  const payload = {
    gamesPlayed:     stat.gamesPlayed,
    minutesTotal:    stat.minutesPlayed,
    minutesAvg:      stat.gamesPlayed > 0 ? stat.minutesPlayed / stat.gamesPlayed : 0,
    points:          stat.points,
    fg2Made:         stat.twoPointsMade,
    fg2Att:          stat.twoPointsAttempted,
    fg3Made:         stat.threePointsMade,
    fg3Att:          stat.threePointsAttempted,
    ftMade:          stat.freeThrowsMade,
    ftAtt:           stat.freeThrowsAttempted,
    offRebounds:     stat.offensiveRebounds,
    defRebounds:     stat.defensiveRebounds,
    rebounds:        stat.totalRebounds,
    assists:         stat.assists,
    steals:          stat.steals,
    blocks:          stat.blocksAgainst,
    turnovers:       stat.turnovers,
    fouls:           0,
    pir:             stat.pir,
    dataEntryMethod: "scraped" as const,
    scrapedAt:       new Date(),
    updatedAt:       new Date(),
  };

  if (existing) {
    await db.update(playerStats).set(payload).where(eq(playerStats.id, existing.id));
  } else {
    await db
      .insert(playerStats)
      .values({ playerId, teamId, seasonId, ...payload })
      .onConflictDoNothing();
  }
}

export async function normalizeEuroStanding(standing: EuroStanding): Promise<void> {
  if (!standing.clubCode) return;

  const meta     = EURO_META[standing.competitionCode] ?? { name: "EuroLeague", source: "euroleague" as const };
  const leagueId = await findOrCreateLeague({
    name: meta.name, shortName: standing.competitionCode,
    source: meta.source, externalId: standing.competitionCode, gender: "M",
  });

  const { startYear, endYear } = euroSeasonYears(standing.season);
  const seasonId = await findOrCreateSeason(leagueId, startYear, endYear);
  const teamId   = await findOrCreateTeam(leagueId, standing.clubCode, standing.clubName || standing.clubCode);

  await upsertStanding({
    teamId,
    seasonId,
    group:         standing.groupName ?? null,
    rank:          standing.position,
    gamesPlayed:   standing.gamesPlayed,
    wins:          standing.wins,
    losses:        standing.losses,
    winPct:        standing.gamesPlayed > 0 ? standing.wins / standing.gamesPlayed : 0,
    pointsFor:     standing.pointsFor,
    pointsAgainst: standing.pointsAgainst,
    pointDiff:     standing.pointsFor - standing.pointsAgainst,
  });
}
