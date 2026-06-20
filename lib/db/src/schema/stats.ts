import {
  pgTable, uuid, text, integer, real, boolean,
  timestamp, uniqueIndex, index, pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const dataEntryMethodEnum = pgEnum("data_entry_method", [
  "scraped",
  "manual",
]);

// ─── Enums ───────────────────────────────────────────────────────────────────

export const leagueSourceEnum = pgEnum("league_source", [
  "feb", "acb", "euroleague", "eurocup", "manual",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "pending", "running", "success", "error",
]);

// ─── Leagues ─────────────────────────────────────────────────────────────────

export const leagues = pgTable("stat_leagues", {
  id:         uuid("id").primaryKey().defaultRandom(),
  name:       text("name").notNull(),
  shortName:  text("short_name").notNull(),
  source:     leagueSourceEnum("source").notNull(),
  externalId: text("external_id"),
  country:    text("country").notNull().default("ES"),
  gender:     text("gender").notNull().default("M"),
  level:      integer("level").notNull().default(1),
  isActive:     boolean("is_active").notNull().default(true),
  isAutomated:  boolean("is_automated").notNull().default(false),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  sourceExtIdx: uniqueIndex("stat_leagues_source_ext_idx").on(t.source, t.externalId),
}));

// ─── Stat Teams (external league teams, separate from scouting teams) ────────

export const syncTeams = pgTable("stat_teams", {
  id:         uuid("id").primaryKey().defaultRandom(),
  leagueId:   uuid("league_id").notNull().references(() => leagues.id),
  name:       text("name").notNull(),
  shortName:  text("short_name"),
  externalId: text("external_id"),
  city:       text("city"),
  logoUrl:    text("logo_url"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  leagueExtIdx: uniqueIndex("stat_teams_league_ext_idx").on(t.leagueId, t.externalId),
}));

// ─── Stat Players (external league players, separate from scouting players) ──

export const syncPlayers = pgTable("stat_players", {
  id:          uuid("id").primaryKey().defaultRandom(),
  externalId:  text("external_id"),
  firstName:   text("first_name").notNull(),
  lastName:    text("last_name").notNull(),
  nationality: text("nationality"),
  position:    text("position"),
  birthDate:   timestamp("birth_date"),
  height:      integer("height"),
  weight:      integer("weight"),
  photoUrl:    text("photo_url"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  externalIdx: index("stat_players_external_idx").on(t.externalId),
}));

// ─── Seasons ─────────────────────────────────────────────────────────────────

export const seasons = pgTable("stat_seasons", {
  id:        uuid("id").primaryKey().defaultRandom(),
  leagueId:  uuid("league_id").notNull().references(() => leagues.id),
  name:      text("name").notNull(),
  startYear: integer("start_year").notNull(),
  endYear:   integer("end_year").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
}, (t) => ({
  leagueYearIdx: uniqueIndex("stat_seasons_league_year_idx").on(t.leagueId, t.startYear),
}));

// ─── Player Stats ─────────────────────────────────────────────────────────────

export const playerStats = pgTable("player_stats", {
  id:          uuid("id").primaryKey().defaultRandom(),
  playerId:    uuid("player_id").notNull().references(() => syncPlayers.id),
  teamId:      uuid("team_id").notNull().references(() => syncTeams.id),
  seasonId:    uuid("season_id").notNull().references(() => seasons.id),

  gamesPlayed:  integer("games_played").notNull().default(0),
  minutesTotal: real("minutes_total").notNull().default(0),
  minutesAvg:   real("minutes_avg").notNull().default(0),

  points:      real("points").notNull().default(0),
  fg2Made:     real("fg2_made").notNull().default(0),
  fg2Att:      real("fg2_att").notNull().default(0),
  fg3Made:     real("fg3_made").notNull().default(0),
  fg3Att:      real("fg3_att").notNull().default(0),
  ftMade:      real("ft_made").notNull().default(0),
  ftAtt:       real("ft_att").notNull().default(0),

  offRebounds: real("off_rebounds").notNull().default(0),
  defRebounds: real("def_rebounds").notNull().default(0),
  rebounds:    real("rebounds").notNull().default(0),
  assists:     real("assists").notNull().default(0),
  steals:      real("steals").notNull().default(0),
  blocks:      real("blocks").notNull().default(0),
  turnovers:   real("turnovers").notNull().default(0),
  fouls:       real("fouls").notNull().default(0),

  tsPercent:   real("ts_percent"),
  efgPercent:  real("efg_percent"),
  usageRate:   real("usage_rate"),
  pir:         real("pir"),

  dataEntryMethod: dataEntryMethodEnum("data_entry_method").notNull().default("manual"),
  scrapedAt:   timestamp("scraped_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uniquePlayerSeason: uniqueIndex("player_stats_player_team_season_idx")
    .on(t.playerId, t.teamId, t.seasonId),
}));

// ─── Standings ────────────────────────────────────────────────────────────────

export const standings = pgTable("stat_standings", {
  id:           uuid("id").primaryKey().defaultRandom(),
  teamId:       uuid("team_id").notNull().references(() => syncTeams.id),
  seasonId:     uuid("season_id").notNull().references(() => seasons.id),
  group:        text("group"),

  rank:         integer("rank").notNull(),
  gamesPlayed:  integer("games_played").notNull().default(0),
  wins:         integer("wins").notNull().default(0),
  losses:       integer("losses").notNull().default(0),
  winPct:       real("win_pct").notNull().default(0),
  pointsFor:    integer("points_for").notNull().default(0),
  pointsAgainst: integer("points_against").notNull().default(0),
  pointDiff:    integer("point_diff").notNull().default(0),

  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  teamSeasonIdx: uniqueIndex("stat_standings_team_season_group_idx")
    .on(t.teamId, t.seasonId, t.group),
}));

// ─── Sync Log ─────────────────────────────────────────────────────────────────

export const syncLog = pgTable("sync_log", {
  id:               uuid("id").primaryKey().defaultRandom(),
  leagueId:         uuid("league_id").references(() => leagues.id),
  source:           leagueSourceEnum("source").notNull(),
  status:           syncStatusEnum("status").notNull().default("pending"),
  recordsProcessed: integer("records_processed").default(0),
  errorMessage:     text("error_message"),
  startedAt:        timestamp("started_at").notNull().defaultNow(),
  finishedAt:       timestamp("finished_at"),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const leaguesRelations = relations(leagues, ({ many }) => ({
  syncTeams: many(syncTeams),
  seasons:   many(seasons),
}));

export const syncTeamsRelations = relations(syncTeams, ({ one, many }) => ({
  league:      one(leagues,    { fields: [syncTeams.leagueId], references: [leagues.id] }),
  playerStats: many(playerStats),
  standings:   many(standings),
}));

export const syncPlayersRelations = relations(syncPlayers, ({ many }) => ({
  stats: many(playerStats),
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  league:      one(leagues, { fields: [seasons.leagueId], references: [leagues.id] }),
  playerStats: many(playerStats),
  standings:   many(standings),
}));

export const playerStatsRelations = relations(playerStats, ({ one }) => ({
  player: one(syncPlayers, { fields: [playerStats.playerId], references: [syncPlayers.id] }),
  team:   one(syncTeams,   { fields: [playerStats.teamId],   references: [syncTeams.id]   }),
  season: one(seasons,     { fields: [playerStats.seasonId], references: [seasons.id]     }),
}));

export const standingsRelations = relations(standings, ({ one }) => ({
  team:   one(syncTeams, { fields: [standings.teamId],   references: [syncTeams.id] }),
  season: one(seasons,   { fields: [standings.seasonId], references: [seasons.id]  }),
}));

export const syncLogRelations = relations(syncLog, ({ one }) => ({
  league: one(leagues, { fields: [syncLog.leagueId], references: [leagues.id] }),
}));
