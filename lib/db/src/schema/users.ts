import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "amateur",
  "professional",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersTable = pgTable("users", {
  id:               uuid("id").primaryKey().defaultRandom(),
  email:            text("email").notNull().unique(),
  passwordHash:     text("password_hash").notNull(),
  name:             text("name"),
  role:             text("role").notNull().default("entrenador"),
  subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("amateur"),
  selectedTeamId:   uuid("selected_team_id"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});

// ─── Sessions (connect-pg-simple compatible) ──────────────────────────────────

export const sessionsTable = pgTable("session", {
  sid:    text("sid").primaryKey(),
  sess:   text("sess").notNull(),
  expire: timestamp("expire", { mode: "date" }).notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(usersTable, ({ }) => ({
}));
