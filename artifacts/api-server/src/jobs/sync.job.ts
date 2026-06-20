import cron from "node-cron";
import { db } from "@workspace/db";
import { syncLog, leagues } from "@workspace/db";
import { fetchAllEuroLeagues } from "../scrapers/euroleague.client.js";
import { scrapearTodas } from "../scrapers/feb-scraper.js";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// ─── FEB sync (usa el scraper cheerio existente) ──────────────────────────────

async function upsertFebData() {
  const logEntry = await db.insert(syncLog).values({
    source: "feb",
    status: "running",
  }).returning().then((r) => r[0]);

  try {
    const stats = await scrapearTodas();
    let totalRecords = 0;

    for (const [ligaId, data] of Object.entries(stats)) {
      totalRecords += (data.clasificacion?.length ?? 0) + (data.resultados?.length ?? 0);

      const existing = await db.query.leagues.findFirst({
        where: (l, { and, eq }) =>
          and(eq(l.source, "feb"), eq(l.externalId, ligaId)),
      });

      if (!existing) {
        const ligaNombre = data.liga ?? ligaId;
        await db.insert(leagues).values({
          name:       ligaNombre,
          shortName:  ligaId,
          source:     "feb",
          externalId: ligaId,
          country:    "ES",
          gender:     ligaNombre.startsWith("LF") || ligaNombre.toLowerCase().includes("femenin") ? "F" : "M",
        }).onConflictDoNothing();
      }
    }

    await db.update(syncLog)
      .set({ status: "success", recordsProcessed: totalRecords, finishedAt: new Date() })
      .where(eq(syncLog.id, logEntry.id));

    logger.info({ totalRecords }, "[FEB sync] completed");
  } catch (err) {
    await db.update(syncLog)
      .set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      })
      .where(eq(syncLog.id, logEntry.id));

    logger.error({ err }, "[FEB sync] failed");
  }
}

// ─── EuroLeague sync ──────────────────────────────────────────────────────────

async function upsertEuroLeagueData() {
  const logEntry = await db.insert(syncLog).values({
    source: "euroleague",
    status: "running",
  }).returning().then((r) => r[0]);

  try {
    const { euroLeague, euroCup } = await fetchAllEuroLeagues();

    const total =
      euroLeague.stats.length + euroLeague.standings.length +
      euroCup.stats.length   + euroCup.standings.length;

    await db.update(syncLog)
      .set({ status: "success", recordsProcessed: total, finishedAt: new Date() })
      .where(eq(syncLog.id, logEntry.id));

    logger.info({ total }, "[EuroLeague sync] completed");
  } catch (err) {
    await db.update(syncLog)
      .set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
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
