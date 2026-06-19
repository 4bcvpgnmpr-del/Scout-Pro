/**
 * Rutas REST para datos de feb.es
 * GET /api/feb                    — todos los datos de todas las competiciones (caché)
 * GET /api/feb/:id                — datos de una competición concreta (caché)
 * GET /api/feb/:id/clasificacion  — solo la tabla de clasificación
 * GET /api/feb/:id/resultados     — solo los resultados
 * POST /api/feb/refresh           — fuerza un re-scraping de todas las competiciones
 * POST /api/feb/:id/refresh       — fuerza un re-scraping de una competición concreta
 */

import { Router } from "express";
import {
  obtenerCache,
  obtenerUltimaActualizacion,
  scrapearTodas,
  scrapearUna,
  COMPETICION_IDS,
} from "../scrapers/feb-scraper.js";
import { logger } from "../lib/logger.js";

const febRouter = Router();

// ── GET /api/feb ──────────────────────────────────────────────────────────

febRouter.get("/feb", async (req, res) => {
  const cache = obtenerCache();
  if (!cache) {
    res.status(503).json({
      error: "Datos aún no disponibles. El scraping inicial puede tardar unos minutos. Prueba POST /api/feb/refresh para forzarlo.",
    });
    return;
  }
  res.json({
    actualizacion: obtenerUltimaActualizacion()?.toISOString() ?? null,
    competiciones: cache,
  });
});

// ── POST /api/feb/refresh ─────────────────────────────────────────────────

febRouter.post("/feb/refresh", async (req, res) => {
  res.json({ mensaje: "Scraping iniciado en segundo plano. Los datos estarán disponibles en ~30 segundos." });
  // Ejecutamos el scraping sin bloquear la respuesta
  scrapearTodas().catch((err) =>
    logger.error({ error: err }, "FEB: error en refresh manual completo")
  );
});

// ── GET /api/feb/:id ──────────────────────────────────────────────────────

febRouter.get("/feb/:id", (req, res) => {
  const { id } = req.params;

  if (!COMPETICION_IDS.includes(id as typeof COMPETICION_IDS[number])) {
    res.status(404).json({
      error: `Competición '${id}' no encontrada. IDs válidos: ${COMPETICION_IDS.join(", ")}`,
    });
    return;
  }

  const cache = obtenerCache();
  const datos = cache?.[id];

  if (!datos) {
    res.status(503).json({
      error: "Datos aún no disponibles para esta competición. Usa POST /api/feb/:id/refresh",
    });
    return;
  }

  res.json(datos);
});

// ── GET /api/feb/:id/clasificacion ────────────────────────────────────────

febRouter.get("/feb/:id/clasificacion", (req, res) => {
  const { id } = req.params;

  if (!COMPETICION_IDS.includes(id as typeof COMPETICION_IDS[number])) {
    res.status(404).json({ error: `Competición '${id}' no encontrada.` });
    return;
  }

  const datos = obtenerCache()?.[id];
  if (!datos) {
    res.status(503).json({ error: "Datos no disponibles aún." });
    return;
  }

  res.json({
    liga: datos.liga,
    actualizacion: datos.actualizacion,
    clasificacion: datos.clasificacion,
  });
});

// ── GET /api/feb/:id/resultados ───────────────────────────────────────────

febRouter.get("/feb/:id/resultados", (req, res) => {
  const { id } = req.params;

  if (!COMPETICION_IDS.includes(id as typeof COMPETICION_IDS[number])) {
    res.status(404).json({ error: `Competición '${id}' no encontrada.` });
    return;
  }

  const datos = obtenerCache()?.[id];
  if (!datos) {
    res.status(503).json({ error: "Datos no disponibles aún." });
    return;
  }

  res.json({
    liga: datos.liga,
    actualizacion: datos.actualizacion,
    resultados: datos.resultados,
  });
});

// ── POST /api/feb/:id/refresh ─────────────────────────────────────────────

febRouter.post("/feb/:id/refresh", async (req, res) => {
  const { id } = req.params;

  if (!COMPETICION_IDS.includes(id as typeof COMPETICION_IDS[number])) {
    res.status(404).json({ error: `Competición '${id}' no encontrada.` });
    return;
  }

  res.json({ mensaje: `Scraping de '${id}' iniciado en segundo plano.` });
  scrapearUna(id).catch((err) =>
    logger.error({ error: err, id }, "FEB: error en refresh manual por competición")
  );
});

export default febRouter;
