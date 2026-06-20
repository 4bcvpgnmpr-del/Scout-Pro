/**
 * ScoutFlow — EuroLeague / EuroCup API Client
 * EuroLeague expone una API JSON pública (no oficial pero estable)
 * Endpoint base: https://api-live.euroleague.net
 *
 * Cubre: EuroLeague (E) y EuroCup (U)
 */

const BASE = "https://api-live.euroleague.net/v3";

// ─── Types ──────────────────────────────────────────────────────────────────

export type EuroComp = "E" | "U";

export interface EuroPlayerStat {
  competitionCode: EuroComp;
  season: string;
  playerCode: string;
  playerName: string;
  teamCode: string;
  teamName: string;
  gamesPlayed: number;
  minutesPlayed: number;
  points: number;
  twoPointsMade: number;
  twoPointsAttempted: number;
  threePointsMade: number;
  threePointsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  totalRebounds: number;
  assists: number;
  steals: number;
  turnovers: number;
  blocksAgainst: number;
  pir: number;
}

export interface EuroStanding {
  competitionCode: EuroComp;
  season: string;
  groupName: string;
  position: number;
  clubCode: string;
  clubName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

// ─── Season helper ───────────────────────────────────────────────────────────

function currentSeason(comp: EuroComp): string {
  const year = new Date().getFullYear();
  return `${comp}${year - 1}`;
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`EuroLeague API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ─── Player stats ────────────────────────────────────────────────────────────

export async function fetchEuroLeaguePlayerStats(
  comp: EuroComp = "E",
  season?: string,
): Promise<EuroPlayerStat[]> {
  const s = season ?? currentSeason(comp);
  const data = await apiFetch<any>(
    `/competitions/${comp}/seasons/${s}/people/statistics/totals`,
  );

  const players = data?.data ?? data?.players ?? [];

  return players.map((p: any) => ({
    competitionCode: comp,
    season: s,
    playerCode:   p.player?.code ?? p.playerCode ?? "",
    playerName:   `${p.player?.name ?? ""} ${p.player?.alias ?? ""}`.trim(),
    teamCode:     p.team?.code ?? p.teamCode ?? "",
    teamName:     p.team?.name ?? p.teamName ?? "",
    gamesPlayed:          p.timePlayed?.gamesPlayed     ?? 0,
    minutesPlayed:        p.timePlayed?.minutes         ?? 0,
    points:               p.pointsScored               ?? 0,
    twoPointsMade:        p.twoPointersMade            ?? 0,
    twoPointsAttempted:   p.twoPointersAttempted       ?? 0,
    threePointsMade:      p.threePointersMade          ?? 0,
    threePointsAttempted: p.threePointersAttempted     ?? 0,
    freeThrowsMade:       p.freeThrowsMade             ?? 0,
    freeThrowsAttempted:  p.freeThrowsAttempted        ?? 0,
    offensiveRebounds:    p.offensiveRebounds           ?? 0,
    defensiveRebounds:    p.defensiveRebounds           ?? 0,
    totalRebounds:        p.totalRebounds               ?? 0,
    assists:              p.assists                    ?? 0,
    steals:               p.steals                     ?? 0,
    turnovers:            p.turnovers                  ?? 0,
    blocksAgainst:        p.blocksAgainst              ?? 0,
    pir:                  p.valueIndex                 ?? 0,
  }));
}

// ─── Standings ───────────────────────────────────────────────────────────────

export async function fetchEuroLeagueStandings(
  comp: EuroComp = "E",
  season?: string,
): Promise<EuroStanding[]> {
  const s = season ?? currentSeason(comp);
  const data = await apiFetch<any>(
    `/competitions/${comp}/seasons/${s}/standings`,
  );

  const groups = data?.data?.groups ?? data?.groups ?? [
    { groupName: "Liga", clubs: data?.clubs ?? [] },
  ];

  return groups.flatMap((g: any) =>
    (g.clubs ?? []).map((c: any, i: number) => ({
      competitionCode: comp,
      season: s,
      groupName:    g.groupName ?? "Liga",
      position:     c.position ?? i + 1,
      clubCode:     c.club?.code ?? c.clubCode ?? "",
      clubName:     c.club?.name ?? c.clubName ?? "",
      gamesPlayed:  c.gamesPlayed  ?? 0,
      wins:         c.wins         ?? 0,
      losses:       c.losses       ?? 0,
      pointsFor:    c.pointsScored ?? 0,
      pointsAgainst: c.pointsAgainst ?? 0,
    })),
  );
}

// ─── Convenience: fetch both leagues ─────────────────────────────────────────

export async function fetchAllEuroLeagues() {
  const [elStats, elStandings, ecStats, ecStandings] = await Promise.allSettled([
    fetchEuroLeaguePlayerStats("E"),
    fetchEuroLeagueStandings("E"),
    fetchEuroLeaguePlayerStats("U"),
    fetchEuroLeagueStandings("U"),
  ]);

  return {
    euroLeague: {
      stats:     elStats.status === "fulfilled"     ? elStats.value     : [],
      standings: elStandings.status === "fulfilled" ? elStandings.value : [],
    },
    euroCup: {
      stats:     ecStats.status === "fulfilled"     ? ecStats.value     : [],
      standings: ecStandings.status === "fulfilled" ? ecStandings.value : [],
    },
  };
}
