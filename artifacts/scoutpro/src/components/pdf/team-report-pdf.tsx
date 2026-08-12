/**
 * TeamReportPDF — FastScout-style professional A4 dossier.
 *
 * Pages:
 *   1. Portada        — dark premium cover with team logo
 *   2+. Plantilla     — roster table organized by position (white)
 *   Last. Resumen     — team summary stats (white)
 *   +. Sistemas       — tactical images (white)
 *
 * Design: FastScout style — white inner pages, left-bar section titles,
 * importance dots, colored percentages, alternating table rows.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useListPlayers, useListTeamMedia, getListTeamMediaQueryKey } from "@workspace/api-client-react";
import { FileDown, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerStats {
  gamesPlayed?: number | null;
  avgPoints?: string | number | null;
  avgRebounds?: string | number | null;
  avgAssists?: string | number | null;
  avgSteals?: string | number | null;
  avgBlocks?: string | number | null;
  avgMinutes?: string | number | null;
  avgFieldGoalPct?: string | number | null;
  avgThreePointPct?: string | number | null;
  avgFreeThrowPct?: string | number | null;
}
interface Team { id: number; name: string; logoUrl?: string | null; league?: string | null; city?: string | null; }
interface Player { id: number; name: string; position?: string | null; jerseyNumber?: number | null; photoUrl?: string | null; age?: number | null; height?: string | null; nationality?: string | null; }
interface PlayerWithStats extends Player { stats: PlayerStats | null; importancia: "clave" | "medio" | "normal" | null; }
interface MediaItem { id: number; title?: string | null; description?: string | null; url?: string | null; category: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const f1 = (v: string | number | null | undefined) => { const n = Number(v); return v != null && v !== "" && !isNaN(n) ? n.toFixed(1) : "—"; };
const f0 = (v: string | number | null | undefined) => { const n = Number(v); return v != null && v !== "" && !isNaN(n) ? n.toFixed(0) : "—"; };
const fPct = (v: string | number | null | undefined) => { const n = Number(v); return v != null && v !== "" && !isNaN(n) ? `${(n * 100).toFixed(0)}%` : "—"; };
const ini = (name: string) => name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();

function getImportancia(playerId: number): "clave" | "medio" | "normal" | null {
  try {
    const raw = localStorage.getItem(`sp-profile-${playerId}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const imp = p.importancia;
    if (imp === "clave" || imp === "medio" || imp === "normal") return imp;
    return null;
  } catch { return null; }
}

async function fetchPlayerStats(id: number): Promise<PlayerStats | null> {
  try {
    const r = await fetch(`/api/players/${id}/stats`, { credentials: "include" });
    return r.ok ? (await r.json()) as PlayerStats : null;
  } catch { return null; }
}
async function imgBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const proxy = /^https?:\/\//i.test(url) ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url;
    const r = await fetch(proxy, { credentials: "include" });
    if (!r.ok) return null;
    const blob = await r.blob();
    return new Promise<string>((res, rej) => { const rd = new FileReader(); rd.onloadend = () => res(rd.result as string); rd.onerror = rej; rd.readAsDataURL(blob); });
  } catch { return null; }
}
async function fetchAllImages(urls: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  const pairs = await Promise.all(unique.map(async u => { const b = await imgBase64(u); return b ? ([u, b] as const) : null; }));
  return Object.fromEntries(pairs.filter((p): p is [string, string] => p !== null));
}

// ─── jsPDF drawing system ─────────────────────────────────────────────────────

type JsPDF = import("jspdf").jsPDF;
type RGB = readonly [number, number, number];

const PW = 210, PH = 297;
const ML = 16, MR = 16, MT = 20, FOOT = 15;
const CW = PW - ML - MR;

// Design tokens
const D = {
  dark:    [15, 23, 42]     as RGB,   // #0F172A
  mid:     [71, 85, 105]    as RGB,   // #475569
  accent:  [249, 115, 22]   as RGB,   // #f97316
  accentL: [255, 247, 237]  as RGB,   // #fff7ed
  white:   [255, 255, 255]  as RGB,
  rowAlt:  [248, 250, 252]  as RGB,   // #F8FAFC
  border:  [226, 232, 240]  as RGB,   // #E2E8F0
  hdrBg:   [241, 245, 249]  as RGB,   // #F1F5F9 table header
  impRed:  [239, 68, 68]    as RGB,   // #EF4444 Clave
  impAmb:  [245, 158, 11]   as RGB,   // #F59E0B Medio
  impGrn:  [34, 197, 94]    as RGB,   // #22C55E Normal
  pctGrn:  [22, 163, 74]    as RGB,   // ≥50%
  pctRed:  [220, 38, 38]    as RGB,   // <35%
};

const sf = (doc: JsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const sd = (doc: JsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
const st = (doc: JsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

function impColor(imp: string | null): RGB {
  if (imp === "clave") return D.impRed;
  if (imp === "medio") return D.impAmb;
  if (imp === "normal") return D.impGrn;
  return [156, 163, 175] as RGB;
}
function pctColor(val: string | number | null | undefined): RGB {
  const n = Number(val);
  if (val == null || val === "" || isNaN(n)) return D.mid;
  if (n >= 0.50) return D.pctGrn;
  if (n < 0.35) return D.pctRed;
  return D.dark;
}

/** Section title with orange left bar + tinted background strip */
function sectionTitle(doc: JsPDF, label: string, y: number, accent: RGB = D.accent): number {
  sf(doc, accent); doc.rect(ML, y, 3, 6, "F");
  const bg: RGB = [Math.round(accent[0] * 0.08 + 248), Math.round(accent[1] * 0.08 + 248), Math.round(accent[2] * 0.08 + 245)];
  sf(doc, bg); doc.rect(ML + 3, y, CW - 3, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); st(doc, D.dark);
  doc.text(label.toUpperCase(), ML + 8, y + 4.2);
  return y + 9;
}

/** Standard page footer */
function pageFooter(doc: JsPDF, left: string, right: string) {
  sd(doc, D.border); doc.setLineWidth(0.25);
  doc.line(ML, PH - FOOT + 3, PW - MR, PH - FOOT + 3);
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, D.accent);
  doc.text("ScoutPro", ML, PH - FOOT + 8);
  doc.setFont("helvetica", "normal"); st(doc, D.mid);
  doc.text(` · ${left}`, ML + 14, PH - FOOT + 8);
  st(doc, D.mid); doc.text(right, PW - MR, PH - FOOT + 8, { align: "right" });
}

/** Page header (compact) for inner pages */
function pageHeader(doc: JsPDF, team: Team, season: string, logoB64: string | undefined) {
  sf(doc, D.dark); doc.rect(0, 0, PW, MT, "F");
  sf(doc, D.accent); doc.rect(0, 0, PW, 2, "F");
  // Logo
  if (logoB64) { try { doc.addImage(logoB64, ML, 3.5, 11, 11, undefined, "FAST"); } catch {} }
  else {
    sf(doc, [30, 45, 70]); doc.roundedRect(ML, 3.5, 11, 11, 1, 1, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, D.accent);
    doc.text(ini(team.name), ML + 5.5, 10, { align: "center" });
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); st(doc, D.white);
  doc.text(team.name.toUpperCase(), ML + 14, 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); st(doc, [148, 163, 184]);
  const sub = [team.league, season].filter(Boolean).join(" · ");
  doc.text(sub, ML + 14, 15);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); st(doc, D.accent);
  doc.text("INFORME DE PLANTILLA", PW - MR, 10, { align: "right" });
}

/** Draw avatar circle */
function drawAvatar(doc: JsPDF, b64: string | undefined, name: string, cx: number, cy: number, r: number) {
  sf(doc, D.rowAlt); doc.circle(cx, cy, r, "F");
  if (b64) { try { doc.addImage(b64, cx - r, cy - r, r * 2, r * 2, undefined, "FAST"); } catch {} }
  else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(r * 4.5); st(doc, D.accent);
    doc.text(ini(name), cx, cy + r * 0.8, { align: "center" });
  }
  sd(doc, D.border); doc.setLineWidth(0.2); doc.circle(cx, cy, r, "D");
}

// ─── Page 1: Cover ────────────────────────────────────────────────────────────

function drawCover(doc: JsPDF, team: Team, season: string, playerCount: number, logoB64: string | undefined) {
  sf(doc, D.dark); doc.rect(0, 0, PW, PH, "F");
  // Accent side strip
  sf(doc, D.accent); doc.rect(PW - 8, 0, 8, PH, "F");
  // Top bar
  sf(doc, [24, 37, 63]); doc.rect(0, 0, PW - 8, 3, "F");

  const cx = (PW - 8) / 2;

  // ScoutPro brand top
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); st(doc, [100, 116, 139]);
  doc.text("SCOUTPRO", cx, 18, { align: "center" });

  // Tag
  sf(doc, [24, 37, 63]);
  doc.roundedRect(cx - 40, 24, 80, 7, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, D.accent);
  doc.text("INFORME DE PLANTILLA RIVAL", cx, 28.5, { align: "center" });

  // Logo
  const LR = 24;
  const logoY = 75;
  sf(doc, [20, 32, 55]);
  doc.circle(cx, logoY, LR + 4, "F");
  sd(doc, D.accent); doc.setLineWidth(0.7);
  doc.circle(cx, logoY, LR + 4, "D");
  if (logoB64) { try { doc.addImage(logoB64, cx - LR, logoY - LR, LR * 2, LR * 2, undefined, "FAST"); } catch {} }
  else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); st(doc, D.accent);
    doc.text(ini(team.name), cx, logoY + 5, { align: "center" });
  }

  // Team name
  const fontSize = team.name.length > 20 ? 20 : 26;
  doc.setFont("helvetica", "bold"); doc.setFontSize(fontSize); st(doc, D.white);
  doc.text(team.name.toUpperCase(), cx, logoY + LR + 14, { align: "center" });

  if (team.league) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); st(doc, [148, 163, 184]);
    doc.text(team.league, cx, logoY + LR + 23, { align: "center" });
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); st(doc, [100, 116, 139]);
  doc.text(`Temporada ${season}`, cx, logoY + LR + 31, { align: "center" });

  // Divider
  sf(doc, D.accent); doc.rect(cx - 20, logoY + LR + 37, 40, 0.8, "F");

  // Stats summary boxes
  const boxY = logoY + LR + 50;
  const boxW = 35, boxH = 22, gap = 6;
  const total = boxW * 3 + gap * 2;
  const bx0 = cx - total / 2;
  const boxes = [
    { label: "Jugadoras", value: String(playerCount) },
    { label: "Temporada", value: season },
    { label: "Liga", value: team.league ?? "—" },
  ];
  boxes.forEach((b, i) => {
    const bx = bx0 + i * (boxW + gap);
    sf(doc, [20, 32, 55]); doc.roundedRect(bx, boxY, boxW, boxH, 2, 2, "F");
    sd(doc, [35, 50, 75]); doc.setLineWidth(0.3); doc.roundedRect(bx, boxY, boxW, boxH, 2, 2, "D");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); st(doc, D.white);
    doc.text(b.value.length > 8 ? b.value.slice(0, 7) : b.value, bx + boxW / 2, boxY + 11, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(6); st(doc, [100, 116, 139]);
    doc.text(b.label.toUpperCase(), bx + boxW / 2, boxY + 18, { align: "center" });
  });

  // Contents list
  const listY = boxY + boxH + 18;
  sf(doc, [20, 32, 55]); doc.roundedRect(cx - 50, listY, 100, 55, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, [100, 116, 139]);
  doc.text("CONTENIDO DEL INFORME", cx, listY + 7, { align: "center" });
  const items = ["Plantilla organizada por posición", "Estadísticas individuales (Min, Pts, Reb)", "Porcentajes de tiro (T2, T3, TL)", "Clasificación por importancia"];
  items.forEach((item, i) => {
    sf(doc, D.accent); doc.circle(cx - 38, listY + 16 + i * 10, 1.3, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(doc, [180, 195, 215]);
    doc.text(item, cx - 32, listY + 17 + i * 10);
  });

  // Date + footer
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  sd(doc, [30, 45, 68]); doc.setLineWidth(0.25); doc.line(ML, PH - 18, PW - 16, PH - 18);
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, D.accent);
  doc.text("ScoutPro", ML, PH - 11);
  doc.setFont("helvetica", "normal"); st(doc, [70, 85, 104]);
  doc.text(`  ·  Generado el ${today}`, ML + 13, PH - 11);
  st(doc, [45, 58, 78]); doc.text("Documento confidencial", PW - 16, PH - 11, { align: "right" });
}

// ─── Table header row ─────────────────────────────────────────────────────────

const COLS = [
  { label: "#",    w: 9,  align: "center" as const },
  { label: "Jugadora", w: 52, align: "left"   as const },
  { label: "Pos",  w: 12, align: "center" as const },
  { label: "Imp.", w: 16, align: "center" as const },
  { label: "Min",  w: 14, align: "center" as const },
  { label: "Pts",  w: 14, align: "center" as const },
  { label: "Reb",  w: 14, align: "center" as const },
  { label: "T2%",  w: 16, align: "center" as const },
  { label: "T3%",  w: 16, align: "center" as const },
  { label: "TL%",  w: 15, align: "center" as const },
];

function colX(i: number): number {
  let x = ML;
  for (let j = 0; j < i; j++) x += COLS[j].w;
  return x;
}

function drawTableHeader(doc: JsPDF, y: number): number {
  const ROW_H = 7;
  sf(doc, D.hdrBg); doc.rect(ML, y, CW, ROW_H, "F");
  sd(doc, D.border); doc.setLineWidth(0.2);
  doc.rect(ML, y, CW, ROW_H, "D");
  COLS.forEach((c, i) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, D.mid);
    const x = colX(i) + (c.align === "center" ? c.w / 2 : 2);
    doc.text(c.label.toUpperCase(), x, y + 4.5, { align: c.align });
  });
  return y + ROW_H;
}

function drawPlayerRow(
  doc: JsPDF, p: PlayerWithStats, y: number, even: boolean,
) {
  const ROW_H = 8;
  if (even) { sf(doc, D.rowAlt); doc.rect(ML, y, CW, ROW_H, "F"); }
  sd(doc, D.border); doc.setLineWidth(0.15);
  doc.line(ML, y + ROW_H, ML + CW, y + ROW_H);

  const cy = y + ROW_H / 2 + 1;

  // #
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); st(doc, D.mid);
  doc.text(p.jerseyNumber != null ? String(p.jerseyNumber) : "—", colX(0) + COLS[0].w / 2, cy, { align: "center" });

  // Name
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); st(doc, D.dark);
  const nm = p.name.length > 24 ? p.name.slice(0, 22) + "…" : p.name;
  doc.text(nm, colX(1) + 2, cy);

  // Position
  if (p.position) {
    sf(doc, D.accentL);
    const px = colX(2) + COLS[2].w / 2; const pw2 = 9;
    doc.roundedRect(px - pw2 / 2, y + 1.5, pw2, ROW_H - 3, 1, 1, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6); st(doc, D.accent);
    doc.text(p.position, px, cy, { align: "center" });
  }

  // Importance
  const imp = p.importancia;
  if (imp) {
    const ic = impColor(imp);
    const label = imp === "clave" ? "Clave" : imp === "medio" ? "Medio" : "Normal";
    sf(doc, ic); doc.circle(colX(3) + 3.5, cy - 0.5, 2, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); st(doc, ic);
    doc.text(label, colX(3) + 7, cy, { align: "left" });
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); st(doc, [200, 210, 220]);
    doc.text("—", colX(3) + COLS[3].w / 2, cy, { align: "center" });
  }

  // Stats
  const s = p.stats;
  const statVals = [
    s?.avgMinutes != null ? f0(s.avgMinutes) + "'" : "—",
    s ? f1(s.avgPoints) : "—",
    s ? f1(s.avgRebounds) : "—",
  ];
  [4, 5, 6].forEach((ci, j) => {
    const isStar = ci === 5; // Pts highlighted
    doc.setFont("helvetica", isStar ? "bold" : "normal"); doc.setFontSize(8);
    st(doc, isStar ? D.dark : D.mid);
    doc.text(statVals[j], colX(ci) + COLS[ci].w / 2, cy, { align: "center" });
  });

  // Percentages
  const pctVals = [s?.avgFieldGoalPct, s?.avgThreePointPct, s?.avgFreeThrowPct];
  [7, 8, 9].forEach((ci, j) => {
    const raw = pctVals[j];
    const label = fPct(raw);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    st(doc, label === "—" ? [200, 210, 220] as RGB : pctColor(raw));
    doc.text(label, colX(ci) + COLS[ci].w / 2, cy, { align: "center" });
  });
}

// ─── Pages 2+: Roster by position ─────────────────────────────────────────────

const POS_ORDER = ["PG", "SG", "SF", "PF", "C"];
const POS_LABELS: Record<string, string> = { PG: "Base", SG: "Escolta", SF: "Alero", PF: "Ala-Pívot", C: "Pívot" };

function drawRoster(
  doc: JsPDF, team: Team, players: PlayerWithStats[], season: string,
  pageStartNum: number, logoB64: string | undefined,
): number {
  const MAX_Y = PH - FOOT - 2;
  let pageNum = pageStartNum;
  let y = MT;
  let firstPage = true;

  const grouped: Record<string, PlayerWithStats[]> = {};
  const noPos: PlayerWithStats[] = [];
  players.forEach(p => {
    const pos = p.position?.toUpperCase() ?? "";
    const key = POS_ORDER.find(k => k === pos || (pos.includes(k)));
    if (key) {
      grouped[key] = grouped[key] ?? [];
      grouped[key].push(p);
    } else {
      noPos.push(p);
    }
  });

  const sections: Array<[string, PlayerWithStats[]]> = [
    ...POS_ORDER.filter(k => grouped[k]?.length).map(k => [POS_LABELS[k] ?? k, grouped[k]] as [string, PlayerWithStats[]]),
    ...(noPos.length ? [["Otras posiciones", noPos] as [string, PlayerWithStats[]]] : []),
  ];

  const startPage = () => {
    sf(doc, D.white); doc.rect(0, 0, PW, PH, "F");
    pageHeader(doc, team, season, logoB64);
    y = MT + 5;
    firstPage = false;
  };

  startPage();

  sections.forEach(([posLabel, posPlayers]) => {
    // Check if section header + table header + at least 1 row fits
    if (y + 9 + 7 + 8 > MAX_Y) {
      pageFooter(doc, team.name, `Pág. ${pageNum}`);
      doc.addPage(); pageNum++; startPage();
    }

    // Position section header (accent left bar + colored bg)
    y = sectionTitle(doc, `${posLabel}  (${posPlayers.length} jugadoras)`, y, D.accent);

    y = drawTableHeader(doc, y);

    posPlayers.sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99)).forEach((p, i) => {
      if (y + 8 > MAX_Y) {
        pageFooter(doc, team.name, `Pág. ${pageNum}`);
        doc.addPage(); pageNum++; startPage();
        // Repeat position header for continuation
        y = sectionTitle(doc, `${posLabel}  (continuación)`, y, D.accent);
        y = drawTableHeader(doc, y);
      }
      drawPlayerRow(doc, p, y, i % 2 === 1);
      y += 8;
    });

    y += 6; // space after position block
  });

  pageFooter(doc, team.name, `Pág. ${pageNum}`);
  return pageNum;
}

// ─── Summary page ─────────────────────────────────────────────────────────────

function drawSummary(doc: JsPDF, team: Team, players: PlayerWithStats[], season: string, pageNum: number, logoB64: string | undefined) {
  sf(doc, D.white); doc.rect(0, 0, PW, PH, "F");
  pageHeader(doc, team, season, logoB64);

  let y = MT + 5;

  y = sectionTitle(doc, "Resumen del Equipo", y);

  const clave = players.filter(p => p.importancia === "clave").length;
  const medio = players.filter(p => p.importancia === "medio").length;
  const normal = players.filter(p => p.importancia === "normal").length;
  const total = players.length;

  // Summary box
  const rows: Array<[string, string, RGB?]> = [
    ["Total jugadoras analizadas", String(total)],
    ["Jugadoras Clave", `${clave}  (${total ? Math.round(clave / total * 100) : 0}%)`, D.impRed],
    ["Jugadoras Medio", `${medio}  (${total ? Math.round(medio / total * 100) : 0}%)`, D.impAmb],
    ["Jugadoras Normal / Sin clasificar", `${normal + (total - clave - medio - normal)}`, D.impGrn],
  ];

  const tblW = 130, tblX = ML;
  rows.forEach(([label, val, col], i) => {
    if (i % 2 === 1) { sf(doc, D.rowAlt); doc.rect(tblX, y, tblW, 8, "F"); }
    sd(doc, D.border); doc.setLineWidth(0.2); doc.line(tblX, y, tblX + tblW, y);
    if (col) { sf(doc, col); doc.circle(tblX + 4, y + 4, 1.8, "F"); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); st(doc, D.mid);
    doc.text(label, tblX + 10, y + 5.5);
    doc.setFont("helvetica", "bold"); st(doc, col ?? D.dark);
    doc.text(val, tblX + tblW - 4, y + 5.5, { align: "right" });
    y += 8;
  });
  sd(doc, D.border); doc.setLineWidth(0.2); doc.line(tblX, y, tblX + tblW, y);
  sd(doc, D.border); doc.setLineWidth(0.2); doc.rect(tblX, y - rows.length * 8, tblW, rows.length * 8, "D");

  y += 10;

  // Top scorers
  const withStats = players.filter(p => p.stats && Number(p.stats.avgPoints) > 0)
    .sort((a, b) => Number(b.stats!.avgPoints) - Number(a.stats!.avgPoints))
    .slice(0, 5);

  if (withStats.length) {
    y = sectionTitle(doc, "Mejores Anotadoras (Media)", y);
    y = drawTableHeader(doc, y);
    withStats.forEach((p, i) => { drawPlayerRow(doc, p, y, i % 2 === 1); y += 8; });
    y += 6;
  }

  // Legend
  y += 4;
  y = sectionTitle(doc, "Leyenda de Importancia", y);
  const legend = [
    { imp: "clave",  color: D.impRed, label: "Clave — Jugadora diferencial. Requiere atención especial." },
    { imp: "medio",  color: D.impAmb, label: "Medio — Jugadora relevante. A vigilar durante el partido." },
    { imp: "normal", color: D.impGrn, label: "Normal — Jugadora estándar. Defensa de equipo convencional." },
  ];
  legend.forEach(({ color, label }) => {
    sf(doc, color); doc.circle(ML + 3, y + 3.5, 2.2, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); st(doc, D.dark);
    doc.text(label, ML + 8, y + 5);
    y += 9;
  });

  y += 4;
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFont("helvetica", "italic"); doc.setFontSize(7); st(doc, [156, 163, 175]);
  doc.text(`Los porcentajes en verde (≥50%) indican eficiencia alta. Rojo (<35%) indica baja eficiencia. · Generado el ${today}`, ML, y);

  pageFooter(doc, team.name, `Pág. ${pageNum}`);
}

// ─── Sistemas page ────────────────────────────────────────────────────────────

function drawSistemas(
  doc: JsPDF, team: Team, items: MediaItem[], season: string,
  pageNum: number, logoB64: string | undefined, imgMap: Record<string, string>,
) {
  sf(doc, D.white); doc.rect(0, 0, PW, PH, "F");
  pageHeader(doc, team, season, logoB64);

  let y = MT + 5;
  y = sectionTitle(doc, "Sistemas Tácticos", y, D.accent);

  const ITEM_H = (PH - FOOT - y - 4) / Math.min(items.length, 3);

  items.slice(0, 3).forEach((item, idx) => {
    const iy = y + idx * ITEM_H;
    if (item.title) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); st(doc, D.dark);
      doc.text(item.title, ML, iy + 5);
    }
    const imgY = iy + (item.title ? 8 : 2);
    const imgH = ITEM_H - (item.title ? 10 : 4);
    const imgW = Math.min(100, CW);
    if (item.url && imgMap[item.url]) {
      try { doc.addImage(imgMap[item.url], ML, imgY, imgW, imgH, undefined, "FAST"); } catch {}
    } else {
      sf(doc, D.rowAlt); doc.rect(ML, imgY, imgW, imgH, "F");
      doc.setFont("helvetica", "italic"); doc.setFontSize(7); st(doc, [200, 210, 220]);
      doc.text("Sin imagen", ML + imgW / 2, imgY + imgH / 2, { align: "center" });
    }
    if (item.description) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(doc, D.mid);
      const lines = doc.splitTextToSize(item.description, CW - imgW - 6);
      doc.text(lines.slice(0, 8), ML + imgW + 6, imgY + 6);
    }
    if (idx < items.length - 1) {
      sd(doc, D.border); doc.setLineWidth(0.2);
      doc.line(ML, iy + ITEM_H - 3, PW - MR, iy + ITEM_H - 3);
    }
  });

  pageFooter(doc, team.name, `Sistemas · Pág. ${pageNum}`);
}

// ─── Export button ─────────────────────────────────────────────────────────────

export function TeamReportExportButton({ team, season = "2025/26" }: { team: Team; season?: string }) {
  const [exporting, setExporting] = useState(false);

  const { data: players = [] } = useListPlayers({ teamId: team.id }, { query: { queryKey: ["players-pdf", team.id] } });
  const { data: allMedia = [] } = useListTeamMedia(team.id, undefined, { query: { queryKey: [...getListTeamMediaQueryKey(team.id), "pdf"] } });
  const sistemas = (allMedia as MediaItem[]).filter(m => m.category === "system");

  const [statsMap, setStatsMap] = useState<Record<number, PlayerStats | null>>({});
  const playerIds = (players as Player[]).map(p => p.id).join(",");
  useEffect(() => {
    if (!players.length) return;
    Promise.all((players as Player[]).map(async p => ({ id: p.id, stats: await fetchPlayerStats(p.id) }))).then(results => {
      const m: Record<number, PlayerStats | null> = {};
      results.forEach(({ id, stats }) => { m[id] = stats; });
      setStatsMap(m);
    });
  }, [playerIds]);

  const playersWithStats: PlayerWithStats[] = (players as Player[])
    .sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99))
    .map(p => ({ ...p, stats: statsMap[p.id] ?? null, importancia: getImportancia(p.id) }));

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const allUrls = [team.logoUrl, ...playersWithStats.map(p => p.photoUrl), ...sistemas.map(s => s.url && /\.(png|jpg|jpeg|webp|gif)$/i.test(s.url ?? "") ? s.url : null)];
      const imgMap = await fetchAllImages(allUrls);
      const logoB64 = team.logoUrl ? imgMap[team.logoUrl] : undefined;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Page 1: Cover
      drawCover(doc, team, season, playersWithStats.length, logoB64);

      // Pages 2+: Roster by position
      doc.addPage();
      let lastPage = drawRoster(doc, team, playersWithStats, season, 2, logoB64);

      // Summary page
      doc.addPage(); lastPage++;
      drawSummary(doc, team, playersWithStats, season, lastPage, logoB64);

      // Sistemas pages
      const SIS_PER = 3;
      for (let i = 0; i < sistemas.length; i += SIS_PER) {
        doc.addPage(); lastPage++;
        const sysImgMap: Record<string, string> = {};
        sistemas.slice(i, i + SIS_PER).forEach(s => { if (s.url && imgMap[s.url]) sysImgMap[s.url] = imgMap[s.url]; });
        drawSistemas(doc, team, sistemas.slice(i, i + SIS_PER), season, lastPage, logoB64, sysImgMap);
      }

      doc.save(`dossier-${team.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`);
    } catch (err) { console.error("PDF export failed", err); }
    finally { setExporting(false); }
  }, [team, season, playersWithStats, sistemas]);

  return (
    <button onClick={handleExport} disabled={exporting}
      className="flex items-center gap-1.5 text-xs font-black tracking-wide uppercase px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted transition disabled:opacity-50">
      {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
      {exporting ? "Generando…" : "Exportar PDF"}
    </button>
  );
}
