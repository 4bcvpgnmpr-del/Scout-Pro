/**
 * ScoutFlow — Advanced Basketball Stats Calculations
 * Todas las fórmulas son las estándar usadas por Basketball-Reference y Data4Basket
 */

// ─── Shooting efficiency ──────────────────────────────────────────────────────

/** True Shooting % = PTS / (2 * (FGA + 0.44 * FTA)) */
export const calcTS = (pts: number, fga: number, fta: number): number => {
  const denom = 2 * (fga + 0.44 * fta);
  return denom === 0 ? 0 : (pts / denom) * 100;
};

/** Effective FG% = (FGM + 0.5 * 3PM) / FGA */
export const calcEFG = (fgm: number, fg3m: number, fga: number): number =>
  fga === 0 ? 0 : ((fgm + 0.5 * fg3m) / fga) * 100;

/** 3-Point Attempt Rate = 3PA / FGA */
export const calc3PAr = (fg3a: number, fga: number): number =>
  fga === 0 ? 0 : (fg3a / fga) * 100;

/** Free Throw Rate = FTA / FGA */
export const calcFTr = (fta: number, fga: number): number =>
  fga === 0 ? 0 : (fta / fga) * 100;

// ─── Usage & creation ─────────────────────────────────────────────────────────

/**
 * Usage Rate = 100 * (FGA + 0.44*FTA + TOV) * (TmMP/5)
 *              / (MP * (TmFGA + 0.44*TmFTA + TmTOV))
 */
export const calcUsage = (
  fga: number, fta: number, tov: number, mp: number,
  tmFga: number, tmFta: number, tmTov: number, tmMp: number,
): number => {
  const denom = mp * (tmFga + 0.44 * tmFta + tmTov);
  return denom === 0 ? 0 : (100 * (fga + 0.44 * fta + tov) * (tmMp / 5)) / denom;
};

/** Assist Rate = 100 * AST / (((MP / (TmMP/5)) * TmFGM) - FGM) */
export const calcASTr = (
  ast: number, mp: number, tmMp: number, tmFgm: number, fgm: number,
): number => {
  const denom = ((mp / (tmMp / 5)) * tmFgm) - fgm;
  return denom === 0 ? 0 : (100 * ast) / denom;
};

/** Turnover Rate = 100 * TOV / (FGA + 0.44 * FTA + TOV) */
export const calcTOVr = (tov: number, fga: number, fta: number): number => {
  const denom = fga + 0.44 * fta + tov;
  return denom === 0 ? 0 : (100 * tov) / denom;
};

// ─── Ratings ──────────────────────────────────────────────────────────────────

/** Possessions (simplified) = FGA - ORB + TOV + 0.44 * FTA */
export const calcPossessions = (
  fga: number, orb: number, tov: number, fta: number,
): number => fga - orb + tov + 0.44 * fta;

/** Offensive Rating = PTS per 100 possessions */
export const calcORTG = (pts: number, possessions: number): number =>
  possessions === 0 ? 0 : (pts / possessions) * 100;

/** Net Rating = ORTG - DRTG */
export const calcNetRating = (ortg: number, drtg: number): number => ortg - drtg;

// ─── Rebounding ───────────────────────────────────────────────────────────────

/** Offensive Rebound % = ORB * (TmMP/5) / (MP * (TmORB + OppDRB)) */
export const calcORBpct = (
  orb: number, mp: number, tmMp: number, tmOrb: number, oppDrb: number,
): number => {
  const denom = mp * (tmOrb + oppDrb);
  return denom === 0 ? 0 : (orb * (tmMp / 5) * 100) / denom;
};

/** Defensive Rebound % = DRB * (TmMP/5) / (MP * (TmDRB + OppORB)) */
export const calcDRBpct = (
  drb: number, mp: number, tmMp: number, tmDrb: number, oppOrb: number,
): number => {
  const denom = mp * (tmDrb + oppOrb);
  return denom === 0 ? 0 : (drb * (tmMp / 5) * 100) / denom;
};

// ─── Composite / PER simplification ──────────────────────────────────────────

/**
 * ScoutFlow Efficiency Score (SES) — simplified composite
 * SES = PTS + 1.5*AST + REB - TOV - (FGA - FGM) * 0.5
 */
export const calcSES = (
  pts: number, ast: number, reb: number,
  tov: number, fga: number, fgm: number,
): number => pts + 1.5 * ast + reb - tov - (fga - fgm) * 0.5;

// ─── Formatting helpers ───────────────────────────────────────────────────────

export const fmtPct  = (v: number, d = 1) => `${v.toFixed(d)}%`;
export const fmtSign = (v: number, d = 1) =>
  `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;
export const fmtInt  = (v: number) => Math.round(v).toString();
