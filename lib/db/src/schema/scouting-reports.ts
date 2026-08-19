import { pgTable, text, integer, timestamp, boolean, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── scouting_reports ─────────────────────────────────────────────────────────
export const scoutingReportsTable = pgTable("scouting_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  teamId: integer("team_id"),
  opponentId: integer("opponent_id"),
  gameId: integer("game_id"),
  scoutName: text("scout_name"),
  season: text("season"),
  status: text("status").notNull().default("draft"), // draft | in_progress | finalized
  coverConfig: jsonb("cover_config").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── report_sections ──────────────────────────────────────────────────────────
export const reportSectionsTable = pgTable("report_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => scoutingReportsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // team_overview | match_stats | player_stats | tactical | plays | videos | game_plan | custom
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  coachNote: text("coach_note"),
  isVisible: boolean("is_visible").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
});

// ─── report_blocks ────────────────────────────────────────────────────────────
export const reportBlocksTable = pgTable("report_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => reportSectionsTable.id, { onDelete: "cascade" }),
  blockType: text("block_type").notNull(), // text | stat_table | stat_chart | player_card | image | video_ref | play_ref | divider
  position: integer("position").notNull().default(0),
  content: jsonb("content").$type<Record<string, unknown>>().default({}),
  dataSnapshot: jsonb("data_snapshot").$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScoutingReportSchema = createInsertSchema(scoutingReportsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertReportSectionSchema = createInsertSchema(reportSectionsTable).omit({ id: true });
export const insertReportBlockSchema = createInsertSchema(reportBlocksTable).omit({ id: true, updatedAt: true });

export type ScoutingReport = typeof scoutingReportsTable.$inferSelect;
export type InsertScoutingReport = z.infer<typeof insertScoutingReportSchema>;
export type ReportSection = typeof reportSectionsTable.$inferSelect;
export type ReportBlock = typeof reportBlocksTable.$inferSelect;
