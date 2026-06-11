import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamMediaTable = pgTable("team_media", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  category: text("category").notNull(),
  title: text("title"),
  description: text("description"),
  url: text("url"),
  sourceType: text("source_type").notNull().default("upload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamMediaSchema = createInsertSchema(teamMediaTable).omit({ id: true, createdAt: true });
export type InsertTeamMedia = z.infer<typeof insertTeamMediaSchema>;
export type TeamMedia = typeof teamMediaTable.$inferSelect;
