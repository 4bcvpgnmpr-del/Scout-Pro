/**
 * ScoutFlow — Diagnóstico de páginas de jugador individual
 *
 * Confirmado por el usuario: existen páginas tipo
 *   https://baloncestoenvivo.feb.es/jugador/{id1}/{id2}
 * con stats por jugador. El diagnóstico anterior (box scores por partido)
 * no encontró nada, así que probamos un camino distinto: localizar estos
 * enlaces /jugador/ directamente desde la página de equipo o estadísticas,
 * y volcar la estructura de la página de jugador para parsearla.
 *
 * Uso:  npx tsx scoutflow-debug3/inspect-player-links.ts
 */

import axios from "axios";
import * as cheerio from "cheerio";

const LEAGUE_ID = 9;   // LF2
const SEASON = 2025;
const SLUG = "lf2";

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; ScoutFlowBot/1.0)" };

async function fetchHtml(url: string) {
  const { data } = await axios.get(url, { headers: HEADERS });
  return data as string;
}

async function findPlayerLinks(url: string, label: string): Promise<string[]> {
  console.log(`\n🔍 Buscando enlaces /jugador/ en: ${label}`);
  console.log(`   ${url}`);

  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const links = new Set<string>();
  $("a").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.includes("/jugador/") || href.toLowerCase().includes("jugador.aspx")) {
      links.add(href);
    }
  });

  console.log(`   Encontrados: ${links.size}`);
  [...links].slice(0, 8).forEach((l) => console.log("   →", l));

  return [...links];
}

async function inspectPlayerPage(relativeOrAbsoluteUrl: string) {
  const url = relativeOrAbsoluteUrl.startsWith("http")
    ? relativeOrAbsoluteUrl
    : `https://baloncestoenvivo.feb.es/${relativeOrAbsoluteUrl.replace(/^\//, "")}`;

  console.log(`\n📊 Inspeccionando página de jugador: ${url}\n`);

  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  console.log(`   Título de la página: ${$("title").text().trim()}`);

  const tables = $("table");
  console.log(`   Tablas encontradas: ${tables.length}\n`);

  tables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find("tr");
    const allRowsText = rows
      .slice(0, 4)
      .map((_, tr) => $(tr).text().replace(/\s+/g, " ").trim().slice(0, 180))
      .get();

    console.log(`   [Tabla ${i}] id="${$table.attr("id") ?? "(sin id)"}" class="${$table.attr("class") ?? "(sin clase)"}" filas=${rows.length}`);
    allRowsText.forEach((t, idx) => console.log(`        fila ${idx}: ${t}`));
    console.log("");
  });

  const fs = await import("fs");
  fs.writeFileSync("scoutflow-debug3/player-page.html", html);
  console.log("   💾 HTML completo guardado en scoutflow-debug3/player-page.html\n");
}

async function main() {
  // 1) Probar desde la página de estadísticas de la liga (por si los nombres
  //    de jugador en la tabla de equipo enlazan a su ficha individual)
  const statsUrl = `https://baloncestoenvivo.feb.es/estadisticas.aspx?g=${LEAGUE_ID}&t=${SEASON}&nm=${SLUG}`;
  let links = await findPlayerLinks(statsUrl, "Estadísticas de liga");

  // 2) Si no hay nada ahí, probar resultados (los box scores enlazan a jugadores)
  if (links.length === 0) {
    const resultsUrl = `https://baloncestoenvivo.feb.es/resultados.aspx?g=${LEAGUE_ID}&t=${SEASON}&nm=${SLUG}`;
    links = await findPlayerLinks(resultsUrl, "Resultados de liga");
  }

  // 3) Si tampoco, inspeccionar directamente el link de ejemplo que nos dio el usuario
  const FALLBACK_PLAYER_URL = "https://baloncestoenvivo.feb.es/jugador/980023/1944150";

  if (links.length > 0) {
    await inspectPlayerPage(links[0]);
  } else {
    console.log("\n⚠️  No se encontraron enlaces /jugador/ en las páginas de listado.");
    console.log("   Inspeccionando directamente la URL de ejemplo proporcionada por el usuario...");
    await inspectPlayerPage(FALLBACK_PLAYER_URL);
  }

  console.log("\n✅ Diagnóstico completo.\n");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
