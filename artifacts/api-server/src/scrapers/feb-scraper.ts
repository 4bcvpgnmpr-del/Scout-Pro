/**
 * Scraper de la Federación Española de Baloncesto (feb.es)
 * Extrae Clasificación y Resultados de las principales competiciones.
 * Usa fetch nativo (Node.js 18+) + cheerio para parsear HTML estático.
 *
 * Diagnóstico confirmó (2026-06):
 *   - baloncestoenvivo.feb.es/estadisticas.aspx devuelve stats de EQUIPO en HTML estático
 *   - Selector: table > tr (sin id/clase especial)
 *   - Fila 0: cabeceras de sección (Rebotes, Tapones, Faltas)
 *   - Fila 1: cabeceras de columnas (Equipo, Part, MIN, PT, T2, T3, TC, TL, RO, RD, RT, AS, BR, BP…)
 *   - Fila 2+: datos, cada celda numérica = "total\nmedia" y fracciones = "made/att\n%"
 *   - Stats de jugadores individuales NO están disponibles en estas páginas estáticas
 */

import { load } from "cheerio";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface ClasificacionEntry {
  posicion: number;
  equipo: string;
  pj: number;
  pg: number;
  pp: number;
  pf: number;
  pc: number;
  pts: number;
}

export interface ResultadoEntry {
  local: string;
  visitante: string;
  marcador: string;
  fecha: string;
}

export interface CompeticionData {
  liga: string;
  actualizacion: string;
  clasificacion: ClasificacionEntry[];
  resultados: ResultadoEntry[];
}

export type FebStats = Record<string, CompeticionData>;

/**
 * Stats detalladas de equipo de baloncestoenvivo.feb.es
 * Columnas confirmadas: Equipo, Part, MIN, PT, T2, T3, TC, TL, RO, RD, RT, AS, BR, BP, TF, TC-MT, MT, FC, FR, VA
 */
export interface EstadisticaEquipoEntry {
  equipo:       string;
  partidos:     number;
  puntosTotal:  number;
  puntosMedia:  number;
  t2Made:       number;
  t2Att:        number;
  t3Made:       number;
  t3Att:        number;
  tcMade:       number;
  tcAtt:        number;
  tlMade:       number;
  tlAtt:        number;
  rebOfensivos: number;
  rebDefensivos: number;
  rebTotales:   number;
  asistencias:  number;
  robos:        number;
  perdidas:     number;
  tapones:      number;
  valIndex:     number;
}

export interface CompeticionBEVData {
  ligaId: string;
  liga:   string;
  g:      number;
  equipos: EstadisticaEquipoEntry[];
}

export type FebBEVStats = Record<string, CompeticionBEVData>;

// ── Configuración de competiciones ─────────────────────────────────────────

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const COMPETICIONES = [
  {
    id: "primera-feb",
    nombre: "Primera FEB",
    standingsUrl: "https://www.feb.es/primerafeb/clasificacion.aspx",
    mainUrl: "https://www.feb.es/primerafeb/",
  },
  {
    id: "segunda-feb",
    nombre: "Segunda FEB",
    standingsUrl: "https://www.feb.es/segundafeb/clasificacion.aspx",
    mainUrl: "https://www.feb.es/segundafeb/",
  },
  {
    id: "liga-femenina-endesa",
    nombre: "Liga Femenina Endesa",
    standingsUrl: "https://www.feb.es/lfendesa/clasificacion.aspx",
    mainUrl: "https://www.feb.es/lfendesa/",
  },
  {
    id: "lf-challenge",
    nombre: "LF Challenge",
    standingsUrl: "https://www.feb.es/lfChallenge/clasificacion.aspx",
    mainUrl: "https://www.feb.es/lfChallenge/",
  },
  {
    id: "lf2",
    nombre: "LF2",
    standingsUrl: "https://www.feb.es/ligafemenina2/clasificacion.aspx",
    mainUrl: "https://www.feb.es/ligafemenina2/",
  },
  {
    id: "tercera-feb",
    nombre: "Tercera FEB",
    standingsUrl: "https://www.feb.es/tercerafeb.aspx",
    mainUrl: "https://www.feb.es/tercerafeb.aspx",
  },
] as const;

// ── Caché en memoria y en disco ────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const CACHE_FILE = path.join(DATA_DIR, "feb-stats.json");

let cacheEnMemoria: FebStats | null = null;
let ultimaActualizacion: Date | null = null;

/** Lee la caché del disco al arrancar (si existe). */
export async function cargarCacheDesconoce(): Promise<FebStats | null> {
  try {
    const contenido = await readFile(CACHE_FILE, "utf-8");
    const datos = JSON.parse(contenido) as FebStats;
    cacheEnMemoria = datos;
    logger.info("FEB scraper: caché cargada desde disco");
    return datos;
  } catch {
    return null;
  }
}

/** Devuelve los datos en memoria (o null si no hay caché). */
export function obtenerCache(): FebStats | null {
  return cacheEnMemoria;
}

export function obtenerUltimaActualizacion(): Date | null {
  return ultimaActualizacion;
}

// ── Helpers de fetch ───────────────────────────────────────────────────────

/** Descarga HTML de una URL con cabeceras de navegador para evitar bloqueos. */
async function fetchHtml(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const respuesta = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      },
      signal: controller.signal,
    });
    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status} para ${url}`);
    }
    // feb.es declara charset=iso-8859-1 pero en la práctica sirve UTF-8;
    // usamos text() directamente para evitar doble-encoding de tildes/ñ
    const text = await respuesta.text();
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ── Scrapers individuales ──────────────────────────────────────────────────

/**
 * Extrae la tabla de clasificación de una URL de feb.es.
 * Estructura esperada: table.tabla-estadistica con celdas td.posicion,
 * td.equipo a, td.jugados, td.ganados, td.perdidos, td.favor, td.contra, td.puntos
 */
async function scrapearClasificacion(url: string, liga: string): Promise<ClasificacionEntry[]> {
  const html = await fetchHtml(url);
  const $ = load(html);
  const clasificacion: ClasificacionEntry[] = [];

  $("table.tabla-estadistica tr").each((_i, fila) => {
    const pos = parseInt($(fila).find("td.posicion").text().trim(), 10);
    if (isNaN(pos)) return; // cabecera o separador

    // El nombre del equipo está dentro de un <a> en td.equipo
    const equipo =
      $(fila).find("td.equipo a").text().trim() ||
      $(fila).find("td.equipo").text().trim().replace(/\s+/g, " ");

    if (!equipo) return;

    clasificacion.push({
      posicion: pos,
      equipo,
      pj: parseInt($(fila).find("td.jugados").text().trim(), 10) || 0,
      pg: parseInt($(fila).find("td.ganados").text().trim(), 10) || 0,
      pp: parseInt($(fila).find("td.perdidos").text().trim(), 10) || 0,
      pf: parseInt($(fila).find("td.favor").text().trim(), 10) || 0,
      pc: parseInt($(fila).find("td.contra").text().trim(), 10) || 0,
      pts: parseInt($(fila).find("td.puntos").text().trim(), 10) || 0,
    });
  });

  logger.info({ liga, registros: clasificacion.length }, "FEB: clasificación extraída");
  return clasificacion;
}

/**
 * Extrae los últimos resultados desde la página principal de la competición.
 * Los resultados recientes aparecen como table.scoreCronica en el HTML estático.
 * Para cada resultado intentamos extraer la fecha del bloque contenedor.
 */
async function scrapearResultados(url: string, liga: string): Promise<ResultadoEntry[]> {
  const html = await fetchHtml(url);
  const $ = load(html);
  const resultados: ResultadoEntry[] = [];

  $("table.scoreCronica").each((_i, tabla) => {
    const local = $(tabla).find("td.team.local").text().trim();
    const visitante = $(tabla).find("td.team.visit").text().trim();
    const marcLoc = $(tabla).find("td.score.local").text().trim();
    const marcVis = $(tabla).find("td.score.visit").text().trim();

    if (!local || !visitante) return;

    // Intentamos encontrar la fecha en el bloque padre (div.articulo, div.partido, o span.fecha)
    const bloquePadre = $(tabla).closest("[class*='partido'], [class*='articulo'], [class*='jornada'], .wrap-resultados");
    let fecha = bloquePadre.find("[class*='fecha'], .date, .dia").first().text().trim();

    // Si no encontramos fecha, buscamos en el HTML circundante
    if (!fecha) {
      const prevText = $(tabla).prev().text().trim();
      // Patrón DD/MM/AAAA
      const match = prevText.match(/\d{2}\/\d{2}\/\d{4}/);
      if (match) fecha = match[0];
    }

    const marcador = marcLoc && marcVis ? `${marcLoc}-${marcVis}` : "Por disputar";

    resultados.push({ local, visitante, marcador, fecha: fecha || "—" });
  });

  // Buscar también resultados en divs con clase resultado o partido
  $(".resultado-partido, .partido-resultado, [class*='cronica']").each((_i, div) => {
    const local = $(div).find(".local, .equipo-local").first().text().trim();
    const visitante = $(div).find(".visitante, .equipo-visitante").first().text().trim();
    const marcador = $(div).find(".marcador, .resultado, .score").first().text().trim();
    const fecha = $(div).find(".fecha, .date").first().text().trim();
    if (local && visitante && marcador) {
      resultados.push({ local, visitante, marcador: marcador || "—", fecha: fecha || "—" });
    }
  });

  logger.info({ liga, registros: resultados.length }, "FEB: resultados extraídos");
  return resultados;
}

// ── Scraping completo de todas las competiciones ───────────────────────────

/**
 * Ejecuta el scraping de TODAS las competiciones configuradas.
 * Guarda el resultado en memoria y en disco como JSON.
 */
export async function scrapearTodas(): Promise<FebStats> {
  logger.info("FEB scraper: iniciando extracción de todas las competiciones...");
  const stats: FebStats = {};
  const ahora = new Date().toISOString();

  for (const comp of COMPETICIONES) {
    try {
      logger.info({ liga: comp.nombre }, "FEB scraper: procesando...");

      // Ejecutamos clasificación y resultados en paralelo
      const [clasificacion, resultados] = await Promise.allSettled([
        scrapearClasificacion(comp.standingsUrl, comp.nombre),
        scrapearResultados(comp.mainUrl, comp.nombre),
      ]);

      stats[comp.id] = {
        liga: comp.nombre,
        actualizacion: ahora,
        clasificacion:
          clasificacion.status === "fulfilled" ? clasificacion.value : [],
        resultados:
          resultados.status === "fulfilled" ? resultados.value : [],
      };

      if (clasificacion.status === "rejected") {
        logger.warn({ liga: comp.nombre, error: clasificacion.reason }, "FEB: error en clasificación");
      }
      if (resultados.status === "rejected") {
        logger.warn({ liga: comp.nombre, error: resultados.reason }, "FEB: error en resultados");
      }

      // Pausa entre peticiones para no sobrecargar el servidor
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      logger.error({ liga: comp.nombre, error: err }, "FEB scraper: error procesando competición");
      stats[comp.id] = {
        liga: comp.nombre,
        actualizacion: ahora,
        clasificacion: [],
        resultados: [],
      };
    }
  }

  // Persistir en memoria y en disco
  cacheEnMemoria = stats;
  ultimaActualizacion = new Date();

  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(stats, null, 2), "utf-8");
    logger.info({ archivo: CACHE_FILE }, "FEB scraper: datos guardados en disco");
  } catch (err) {
    logger.error({ error: err }, "FEB scraper: error al guardar JSON en disco");
  }

  return stats;
}

/**
 * Extrae los datos de UNA competición concreta por su ID.
 */
export async function scrapearUna(id: string): Promise<CompeticionData | null> {
  const comp = COMPETICIONES.find((c) => c.id === id);
  if (!comp) return null;

  const [clasificacion, resultados] = await Promise.allSettled([
    scrapearClasificacion(comp.standingsUrl, comp.nombre),
    scrapearResultados(comp.mainUrl, comp.nombre),
  ]);

  const data: CompeticionData = {
    liga: comp.nombre,
    actualizacion: new Date().toISOString(),
    clasificacion: clasificacion.status === "fulfilled" ? clasificacion.value : [],
    resultados: resultados.status === "fulfilled" ? resultados.value : [],
  };

  // Actualizar la caché parcialmente
  if (cacheEnMemoria) {
    cacheEnMemoria[id] = data;
  } else {
    cacheEnMemoria = { [id]: data };
  }

  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(cacheEnMemoria, null, 2), "utf-8");
  } catch {
    // no es crítico
  }

  return data;
}

export const COMPETICION_IDS = COMPETICIONES.map((c) => c.id);

// ── Configuración BaloncestoEnVivo (estadísticas detalladas de equipo) ─────────
// Diagnóstico 2026-06: g= es el ID de competición en baloncestoenvivo.feb.es
// Selector confirmado: table > tr (sin id/clase especial)

const BEV_BASE = "https://baloncestoenvivo.feb.es/estadisticas.aspx";

/**
 * Año de INICIO de la temporada activa para el parámetro `t=` de BEV.
 * BEV usa el año de inicio: temporada 2025-26 → t=2025.
 * (mes >= 8 = nuevo curso ya empezado → año actual; antes de agosto → año anterior)
 */
function bevSeasonYear(): number {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

const BEV_COMPETICIONES = [
  { id: "primera-feb",          nombre: "Primera FEB",        g: 1,  nm: "primerafeb"  },
  { id: "segunda-feb",          nombre: "Segunda FEB",        g: 2,  nm: "segundafeb"  },
  { id: "tercera-feb",          nombre: "Tercera FEB",        g: 3,  nm: "tercerafeb"  },
  { id: "liga-femenina-endesa", nombre: "Liga Femenina Endesa", g: 4, nm: "lfendesa"   },
  { id: "lf-challenge",         nombre: "LF Challenge",       g: 67, nm: "lfchallenge" },
  { id: "lf2",                  nombre: "LF2",                g: 9,  nm: "lf2"         },
] as const;

// ── Helpers de parseo BEV ──────────────────────────────────────────────────────

/**
 * Parsea una celda numérica del formato " \n total \n media"
 * BEV coloca cada valor en una línea separada; la primera línea suele ser vacía.
 * Ej: "\n  135 \n  67.5" → { total: 135, media: 67.5 }
 */
function parseCelda(raw: string): { total: number; media: number } {
  const lineas = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const total  = parseFloat((lineas[0] ?? "0").replace(",", ".")) || 0;
  const media  = parseFloat((lineas[1] ?? "0").replace(",", ".")) || 0;
  return { total, media };
}

/**
 * Parsea una celda de fracción del formato "\n  made/att \n  %"
 * BEV coloca la fracción en la primera línea no vacía.
 * Ej: "\n  18/33 \n  54,5%" → { made: 18, att: 33 }
 */
function parseFraccion(raw: string): { made: number; att: number } {
  const primeraLinea = raw.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const [made, att]  = primeraLinea.split("/").map((s) => parseInt(s.replace(/\D/g, ""), 10) || 0);
  return { made: made ?? 0, att: att ?? 0 };
}

// ── Scraper BEV (estadísticas detalladas de equipo) ────────────────────────────

/**
 * Obtiene estadísticas detalladas de equipo de baloncestoenvivo.feb.es
 * usando los selectores confirmados por diagnóstico estático (2026-06).
 *
 * Estructura de tabla confirmada:
 *   - Fila 0: cabeceras de sección (colspan, ej. Rebotes / Tapones / Faltas)
 *   - Fila 1: cabeceras de columnas (Equipo, Part, MIN, PT, T2, T3, TC, TL, RO, RD, RT, AS, BR, BP, TF, TC-MT, MT, FC, FR, VA)
 *   - Fila 2+: una fila por equipo
 *
 * Stats de jugadores individuales NO están disponibles en estas páginas.
 */
export async function scrapearEstadisticasBEV(): Promise<FebBEVStats> {
  const año   = bevSeasonYear();
  const result: FebBEVStats = {};

  for (const comp of BEV_COMPETICIONES) {
    const url = `${BEV_BASE}?g=${comp.g}&t=${año}&nm=${comp.nm}`;
    try {
      const html    = await fetchHtml(url);
      const $       = load(html);
      const equipos: EstadisticaEquipoEntry[] = [];

      // Selector: primer (y único) <table> de la página → todas sus <tr>
      const filas = $("table").first().find("tr").toArray();

      // Fila 0 = cabeceras de sección, fila 1 = nombres de columnas → saltar ambas
      for (let i = 2; i < filas.length; i++) {
        const cells = $(filas[i]).find("td");
        if (cells.length < 10) continue;

        const equipo  = cells.eq(0).text().trim();
        if (!equipo) continue;

        const partidos = parseInt(cells.eq(1).text().trim(), 10) || 0;
        if (partidos === 0) continue;

        // col 3 = PT (puntos) — total\nmedia
        const { total: puntosTotal, media: puntosMedia } = parseCelda(cells.eq(3).text());
        // col 4-7 = tiro de campo (fracciones)
        const t2 = parseFraccion(cells.eq(4).text());
        const t3 = parseFraccion(cells.eq(5).text());
        const tc = parseFraccion(cells.eq(6).text());
        const tl = parseFraccion(cells.eq(7).text());
        // col 8-10 = rebotes ofensivo, defensivo, total
        const { total: rebOfensivos  } = parseCelda(cells.eq(8).text());
        const { total: rebDefensivos } = parseCelda(cells.eq(9).text());
        const { total: rebTotales    } = parseCelda(cells.eq(10).text());
        // col 11 = AS, 12 = BR, 13 = BP
        const { total: asistencias } = parseCelda(cells.eq(11).text());
        const { total: robos       } = parseCelda(cells.eq(12).text());
        const { total: perdidas    } = parseCelda(cells.eq(13).text());
        // col 14 = tapones
        const { total: tapones } = parseCelda(cells.eq(14).text());
        // col 19 = VA (valoración)
        const { total: valIndex } = parseCelda(cells.eq(19).text());

        equipos.push({
          equipo, partidos,
          puntosTotal,  puntosMedia,
          t2Made: t2.made, t2Att: t2.att,
          t3Made: t3.made, t3Att: t3.att,
          tcMade: tc.made, tcAtt: tc.att,
          tlMade: tl.made, tlAtt: tl.att,
          rebOfensivos, rebDefensivos, rebTotales,
          asistencias, robos, perdidas, tapones, valIndex,
        });
      }

      result[comp.id] = { ligaId: comp.id, liga: comp.nombre, g: comp.g, equipos };
      logger.info(
        { liga: comp.nombre, t: año, equipos: equipos.length },
        "[BEV] estadísticas de equipo extraídas",
      );
    } catch (err) {
      logger.warn({ liga: comp.nombre, url, err }, "[BEV] error scraping — se omite");
      result[comp.id] = { ligaId: comp.id, liga: comp.nombre, g: comp.g, equipos: [] };
    }

    // Pausa cortés entre peticiones
    await new Promise((r) => setTimeout(r, 1200));
  }

  return result;
}

// ── Scraper de jugadores BEV ───────────────────────────────────────────────────
// Cadena confirmada (2026-07):
//   rankings.aspx?g=N&t=Y&nm=SLUG → Equipo.aspx?i=TEAM_ID hrefs
//   Equipo.aspx?i=TEAM_ID         → Jugador.aspx?i=TEAM_ID&c=PLAYER_ID hrefs
//   jugador/TEAM_ID/PLAYER_ID     → tabla 2 (totales) plain-text cells
//
// Estructura tabla totales confirmada:
//   fila 0: cabeceras de sección (colspan)
//   fila 1: FASE Part MIN PT T2 T3 TC TL RO RD RT AS BR BP TF TC-MT MT FC FR VA
//   fila 2: "Temp: 25/26. Equipo: NOMBRE" (label colspan)
//   fila 3+: datos por fase (LR / PO / CF…)
// Celda MIN = "MM:SS"; fracciones = "made/att"; resto = enteros plain text.

export interface BEVPlayerStatsEntry {
  teamBevId:    string;
  teamName:     string;
  playerBevId:  string;
  firstName:    string;
  lastName:     string;
  photoUrl:     string;
  gamesPlayed:  number;
  minutesTotal: number;  // minutos decimales
  points:       number;
  fg2Made:      number; fg2Att: number;
  fg3Made:      number; fg3Att: number;
  ftMade:       number; ftAtt:  number;
  offRebounds:  number; defRebounds: number; rebounds: number;
  assists:      number; steals:      number; turnovers: number;
  blocks:       number; fouls:       number;
  pir:          number;
}

export interface BEVLeaguePlayersData {
  ligaId:  string;
  players: BEVPlayerStatsEntry[];
}

function parseMinutesBEV(raw: string): number {
  const parts = raw.split(":");
  return (parseInt(parts[0] ?? "0", 10) || 0) + (parseInt(parts[1] ?? "0", 10) || 0) / 60;
}

function parseFracBEV(raw: string): { made: number; att: number } {
  const [a, b] = raw.split("/");
  return { made: parseInt(a ?? "0", 10) || 0, att: parseInt(b ?? "0", 10) || 0 };
}

/**
 * Parsea "APELLIDOS, NOMBRE" → { firstName, lastName }
 * Si no hay coma, intenta split por espacios (último token = apellido).
 */
function parseBEVName(raw: string): { firstName: string; lastName: string } {
  const comma = raw.indexOf(",");
  if (comma !== -1) {
    return {
      lastName:  raw.slice(0, comma).trim(),
      firstName: raw.slice(comma + 1).trim(),
    };
  }
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: "", lastName: raw.trim() };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1)! };
}

/** Etiqueta de temporada para el parámetro `t=` de BEV (ej. año=2025 → "25/26"). */
function bevSeasonLabel(año: number): string {
  return `${String(año).slice(-2)}/${String(año + 1).slice(-2)}`;
}

/**
 * Extrae IDs de equipo únicos de la página rankings.aspx de una liga.
 * Los hrefs "Equipo.aspx?i=XXXXX" aparecen en las tablas de rankings.
 */
async function scrapeBEVTeamIds(g: number, nm: string, año: number): Promise<string[]> {
  const url  = `https://baloncestoenvivo.feb.es/rankings.aspx?g=${g}&t=${año}&nm=${nm}`;
  const html = await fetchHtml(url);
  const $    = load(html);
  const ids  = new Set<string>();
  $("a[href]").each((_, el) => {
    const m = ($(el).attr("href") ?? "").match(/Equipo\.aspx\?i=(\d+)/i);
    if (m) ids.add(m[1]!);
  });
  return [...ids];
}

/**
 * Extrae IDs de jugador únicos de la página de un equipo (Equipo.aspx?i=TEAM_ID).
 * Los hrefs "Jugador.aspx?i=TEAM_ID&c=PLAYER_ID" aparecen en la tabla de plantilla.
 */
async function scrapeBEVPlayerIds(teamBevId: string): Promise<string[]> {
  const url  = `https://baloncestoenvivo.feb.es/Equipo.aspx?i=${teamBevId}`;
  const html = await fetchHtml(url);
  const $    = load(html);
  const ids  = new Set<string>();
  $("a[href]").each((_, el) => {
    const m = ($(el).attr("href") ?? "").match(/Jugador\.aspx\?i=\d+&c=(\d+)/i);
    if (m) ids.add(m[1]!);
  });
  return [...ids];
}

/**
 * Extrae estadísticas de temporada actual de la página de un jugador.
 * URL: https://baloncestoenvivo.feb.es/jugador/{teamId}/{playerId}
 *
 * Suma todas las fases (LR + PO + CF…) de la temporada activa.
 * Devuelve null si el jugador no tiene registros en la temporada actual.
 */
export async function scrapeBEVPlayerStats(
  teamBevId: string,
  playerBevId: string,
): Promise<BEVPlayerStatsEntry | null> {
  const url    = `https://baloncestoenvivo.feb.es/jugador/${teamBevId}/${playerBevId}`;
  const html   = await fetchHtml(url);
  const $      = load(html);
  const label  = bevSeasonLabel(bevSeasonYear()); // "25/26"

  const rawName = $(".box-jugador .nombre").text().trim();
  if (!rawName) return null;

  const { firstName, lastName } = parseBEVName(rawName);
  const photoUrl  = $(".box-jugador .foto img").attr("src") ?? "";
  const teamName  = $(".box-jugador .equipo a").text().trim();

  // Tabla de TOTALES = 3ª tabla de la página (índice 2)
  const rows = $("table").eq(2).find("tr").toArray();

  let inTarget = false;
  let hasData  = false;
  const acc = {
    gamesPlayed: 0, minutesTotal: 0, points: 0,
    fg2Made: 0, fg2Att: 0, fg3Made: 0, fg3Att: 0,
    ftMade:  0, ftAtt:  0,
    offRebounds: 0, defRebounds: 0, rebounds: 0,
    assists: 0, steals: 0, turnovers: 0, blocks: 0, fouls: 0, pir: 0,
  };

  for (const tr of rows) {
    const tds     = $(tr).find("td");
    const rowText = $(tr).text().replace(/\s+/g, " ").trim();

    // Fila de etiqueta de temporada (colspan, contiene "Temp:")
    if (rowText.includes("Temp:")) {
      inTarget = rowText.includes(label);
      continue;
    }

    if (!inTarget) continue;
    if (tds.length < 20) continue;                  // cabeceras o filas incompletas
    const cell = (i: number) => tds.eq(i).text().trim();
    if (cell(0) === "FASE") continue;               // fila de cabecera de columnas

    acc.gamesPlayed  += parseInt(cell(1), 10)  || 0;
    acc.minutesTotal += parseMinutesBEV(cell(2));
    acc.points       += parseInt(cell(3), 10)  || 0;

    const t2 = parseFracBEV(cell(4));
    acc.fg2Made += t2.made; acc.fg2Att += t2.att;

    const t3 = parseFracBEV(cell(5));
    acc.fg3Made += t3.made; acc.fg3Att += t3.att;

    const tl = parseFracBEV(cell(7));
    acc.ftMade += tl.made; acc.ftAtt += tl.att;

    acc.offRebounds += parseInt(cell(8),  10) || 0;
    acc.defRebounds += parseInt(cell(9),  10) || 0;
    acc.rebounds    += parseInt(cell(10), 10) || 0;
    acc.assists     += parseInt(cell(11), 10) || 0;
    acc.steals      += parseInt(cell(12), 10) || 0;
    acc.turnovers   += parseInt(cell(13), 10) || 0;
    acc.blocks      += parseInt(cell(16), 10) || 0; // MT (tapones realizados)
    acc.fouls       += parseInt(cell(17), 10) || 0; // FC (faltas cometidas)
    acc.pir         += parseInt(cell(19), 10) || 0; // VA (valoración)
    hasData = true;
  }

  if (!hasData || acc.gamesPlayed === 0) return null;

  return { teamBevId, teamName, playerBevId, firstName, lastName, photoUrl, ...acc };
}

/**
 * Extrae estadísticas de jugadores de una liga BEV completa.
 * Cadena: rankings.aspx → IDs de equipo → Equipo.aspx → IDs de jugador → jugador page.
 */
export async function scrapeBEVLeaguePlayers(comp: {
  id: string; nombre: string; g: number; nm: string;
}): Promise<BEVLeaguePlayersData> {
  const año     = bevSeasonYear();
  const players: BEVPlayerStatsEntry[] = [];

  try {
    const teamIds = await scrapeBEVTeamIds(comp.g, comp.nm, año);
    logger.info({ liga: comp.nombre, equipos: teamIds.length }, "[BEV] equipos descubiertos para jugadores");

    for (const teamId of teamIds) {
      await new Promise((r) => setTimeout(r, 800));
      try {
        const playerIds = await scrapeBEVPlayerIds(teamId);
        for (const playerId of playerIds) {
          await new Promise((r) => setTimeout(r, 500));
          try {
            const stats = await scrapeBEVPlayerStats(teamId, playerId);
            if (stats) players.push(stats);
          } catch (err) {
            logger.warn({ teamId, playerId, err }, "[BEV] error jugador — se omite");
          }
        }
      } catch (err) {
        logger.warn({ teamId, err }, "[BEV] error plantilla equipo — se omite");
      }
    }
  } catch (err) {
    logger.warn({ liga: comp.nombre, err }, "[BEV] error en scrapeBEVLeaguePlayers");
  }

  logger.info({ liga: comp.nombre, jugadores: players.length }, "[BEV] stats jugadores extraídas");
  return { ligaId: comp.id, players };
}

/**
 * Extrae estadísticas de jugadores de todas las ligas BEV.
 * Proceso lento (~500 requests) — pensado para ejecutarse una vez al día.
 */
export async function scrapeBEVAllLeaguePlayers(): Promise<BEVLeaguePlayersData[]> {
  const results: BEVLeaguePlayersData[] = [];
  for (const comp of BEV_COMPETICIONES) {
    const data = await scrapeBEVLeaguePlayers(comp);
    results.push(data);
    await new Promise((r) => setTimeout(r, 1500)); // pausa entre ligas
  }
  return results;
}
