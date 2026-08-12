/**
 * WatchlistPDF — "OBJETIVOS DE FICHAJE" export.
 *
 * Pages:
 *   1. Portada   — dark premium cover with title + season
 *   2+. Tabla    — one row per player: #, Jugadora, Equipo, Liga, Valoración, Importancia
 *   Last. Resumen — totals by importancia + average rating
 */

import { useState, useEffect, useCallback } from "react";
import { FileDown, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WatchlistPlayer {
  id: number;
  name: string;
  position?: string | null;
  jerseyNumber?: number | null;
  teamId?: number | null;
  teamName?: string | null;
  teamLogoUrl?: string | null;
}

interface TeamInfo {
  id: number;
  name: string;
  league?: string | null;
}

interface PlayerStats {
  avgPoints?: string | number | null;
  avgRebounds?: string | number | null;
  avgAssists?: string | number | null;
  avgSteals?: string | number | null;
  avgBlocks?: string | number | null;
  avgMinutes?: string | number | null;
  avgFieldGoalPct?: string | number | null;
  avgThreePointPct?: string | number | null;
  avgFreeThrowPct?: string | number | null;
  gamesPlayed?: number | null;
}

interface ReportRecord {
  id: number;
  rating?: number | null;
}

type ImportanciaVal = "clave" | "medio" | "normal" | null;

interface EnrichedPlayer extends WatchlistPlayer {
  league: string | null;
  importancia: ImportanciaVal;
  rating: number | null; // latest scouting report rating (0-10)
  stats: PlayerStats | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getImportancia(playerId: number): ImportanciaVal {
  try {
    const raw = localStorage.getItem(`sp-profile-${playerId}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const imp = p.importancia;
    if (imp === "clave" || imp === "medio" || imp === "normal") return imp;
    return null;
  } catch { return null; }
}

async function fetchStats(id: number): Promise<PlayerStats | null> {
  try {
    const r = await fetch(`/api/players/${id}/stats`, { credentials: "include" });
    return r.ok ? (await r.json()) as PlayerStats : null;
  } catch { return null; }
}

async function fetchReports(playerId: number): Promise<ReportRecord[]> {
  try {
    const r = await fetch(`/api/reports?playerId=${playerId}`, { credentials: "include" });
    return r.ok ? (await r.json()) as ReportRecord[] : [];
  } catch { return []; }
}

async function imgBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const proxy = /^https?:\/\//i.test(url) ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url;
    const r = await fetch(proxy, { credentials: "include" });
    if (!r.ok) return null;
    const blob = await r.blob();
    return new Promise<string>((res, rej) => {
      const rd = new FileReader();
      rd.onloadend = () => res(rd.result as string);
      rd.onerror = rej;
      rd.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─── jsPDF design tokens ──────────────────────────────────────────────────────

type JsPDF = import("jspdf").jsPDF;
type RGB = readonly [number, number, number];

const PW = 210, PH = 297;
const ML = 16, MR = 16, MT = 20, FOOT = 15;
const CW = PW - ML - MR;

const D = {
  dark:   [15, 23, 42]     as RGB,
  mid:    [71, 85, 105]    as RGB,
  light:  [100, 116, 139]  as RGB,
  accent: [249, 115, 22]   as RGB,
  accentL:[255, 247, 237]  as RGB,
  white:  [255, 255, 255]  as RGB,
  rowAlt: [248, 250, 252]  as RGB,
  border: [226, 232, 240]  as RGB,
  hdrBg:  [241, 245, 249]  as RGB,
  impRed: [239, 68, 68]    as RGB,
  impAmb: [245, 158, 11]   as RGB,
  impGrn: [34, 197, 94]    as RGB,
  ratingGrn: [22, 163, 74] as RGB,
  ratingRed: [220, 38, 38] as RGB,
};

const sf = (doc: JsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const sd = (doc: JsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
const st = (doc: JsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
const ini = (name: string) => name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();

function impColor(imp: ImportanciaVal): RGB {
  if (imp === "clave") return D.impRed;
  if (imp === "medio") return D.impAmb;
  if (imp === "normal") return D.impGrn;
  return [156, 163, 175] as RGB;
}

function ratingColor(v: number | null): RGB {
  if (v == null) return D.mid;
  if (v >= 7) return D.ratingGrn;
  if (v < 5) return D.ratingRed;
  return D.dark;
}

function sectionTitle(doc: JsPDF, label: string, y: number, accent: RGB = D.accent): number {
  sf(doc, accent); doc.rect(ML, y, 3, 6, "F");
  const bg: RGB = [Math.round(accent[0] * 0.08 + 248), Math.round(accent[1] * 0.08 + 248), Math.round(accent[2] * 0.08 + 245)];
  sf(doc, bg); doc.rect(ML + 3, y, CW - 3, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); st(doc, D.dark);
  doc.text(label.toUpperCase(), ML + 8, y + 4.2);
  return y + 9;
}

function pageFooter(doc: JsPDF, right: string) {
  sd(doc, D.border); doc.setLineWidth(0.25);
  doc.line(ML, PH - FOOT + 3, PW - MR, PH - FOOT + 3);
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, D.accent);
  doc.text("ScoutPro", ML, PH - FOOT + 8);
  doc.setFont("helvetica", "normal"); st(doc, D.mid);
  doc.text(" · Objetivos de fichaje", ML + 14, PH - FOOT + 8);
  st(doc, D.mid); doc.text(right, PW - MR, PH - FOOT + 8, { align: "right" });
}

function pageHeader(doc: JsPDF, season: string) {
  sf(doc, D.dark); doc.rect(0, 0, PW, MT, "F");
  sf(doc, D.accent); doc.rect(0, 0, PW, 2, "F");

  // Star icon placeholder
  sf(doc, [249, 115, 22]); doc.circle(ML + 5, MT / 2, 4.5, "F");
  sf(doc, D.dark); doc.circle(ML + 5, MT / 2, 3, "F");
  sf(doc, D.accent);
  // Simple star using text
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); st(doc, D.accent);
  doc.text("★", ML + 5, MT / 2 + 1.8, { align: "center" });

  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); st(doc, D.white);
  doc.text("OBJETIVOS DE FICHAJE", ML + 14, MT / 2 + 1.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); st(doc, [148, 163, 184]);
  doc.text(`Temporada ${season}`, ML + 14, MT / 2 + 6.5);

  doc.setFont("helvetica", "bold"); doc.setFontSize(7); st(doc, D.accent);
  doc.text("WATCHLIST", PW - MR, MT / 2 + 1.5, { align: "right" });
}

// ─── Page 1: Cover ────────────────────────────────────────────────────────────

function drawCover(doc: JsPDF, season: string, players: EnrichedPlayer[]) {
  sf(doc, D.dark); doc.rect(0, 0, PW, PH, "F");
  // Accent right strip
  sf(doc, D.accent); doc.rect(PW - 8, 0, 8, PH, "F");
  // Top bar
  sf(doc, [24, 37, 63]); doc.rect(0, 0, PW - 8, 3, "F");

  const cx = (PW - 8) / 2;

  // Brand
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); st(doc, [100, 116, 139]);
  doc.text("SCOUTPRO", cx, 18, { align: "center" });

  // Type tag
  sf(doc, [24, 37, 63]);
  doc.roundedRect(cx - 45, 23, 90, 8, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, D.accent);
  doc.text("LISTA DE OBJETIVOS DE FICHAJE", cx, 28, { align: "center" });

  // Star emblem
  const embY = 85;
  sf(doc, [20, 32, 55]); doc.circle(cx, embY, 28, "F");
  sd(doc, D.accent); doc.setLineWidth(0.8); doc.circle(cx, embY, 28, "D");
  doc.setFont("helvetica", "bold"); doc.setFontSize(36); st(doc, D.accent);
  doc.text("★", cx, embY + 8, { align: "center" });

  // Title
  doc.setFont("helvetica", "bold"); doc.setFontSize(24); st(doc, D.white);
  doc.text("OBJETIVOS DE", cx, embY + 42, { align: "center" });
  doc.text("FICHAJE", cx, embY + 54, { align: "center" });

  doc.setFont("helvetica", "normal"); doc.setFontSize(10); st(doc, [148, 163, 184]);
  doc.text(`Temporada ${season}`, cx, embY + 66, { align: "center" });

  // Divider
  sf(doc, D.accent); doc.rect(cx - 20, embY + 73, 40, 0.8, "F");

  // Stats boxes
  const clave = players.filter(p => p.importancia === "clave").length;
  const medio = players.filter(p => p.importancia === "medio").length;
  const normal = players.filter(p => p.importancia === "normal" || p.importancia == null).length;
  const withRating = players.filter(p => p.rating != null);
  const avgRating = withRating.length ? (withRating.reduce((s, p) => s + p.rating!, 0) / withRating.length) : null;

  const boxY = embY + 86;
  const boxW = 33, boxH = 22, gap = 5;
  const total4 = boxW * 4 + gap * 3;
  const bx0 = cx - total4 / 2;
  const boxes = [
    { label: "Objetivos", value: String(players.length) },
    { label: "Clave", value: String(clave), color: D.impRed },
    { label: "Medio", value: String(medio), color: D.impAmb },
    { label: "Val. media", value: avgRating != null ? avgRating.toFixed(1) + "/10" : "—" },
  ];
  boxes.forEach((b, i) => {
    const bx = bx0 + i * (boxW + gap);
    sf(doc, [20, 32, 55]); doc.roundedRect(bx, boxY, boxW, boxH, 2, 2, "F");
    if (b.color) {
      sd(doc, b.color); doc.setLineWidth(0.4);
    } else {
      sd(doc, [35, 50, 75]); doc.setLineWidth(0.3);
    }
    doc.roundedRect(bx, boxY, boxW, boxH, 2, 2, "D");
    if (b.color) { st(doc, b.color); } else { st(doc, D.white); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(b.value, bx + boxW / 2, boxY + 11, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); st(doc, [100, 116, 139]);
    doc.text(b.label.toUpperCase(), bx + boxW / 2, boxY + 19, { align: "center" });
  });

  // Contents list
  const listY = boxY + boxH + 14;
  sf(doc, [20, 32, 55]); doc.roundedRect(cx - 50, listY, 100, 48, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, [100, 116, 139]);
  doc.text("CONTENIDO DEL INFORME", cx, listY + 7, { align: "center" });
  const items = [
    "Lista completa de objetivos de fichaje",
    "Equipo, liga e importancia por jugadora",
    "Valoración de scouting (0-10)",
    "Resumen y estadísticas de la watchlist",
  ];
  items.forEach((item, i) => {
    sf(doc, D.accent); doc.circle(cx - 38, listY + 15 + i * 9, 1.3, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(doc, [180, 195, 215]);
    doc.text(item, cx - 33, listY + 16 + i * 9);
  });

  // Footer
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  sd(doc, [30, 45, 68]); doc.setLineWidth(0.25); doc.line(ML, PH - 18, PW - 16, PH - 18);
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, D.accent);
  doc.text("ScoutPro", ML, PH - 11);
  doc.setFont("helvetica", "normal"); st(doc, [70, 85, 104]);
  doc.text(`  ·  Generado el ${today}`, ML + 13, PH - 11);
  st(doc, [45, 58, 78]); doc.text("Documento confidencial", PW - 16, PH - 11, { align: "right" });
}

// ─── Table columns ────────────────────────────────────────────────────────────

const COLS = [
  { label: "#",          w: 9,  align: "center" as const },
  { label: "Jugadora",   w: 50, align: "left"   as const },
  { label: "Equipo",     w: 38, align: "left"   as const },
  { label: "Liga",       w: 30, align: "left"   as const },
  { label: "Valoración", w: 22, align: "center" as const },
  { label: "Importancia",w: 29, align: "center" as const },
];

function colX(i: number): number {
  let x = ML;
  for (let j = 0; j < i; j++) x += COLS[j].w;
  return x;
}

function drawTableHeader(doc: JsPDF, y: number): number {
  const ROW_H = 7;
  sf(doc, D.hdrBg); doc.rect(ML, y, CW, ROW_H, "F");
  sd(doc, D.border); doc.setLineWidth(0.2); doc.rect(ML, y, CW, ROW_H, "D");
  COLS.forEach((c, i) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, D.mid);
    const x = colX(i) + (c.align === "center" ? c.w / 2 : 2);
    doc.text(c.label.toUpperCase(), x, y + 4.5, { align: c.align });
  });
  return y + ROW_H;
}

function drawPlayerRow(doc: JsPDF, p: EnrichedPlayer, rowIndex: number, y: number): number {
  const ROW_H = 9;
  if (rowIndex % 2 === 1) { sf(doc, D.rowAlt); doc.rect(ML, y, CW, ROW_H, "F"); }
  sd(doc, D.border); doc.setLineWidth(0.15);
  doc.line(ML, y + ROW_H, ML + CW, y + ROW_H);

  const cy = y + ROW_H / 2 + 1.2;

  // # (row number 1-based)
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); st(doc, D.mid);
  doc.text(String(rowIndex + 1), colX(0) + COLS[0].w / 2, cy, { align: "center" });

  // Jugadora
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); st(doc, D.dark);
  const nm = p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name;
  doc.text(nm, colX(1) + 2, cy);
  if (p.position) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(5.5); st(doc, D.accent);
    sf(doc, D.accentL);
    const posW = 9, posX = colX(1) + 2;
    doc.roundedRect(posX, y + ROW_H - 4.5, posW, 3.5, 0.7, 0.7, "F");
    doc.text(p.position, posX + posW / 2, y + ROW_H - 2, { align: "center" });
  }

  // Equipo
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(doc, D.mid);
  const teamStr = p.teamName ?? "—";
  doc.text(teamStr.length > 16 ? teamStr.slice(0, 14) + "…" : teamStr, colX(2) + 2, cy);

  // Liga
  const ligaStr = p.league ?? "—";
  doc.text(ligaStr.length > 12 ? ligaStr.slice(0, 11) + "…" : ligaStr, colX(3) + 2, cy);

  // Valoración
  if (p.rating != null) {
    const rCol = ratingColor(p.rating);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); st(doc, rCol);
    doc.text(p.rating.toFixed(1), colX(4) + COLS[4].w / 2, cy, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); st(doc, D.light);
    doc.text("/10", colX(4) + COLS[4].w / 2 + 5.5, cy + 0.5);
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(doc, [200, 210, 220] as RGB);
    doc.text("—", colX(4) + COLS[4].w / 2, cy, { align: "center" });
  }

  // Importancia
  const imp = p.importancia;
  const ic = impColor(imp);
  sf(doc, ic); doc.circle(colX(5) + 4, cy - 0.5, 2.3, "F");
  const impLabel = imp === "clave" ? "Clave" : imp === "medio" ? "Medio" : imp === "normal" ? "Normal" : "—";
  doc.setFont("helvetica", imp ? "bold" : "normal"); doc.setFontSize(7); st(doc, imp ? ic : [200, 210, 220] as RGB);
  doc.text(impLabel, colX(5) + 8, cy);

  return ROW_H;
}

// ─── Pages 2+: Player table ───────────────────────────────────────────────────

function drawPlayerPages(doc: JsPDF, players: EnrichedPlayer[], season: string, startPage: number): number {
  const MAX_Y = PH - FOOT - 2;
  let pageNum = startPage;
  let y = MT + 4;

  const startPage_ = () => {
    sf(doc, D.white); doc.rect(0, 0, PW, PH, "F");
    pageHeader(doc, season);
    y = MT + 6;
  };

  startPage_();
  y = sectionTitle(doc, `Lista de objetivos · ${players.length} jugadoras`, y);
  y = drawTableHeader(doc, y);

  players.forEach((p, i) => {
    if (y + 9 > MAX_Y) {
      pageFooter(doc, `Pág. ${pageNum}`);
      doc.addPage(); pageNum++;
      startPage_();
      y = sectionTitle(doc, "Lista de objetivos (continuación)", y);
      y = drawTableHeader(doc, y);
    }
    drawPlayerRow(doc, p, i, y);
    y += 9;
  });

  pageFooter(doc, `Pág. ${pageNum}`);
  return pageNum;
}

// ─── Summary page ─────────────────────────────────────────────────────────────

function drawSummary(doc: JsPDF, players: EnrichedPlayer[], season: string, pageNum: number) {
  sf(doc, D.white); doc.rect(0, 0, PW, PH, "F");
  pageHeader(doc, season);

  let y = MT + 6;
  y = sectionTitle(doc, "Resumen · Objetivos de fichaje");

  const clave  = players.filter(p => p.importancia === "clave").length;
  const medio  = players.filter(p => p.importancia === "medio").length;
  const normal = players.filter(p => p.importancia === "normal").length;
  const sin    = players.filter(p => p.importancia == null).length;
  const total  = players.length;

  const withRating = players.filter(p => p.rating != null);
  const avgRating = withRating.length
    ? withRating.reduce((s, p) => s + p.rating!, 0) / withRating.length
    : null;

  const rows: Array<[string, string, RGB | undefined]> = [
    ["Total objetivos de fichaje", String(total), undefined],
    ["● Jugadoras Clave", `${clave}  (${total ? Math.round(clave / total * 100) : 0}%)`, D.impRed],
    ["● Jugadoras Medio", `${medio}  (${total ? Math.round(medio / total * 100) : 0}%)`, D.impAmb],
    ["● Jugadoras Normal", `${normal}  (${total ? Math.round(normal / total * 100) : 0}%)`, D.impGrn],
    ["Sin clasificar", String(sin), undefined],
    ["Valoración media de scouting", avgRating != null ? avgRating.toFixed(1) + " / 10" : "Sin valoraciones", avgRating != null ? ratingColor(avgRating) : undefined],
  ];

  type RGB = readonly [number, number, number];

  const tblW = 140, tblX = ML;
  rows.forEach(([label, val, col], i) => {
    if (i % 2 === 1) { sf(doc, D.rowAlt); doc.rect(tblX, y, tblW, 9, "F"); }
    sd(doc, D.border); doc.setLineWidth(0.2); doc.line(tblX, y, tblX + tblW, y);

    if (col && label.startsWith("●")) {
      sf(doc, col); doc.circle(tblX + 4, y + 4.5, 2, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); st(doc, D.mid);
      doc.text(label.slice(2), tblX + 10, y + 6.3);
    } else {
      doc.setFont("helvetica", i === 0 ? "bold" : "normal"); doc.setFontSize(8); st(doc, D.mid);
      doc.text(label, tblX + 10, y + 6.3);
    }

    doc.setFont("helvetica", "bold"); st(doc, col ?? D.dark);
    doc.text(val, tblX + tblW - 5, y + 6.3, { align: "right" });
    y += 9;
  });
  sd(doc, D.border); doc.setLineWidth(0.2); doc.line(tblX, y, tblX + tblW, y);
  doc.rect(tblX, y - rows.length * 9, tblW, rows.length * 9, "D");

  y += 12;

  // Top Clave players
  const clavePlayers = players.filter(p => p.importancia === "clave");
  if (clavePlayers.length) {
    y = sectionTitle(doc, `Jugadoras Clave  (${clavePlayers.length})`, y, D.impRed);
    y = drawTableHeader(doc, y);
    clavePlayers.forEach((p, i) => {
      if (y + 9 > PH - FOOT - 2) return;
      drawPlayerRow(doc, p, i, y);
      y += 9;
    });
    y += 6;
  }

  // Legend
  if (y + 40 < PH - FOOT - 2) {
    y += 4;
    y = sectionTitle(doc, "Leyenda de Importancia", y);
    const legend = [
      { imp: "clave",  color: D.impRed, label: "Clave — Objetivo prioritario. Diferencial en la liga." },
      { imp: "medio",  color: D.impAmb, label: "Medio — Objetivo relevante. Encaja en el proyecto." },
      { imp: "normal", color: D.impGrn, label: "Normal — Objetivo de seguimiento. A valorar a largo plazo." },
    ];
    legend.forEach(({ color, label }) => {
      sf(doc, color); doc.circle(ML + 3, y + 3.5, 2.2, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); st(doc, D.dark);
      doc.text(label, ML + 8, y + 5);
      y += 9;
    });

    y += 4;
    doc.setFont("helvetica", "italic"); doc.setFontSize(7); st(doc, [156, 163, 175] as RGB);
    doc.text("Valoración: Verde ≥ 7 · Rojo < 5 · Basado en el último informe de scouting.", ML, y);
  }

  pageFooter(doc, `Pág. ${pageNum}`);
}

// ─── Export button ─────────────────────────────────────────────────────────────

export function WatchlistPdfExportButton({
  players,
  teams,
  season = "2024-25",
}: {
  players: WatchlistPlayer[];
  teams: TeamInfo[];
  season?: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");

  const handleExport = useCallback(async () => {
    if (!players.length) return;
    setExporting(true);
    setProgress("Cargando datos…");
    try {
      const { default: jsPDF } = await import("jspdf");

      // Enrich players in parallel
      setProgress("Obteniendo valoraciones…");
      const enriched: EnrichedPlayer[] = await Promise.all(
        players.map(async (p) => {
          const teamInfo = teams.find(t => t.id === p.teamId);
          const [stats, reports] = await Promise.all([
            fetchStats(p.id),
            fetchReports(p.id),
          ]);
          const latestRating = reports.length > 0
            ? (reports[0].rating ?? null)
            : null;
          return {
            ...p,
            league: teamInfo?.league ?? null,
            importancia: getImportancia(p.id),
            rating: latestRating,
            stats,
          };
        })
      );

      // Sort by importance priority
      const IMP_ORDER: Record<string, number> = { clave: 0, medio: 1, normal: 2 };
      enriched.sort((a, b) => {
        const ai = a.importancia ? (IMP_ORDER[a.importancia] ?? 3) : 3;
        const bi = b.importancia ? (IMP_ORDER[b.importancia] ?? 3) : 3;
        if (ai !== bi) return ai - bi;
        return (b.rating ?? -1) - (a.rating ?? -1);
      });

      setProgress("Generando PDF…");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Page 1: Cover
      drawCover(doc, season, enriched);

      // Pages 2+: Player table
      doc.addPage();
      const lastPage = drawPlayerPages(doc, enriched, season, 2);

      // Summary page
      doc.addPage();
      drawSummary(doc, enriched, season, lastPage + 1);

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`objetivos-fichaje-${dateStr}.pdf`);
    } catch (err) {
      console.error("Watchlist PDF export failed", err);
    } finally {
      setExporting(false);
      setProgress("");
    }
  }, [players, teams, season]);

  return (
    <button
      onClick={handleExport}
      disabled={exporting || players.length === 0}
      className="flex items-center gap-1.5 text-xs font-black tracking-wide uppercase px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted transition disabled:opacity-50"
      title={players.length === 0 ? "No hay jugadoras en la watchlist" : "Exportar PDF de objetivos"}
    >
      {exporting
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <FileDown className="h-3.5 w-3.5" />}
      {exporting ? (progress || "Generando…") : "Exportar PDF"}
    </button>
  );
}
