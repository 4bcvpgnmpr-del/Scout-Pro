import { pgTable, serial, integer, numeric, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamMediaTable } from "./team-media";
import { playersTable } from "./players";
import { playsTable } from "./plays";
import { scoutingReportsTable } from "./scouting-reports";

export const videoClipsTable = pgTable("video_clips", {
  id: serial("id").primaryKey(),
  mediaId: integer("media_id")
    .notNull()
    .references(() => teamMediaTable.id, { onDelete: "cascade" }),
  startTime: numeric("start_time", { precision: 10, scale: 3 }).notNull(),
  endTime: numeric("end_time", { precision: 10, scale: 3 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("other"),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "set null" }),
  playId: uuid("play_id").references(() => playsTable.id, { onDelete: "set null" }),
  reportId: uuid("report_id").references(() => scoutingReportsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVideoClipSchema = createInsertSchema(videoClipsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVideoClip = z.infer<typeof insertVideoClipSchema>;
export type VideoClip = typeof videoClipsTable.$inferSelect;