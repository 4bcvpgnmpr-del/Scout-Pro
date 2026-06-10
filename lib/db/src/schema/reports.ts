import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  gameId: integer("game_id"),
  scoutName: text("scout_name").notNull(),
  date: date("date", { mode: "string" }).notNull().default("2026-06-10"),
  rating: integer("rating").notNull(),
  offensiveRating: integer("offensive_rating"),
  defensiveRating: integer("defensive_rating"),
  athleticismRating: integer("athleticism_rating"),
  iQRating: integer("iq_rating"),
  points: integer("points"),
  rebounds: integer("rebounds"),
  assists: integer("assists"),
  steals: integer("steals"),
  blocks: integer("blocks"),
  turnovers: integer("turnovers"),
  minutesPlayed: integer("minutes_played"),
  fieldGoalsMade: integer("field_goals_made"),
  fieldGoalsAttempted: integer("field_goals_attempted"),
  threesMade: integer("threes_made"),
  threesAttempted: integer("threes_attempted"),
  freeThrowsMade: integer("free_throws_made"),
  freeThrowsAttempted: integer("free_throws_attempted"),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  summary: text("summary"),
  recommendation: text("recommendation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
