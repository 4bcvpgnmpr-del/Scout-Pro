export interface StandingAvailabilityInput {
  gamesPlayed: number;
  wins: number;
  losses: number;
  rank: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface StandingAvailability {
  standings: boolean;
  record: boolean;
  rank: boolean;
  pointsFor: boolean;
  pointsAgainst: boolean;
  diff: boolean;
  provenance: "official" | "partial" | "none";
}

const MIN_PLAUSIBLE_BASKETBALL_SCORE = 20;
const MAX_PLAUSIBLE_BASKETBALL_SCORE = 200;

/**
 * Distinguishes real zeroes from the sentinel zeroes used by historical BEV
 * imports. BEV supplies games and points-for, but not W/L, rank or defensive
 * scoring. In a completed basketball game, W+L must equal games played and a
 * team cannot have conceded zero total points across a non-empty season.
 */
export function assessStandingAvailability(
  standing: StandingAvailabilityInput | null | undefined,
): StandingAvailability {
  if (!standing || standing.gamesPlayed <= 0) {
    return {
      standings: false,
      record: false,
      rank: false,
      pointsFor: false,
      pointsAgainst: false,
      diff: false,
      provenance: "none",
    };
  }

  const record = standing.wins + standing.losses === standing.gamesPlayed;
  const partialBev =
    standing.wins === 0 &&
    standing.losses === 0 &&
    standing.rank === 0 &&
    standing.pointsAgainst === 0 &&
    standing.pointsFor > 0;
  const ppg = standing.pointsFor / standing.gamesPlayed;
  const oppg = standing.pointsAgainst / standing.gamesPlayed;
  const pointsFor =
    (record || partialBev) &&
    ppg >= MIN_PLAUSIBLE_BASKETBALL_SCORE &&
    ppg <= MAX_PLAUSIBLE_BASKETBALL_SCORE;
  const pointsAgainst =
    record &&
    oppg >= MIN_PLAUSIBLE_BASKETBALL_SCORE &&
    oppg <= MAX_PLAUSIBLE_BASKETBALL_SCORE;
  const rank = standing.rank > 0;
  const diff = pointsFor && pointsAgainst;

  return {
    standings: true,
    record,
    rank,
    pointsFor,
    pointsAgainst,
    diff,
    provenance: record && pointsAgainst ? "official" : "partial",
  };
}

/**
 * Returns the least-surprising denominator for totals derived from player
 * rows. Normal standings use gamesPlayed. A malformed mixed row may retain a
 * complete W/L total while gamesPlayed was overwritten with a single result;
 * in that case W+L avoids multiplying all player averages by ~30.
 */
export function getReliableAggregateGamesPlayed(
  standing: Pick<StandingAvailabilityInput, "gamesPlayed" | "wins" | "losses"> | null | undefined,
): number {
  if (!standing) return 0;
  return Math.max(standing.gamesPlayed, standing.wins + standing.losses);
}