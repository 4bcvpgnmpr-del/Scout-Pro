/**
 * ScoutFlow — Diagnóstico del scraper FEB
 *
 * Este script abre la página de estadísticas de la FEB con Puppeteer,
 * espera a que cargue el contenido dinámico, y vuelca toda la estructura
 * de tablas que encuentra para poder identificar los selectores reales.
 *
 * Uso:  npx tsx scoutflow-debug/inspect-feb.ts
 */

import puppeteer from "puppeteer";

const TEST_URL = "https://baloncestoenvivo.feb.es/estadisticas.aspx?g=9&t=2025&nm=lf2";

async function inspect() {
  console.log(`\n🔍 Abriendo: ${TEST_URL}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();

  // Capturar llamadas de red para ver si hay un endpoint AJAX separado
  const xhrCalls: string[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (
      response.request().resourceType() === "xhr" ||
      response.request().resourceType() === "fetch"
    ) {
      xhrCalls.push(`${response.status()} ${url}`);
    }
  });

  await page.goto(TEST_URL, { waitUntil: "networkidle2", timeout: 30_000 });

  // Esperar un poco extra por si hay renderizado tardío
  await new Promise((r) => setTimeout(r, 3000));

  console.log("📡 Llamadas XHR/fetch detectadas durante la carga:");
  if (xhrCalls.length === 0) {
    console.log("   (ninguna — los datos podrían venir embebidos en el HTML inicial o en un iframe)");
  } else {
    xhrCalls.forEach((c) => console.log("  ", c));
  }

  console.log("\n📋 Todas las tablas encontradas en la página:");
  const tables = await page.evaluate(() => {
    const allTables = Array.from(document.querySelectorAll("table"));
    return allTables.map((t, i) => ({
      index: i,
      id: t.id || "(sin id)",
      classes: t.className || "(sin clases)",
      rowCount: t.querySelectorAll("tr").length,
      firstRowText: t.querySelector("tr")?.textContent?.trim().slice(0, 150) ?? "",
    }));
  });

  if (tables.length === 0) {
    console.log("   ⚠️  No se encontró ningún <table> en la página.");
  } else {
    tables.forEach((t) =>
      console.log(
        `   [${t.index}] id="${t.id}" class="${t.classes}" filas=${t.rowCount}\n        primera fila: ${t.firstRowText}`
      )
    );
  }

  console.log("\n🖼️  Buscando iframes (a veces las stats viven dentro de uno):");
  const iframes = await page.evaluate(() =>
    Array.from(document.querySelectorAll("iframe")).map((f) => f.src)
  );
  if (iframes.length === 0) {
    console.log("   (ninguno)");
  } else {
    iframes.forEach((src) => console.log("  ", src));
  }

  console.log("\n📄 Guardando captura de pantalla y HTML completo para inspección manual...");
  await page.screenshot({ path: "scoutflow-debug/feb-page.png", fullPage: true });

  const html = await page.content();
  const fs = await import("fs");
  fs.writeFileSync("scoutflow-debug/feb-page.html", html);

  console.log("\n✅ Listo. Revisa:");
  console.log("   - scoutflow-debug/feb-page.png  (captura visual)");
  console.log("   - scoutflow-debug/feb-page.html (HTML completo renderizado)");
  console.log("\nCon esa información, ajusta los selectores en server/scrapers/feb.scraper.ts");
  console.log("para que apunten a la tabla real encontrada arriba.\n");

  await browser.close();
}

inspect().catch((err) => {
  console.error("❌ Error durante el diagnóstico:", err);
  process.exit(1);
});
