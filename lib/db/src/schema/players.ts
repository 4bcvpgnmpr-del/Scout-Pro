import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  teamId: integer("team_id"),
  jerseyNumber: integer("jersey_number"),
  age: integer("age"),
  height: text("height"),
  weight: integer("weight"),
  nationality: text("nationality"),
  handedness: text("handedness"),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  watchlisted: boolean("watchlisted").notNull().default(false),
  statPlayerExternalId: text("stat_player_external_id"),
  seasonYear: integer("season_year"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
