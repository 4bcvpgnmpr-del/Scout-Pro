import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const playsTable = pgTable("plays", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  teamId: integer("team_id").references(() => teamsTable.id, { onDelete: "set null" }),
  isLibrary: boolean("is_library").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playFramesTable = pgTable("play_frames", {
  id: uuid("id").primaryKey().defaultRandom(),
  playId: uuid("play_id")
    .notNull()
    .references(() => playsTable.id, { onDelete: "cascade" }),
  frameIndex: integer("frame_index").notNull(),
  elements: jsonb("elements").$type<Array<Record<string, unknown>>>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlaySchema = createInsertSchema(playsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPlayFrameSchema = createInsertSchema(playFramesTable).omit({ id: true, createdAt: true });

export type InsertPlay = z.infer<typeof insertPlaySchema>;
export type Play = typeof playsTable.$inferSelect;
export type PlayFrame = typeof playFramesTable.$inferSelect;