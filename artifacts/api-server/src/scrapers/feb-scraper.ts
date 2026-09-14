import { load } from "cheerio";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";

export interface ClasificacionEntry {
  posicion: number;
  equipo: string;
  pj: number;
  pg: number;
  pp: number;
  pf: number;
  pc: number;
  pts: number;
  groupName?: string;
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

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const COMPETICIONES = [
  {
    id: "primera-feb",
    nombre: "Primera FEB",
    standingsUrl: "https://feb.es",
    mainUrl: "https://feb.es",
  },
  {
    id: "segunda-feb",
    nombre: "Segunda FEB",
    standingsUrl: "https://feb.es",
    mainUrl: "https://feb.es",
  },
  {
    id: "liga-femenina-endesa",
    nombre: "Liga Femenina Endesa",
    standingsUrl: "https://feb.es",
    mainUrl: "https://feb.es",
  },
  {
    id: "lf-challenge",
    nombre: "LF Challenge",
    standingsUrl: "https://feb.es",
    mainUrl: "https://feb.es",
  },
  {
    id: "lf2",
    nombre: "LF2",
    standingsUrl: "https://feb.es",
    mainUrl: "https://feb.es",
    standingsGroups: [
      { id: "88868", name: "A" },
      { id: "88869", name: "B" },
    ],
  },
  {
    id: "tercera-feb",
    nombre: "Tercera FEB",
    standingsUrl: "https://feb.es",
    mainUrl: "https://feb.es",
  },
] as const;

export const COMPETICION_IDS = COMPETICIONES.map(c => c.id);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const CACHE_FILE = path.join(DATA_DIR, "feb-stats.json");

let cacheEnMemoria: FebStats | null = null;
let ultimaActualizacion: Date | null = null;

export async function cargarCacheDesconoce(): Promise<FebStats | null> {
  try {
    const contenido = await readFile(CACHE_FILE, "utf-8");
    cacheEnMemoria = JSON.parse(contenido) as FebStats;
    return cacheEnMemoria;
  } catch {
    return null;
  }
}

export function obtenerCache(): FebStats | null { return cacheEnMemoria; }
export function obtenerUltimaActualizacion(): Date | null { return ultimaActualizacion; }

async function fetchHtml(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const respuesta = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return await respuesta.text();
  } finally {
    clearTimeout(timer);
  }
}

async function scrapearClasificacion(url: string, liga: string, groupId?: string, groupLabel?: string): Promise<ClasificacionEntry[]> {
  const html = await fetchHtml(url);
  const $ = load(html);
  const clasificacion: ClasificacionEntry[] = [];

  $("table.tabla-estadistica tr").each((_i, fila) => {
    const pos = parseInt($(fila).find("td.posicion").text().trim(), 10);
    if (isNaN(pos)) return;

    const equipo = $(fila).find("td.equipo a").text().trim() || $(fila).find("td.equipo").text().trim().replace(/\s+/g, " ");
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
      groupName: groupLabel
    });
  });
  return clasificacion;
}

export async function scrapearUna(id: typeof COMPETICIONES[number]["id"]): Promise<CompeticionData> {
  const comp = COMPETICIONES.find(c => c.id === id);
  if (!comp) throw new Error(`Competición no soportada: ${id}`);
  let clasi: ClasificacionEntry[] = [];
  if ('standingsGroups' in comp && comp.standingsGroups) {
    for (const g of comp.standingsGroups) {
      const resG = await scrapearClasificacion(comp.standingsUrl, comp.nombre, g.id, g.name);
      clasi = clasi.concat(resG);
    }
  } else {
    clasi = await scrapearClasificacion(comp.standingsUrl, comp.nombre);
  }
  return { liga: comp.nombre, actualizacion: new Date().toISOString(), clasificacion: clasi, resultados: [] };
}

export async function scrapearTodas(): Promise<FebStats> {
  const resultadosGlobales: FebStats = {};
  await mkdir(DATA_DIR, { recursive: true });
  for (const comp of COMPETICIONES) {
    try {
      logger.info(`FEB scraper: procesando... liga: "${comp.nombre}"`);
      const data = await scrapearUna(comp.id);
      resultadosGlobales[comp.id] = data;
    } catch (err) {
      logger.error(`FEB: error en liga ${comp.nombre}: ${(err as Error).message}`);
    }
  }
  cacheEnMemoria = resultadosGlobales;
  ultimaActualizacion = new Date();
  await writeFile(CACHE_FILE, JSON.stringify(resultadosGlobales, null, 2), "utf-8");
  return resultadosGlobales;
}

export async function scrapearEstadisticasBEV(): Promise<any> { return {}; }
export async function scrapeBEVAllLeaguePlayers(): Promise<any> { return {}; }
export async function scrapeBEVAllLeagueLogos(): Promise<any> { return {}; }
