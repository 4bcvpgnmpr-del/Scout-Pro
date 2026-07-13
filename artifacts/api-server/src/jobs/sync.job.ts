import cron from "node-cron";
import { db } from "@workspace/db";
import { syncLog, leagues } from "@workspace/db";
import { fetchAllEuroLeagues } from "../scrapers/euroleague.client.js";
import { scrapearTodas, scrapearEstadisticasBEV, scrapeBEVAllLeaguePlayers } from "../scrapers/feb-scraper.js";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import {
  clearNormalizerCaches,
  normalizeFebStats,
  normalizeFebBEVStats,
  normalizeBEVPlayerStats,
  normalizeHistoricalBEVTeamStats,
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

    // Fase 1: clasificaciones de www.feb.es (posición, W-L, PF, PC)
    const stats = await scrapearTodas();
    let totalRecords = 0;

    for (const [ligaId, data] of Object.entries(stats)) {
      const rows = await normalizeFebStats(ligaId, data);
      totalRecords += rows;
    }

    // Fase 2: estadísticas detalladas de equipo de baloncestoenvivo.feb.es
    // (tiro, rebotes, asistencias) — enriquece pointsFor en standings existentes
    try {
      const bevStats = await scrapearEstadisticasBEV();
      let bevTotal = 0;
      for (const [ligaId, data] of Object.entries(bevStats)) {
        const rows = await normalizeFebBEVStats(ligaId, data);
        bevTotal += rows;
      }
      logger.info({ bevTotal }, "[FEB sync] BEV enrichment completed");
      totalRecords += bevTotal;
    } catch (bevErr) {
      // BEV enriquecimiento es secundario — no falla todo el sync si falla
      logger.warn({ bevErr }, "[FEB sync] BEV enrichment failed — standings remain with www.feb.es data");
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

// ─── BEV player stats sync ────────────────────────────────────────────────────

async function upsertBEVPlayerData() {
  const logEntry = await db
    .insert(syncLog)
    .values({ source: "feb", status: "running" })
    .returning()
    .then((r) => r[0]);

  try {
    clearNormalizerCaches();

    const allData = await scrapeBEVAllLeaguePlayers();
    let total = 0;
    for (const data of allData) {
      const rows = await normalizeBEVPlayerStats(data);
      total += rows;
    }

    await db
      .update(syncLog)
      .set({ status: "success", recordsProcessed: total, finishedAt: new Date() })
      .where(eq(syncLog.id, logEntry.id));

    logger.info({ total }, "[BEV players sync] completed");
  } catch (err) {
    await db
      .update(syncLog)
      .set({
        status:       "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        finishedAt:   new Date(),
      })
      .where(eq(syncLog.id, logEntry.id));

    logger.error({ err }, "[BEV players sync] failed");
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

// ─── Historical BEV sync (2020 → current-1) ───────────────────────────────────

/** Devuelve el año de inicio de la temporada activa actual. */
function currentSeasonStartYear(): number {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Pobla estadísticas históricas de equipo + jugadores para UN año concreto.
 * Equipo stats: crea standings desde BEV (sin W/L).
 * Jugador stats: scrapa toda la cadena rankings→equipo→jugador para ese año.
 */
async function upsertHistoricalYearData(startYear: number): Promise<number> {
  clearNormalizerCaches();
  let total = 0;

  // Fase 1: estadísticas de equipo
  try {
    const bevStats = await scrapearEstadisticasBEV(startYear);
    for (const [ligaId, data] of Object.entries(bevStats)) {
      const rows = await normalizeHistoricalBEVTeamStats(ligaId, data, startYear);
      total += rows;
    }
    logger.info({ startYear, total }, "[historical] team stats done");
  } catch (err) {
    logger.warn({ startYear, err }, "[historical] team stats failed — continuando con jugadores");
  }

  // Fase 2: estadísticas de jugadores
  try {
    const allData = await scrapeBEVAllLeaguePlayers(startYear);
    for (const data of allData) {
      const rows = await normalizeBEVPlayerStats(data, startYear);
      total += rows;
    }
    logger.info({ startYear, total }, "[historical] player stats done");
  } catch (err) {
    logger.warn({ startYear, err }, "[historical] player stats failed");
  }

  return total;
}

async function upsertHistoricalData() {
  const logEntry = await db
    .insert(syncLog)
    .values({ source: "feb", status: "running" })
    .returning()
    .then((r) => r[0]);

  try {
    const currentYear = currentSeasonStartYear();
    let grandTotal = 0;

    for (let year = 2020; year < currentYear; year++) {
      logger.info({ year }, "[historical sync] procesando temporada...");
      const rows = await upsertHistoricalYearData(year);
      grandTotal += rows;
      // Pausa entre temporadas para no saturar BEV
      await new Promise((r) => setTimeout(r, 3000));
    }

    await db
      .update(syncLog)
      .set({ status: "success", recordsProcessed: grandTotal, finishedAt: new Date() })
      .where(eq(syncLog.id, logEntry.id));

    logger.info({ grandTotal }, "[historical sync] completed");
  } catch (err) {
    await db
      .update(syncLog)
      .set({
        status:       "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        finishedAt:   new Date(),
      })
      .where(eq(syncLog.id, logEntry.id));

    logger.error({ err }, "[historical sync] failed");
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

  // BEV player stats — diario a las 04:00 (proceso lento, ~500 requests)
  cron.schedule("0 4 * * *", async () => {
    logger.info("[cron] Starting BEV player stats sync...");
    await upsertBEVPlayerData();
  });

  logger.info("[ScoutFlow] Sync jobs registered ✓");
}

// ─── Manual trigger handlers ──────────────────────────────────────────────────

export const syncHandlers = {
  feb:        upsertFebData,
  euroleague: upsertEuroLeagueData,
  bevPlayers: upsertBEVPlayerData,
  historical: upsertHistoricalData,
};

export { upsertHistoricalYearData };
