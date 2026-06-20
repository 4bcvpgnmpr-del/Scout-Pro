import app from "./app";
import { logger } from "./lib/logger";
import cron from "node-cron";
import {
  cargarCacheDesconoce,
  scrapearTodas,
} from "./scrapers/feb-scraper.js";
import { registerSyncJobs } from "./jobs/sync.job.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Cargar caché previa desde disco (si existe del scraping anterior)
  await cargarCacheDesconoce();

  // Scraping inicial diferido: ejecutamos 10 segundos después de arrancar
  // para no bloquear el arranque del servidor
  setTimeout(() => {
    scrapearTodas().catch((err) =>
      logger.error({ err }, "FEB scraper: error en scraping inicial")
    );
  }, 10_000);

  // Cron diario a las 06:00 (hora del servidor) para mantener datos frescos
  cron.schedule("0 6 * * *", () => {
    logger.info("FEB scraper: ejecutando scraping diario programado...");
    scrapearTodas().catch((err) =>
      logger.error({ err }, "FEB scraper: error en cron diario")
    );
  });

  logger.info("FEB scraper: cron diario programado a las 06:00");

  registerSyncJobs();
});
