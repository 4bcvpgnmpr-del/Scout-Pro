import cron from "node-cron";
import { db } from "@workspace/db";
import { syncLog, leagues } from "@workspace/db";
import { fetchAllEuroLeagues } from "../scrapers/euroleague.client.js";
import { scrapearTodas } from "../scrapers/feb-scraper.js";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import {
  clearNormalizerCaches,
  normalizeFebStats,
  normalizeEuroStats,
  normalizeEuroStanding,
} from "../db/normalizer.js";

// ─── FEB sync ─────────────────────────────────────────────────────────────────

async function upsertFebData() {
  const logEntry = await db
    .insert(syncLog)
    .values({ source: "feb", status: "running" })
    .returning()
    .then((r) => r[0]);

  try {
    clearNormalizerCaches();
    const stats = await scrapearTodas();
    let totalRecords = 0;

    for (const [ligaId, data] of Object.entries(stats)) {
      const rows = await normalizeFebStats(ligaId, data);
      totalRecords += rows;
    }

    await db
      .update(syncLog)
      .set({ status: "success", recordsProcessed: totalRecords, finishedAt: new Date() })
      .where(eq(syncLog.id, logEntry.id));

    logger.info({ totalRecords }, "[FEB sync] completed");
  } catch (err) {
    await db
      .update(syncLog)
      .set({
        status:       "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        finishedAt:   new Date(),
      })
      .where(eq(syncLog.id, logEntry.id));

    logger.error({ err }, "[FEB sync] failed");
  }
}

// ─── EuroLeague sync ──────────────────────────────────────────────────────────

async function upsertEuroLeagueData() {
  const logEntry = await db
    .insert(syncLog)
    .values({ source: "euroleague", status: "running" })
    .returning()
    .then((r) => r[0]);

  try {
    clearNormalizerCaches();
    const { euroLeague, euroCup } = await fetchAllEuroLeagues();

    let total = 0;

    for (const stat of euroLeague.stats) {
      await normalizeEuroStats(stat);
      total++;
    }
    for (const standing of euroLeague.standings) {
      await normalizeEuroStanding(standing);
      total++;
    }
    for (const stat of euroCup.stats) {
      await normalizeEuroStats(stat);
      total++;
    }
    for (const standing of euroCup.standings) {
      await normalizeEuroStanding(standing);
      total++;
    }

    await db
      .update(syncLog)
      .set({ status: "success", recordsProcessed: total, finishedAt: new Date() })
      .where(eq(syncLog.id, logEntry.id));

    logger.info({ total }, "[EuroLeague sync] completed");
  } catch (err) {
    await db
      .update(syncLog)
      .set({
        status:       "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        finishedAt:   new Date(),
      })
      .where(eq(syncLog.id, logEntry.id));

    logger.error({ err }, "[EuroLeague sync] failed");
  }
}

// ─── Schedule registration ────────────────────────────────────────────────────

export function registerSyncJobs() {
  cron.schedule("0 */6 * * *", async () => {
    logger.info("[cron] Starting FEB sync...");
    await upsertFebData();
  });

  cron.schedule("0 */2 * * *", async () => {
    logger.info("[cron] Starting EuroLeague sync...");
    await upsertEuroLeagueData();
  });

  cron.schedule("0 3 * * *", async () => {
    logger.info("[cron] Nightly maintenance done");
  });

  logger.info("[ScoutFlow] Sync jobs registered ✓");
}

// ─── Manual trigger handlers ──────────────────────────────────────────────────

export const syncHandlers = {
  feb:        upsertFebData,
  euroleague: upsertEuroLeagueData,
};
