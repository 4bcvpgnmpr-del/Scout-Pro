/**
 * GameReportPDF — FastScout-style professional A4 game scouting report.
 *
 * Pages:
 *   1. Portada       — dark premium cover, both team logos, date/score
 *   2. Análisis      — Ataque / Defensa / Transición (white)
 *   3. Inteligencia  — Fortalezas, Debilidades, Objetivos, Notas (white)
 *   4. Plantilla     — rival roster table by position (white)
 *   5. Estadísticas  — rival player stats with colored % (white)
 *   6. Playbook      — key plays for the game (white)
 *
 * Design: FastScout style — white inner pages, left-bar section titles,
 * importance dots, colored percentages, alternating table rows.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useListPlayers, getListPlayersQueryKey } from "@workspace/api-client-react";
import { FileDown, Loader2 } from "lucide-react";
import { PdfSettingsPopover } from "@/components/pdf/pdf-settings-popover";
import { loadPdfPrefs, type PdfFont } from "@/hooks/use-pdf-prefs";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoutingData {
  clavesPartido: string; jugadorasDestacadas: string;
  sistemas: string; ritmo: string; generadoras: string; ataqueObs: string;
  tipoDefensa: string; presion: string; pickRoll: string; zona: string; defensaObs: string;
  contraataque: string; balance: string; transicionObs: string;
  fortalezas: string[]; debilidades: string[];
  objetivos: string; notasEntrenador: string;
}

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

interface Player {
  id: number; name: string; position?: string | null; jerseyNumber?: number | null;
  photoUrl?: string | null; age?: number | null; height?: string | null; nationality?: string | null;
}
interface PlayerWithStats extends Player { stats: PlayerStats | null; }

export interface GameReportProps {
  gameId: number;
  homeTeam: string; awayTeam: string;
  date: string; location?: string | null; difficulty?: string | null;
  homeScore?: number | null; awayScore?: number | null;
  homeLogoUrl?: string | null; awayLogoUrl?: string | null;
  rivalTeamId: number | null; rivalName: string;
  scout: ScoutingData;
  plays: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const f1 = (v: string | number | null | undefined) => { const n = Number(v); return v != null && v !== "" && !isNaN(n) ? n.toFixed(1) : "—"; };
const f0 = (v: string | number | null | undefined) => { const n = Number(v); return v != null && v !== "" && !isNaN(n) ? n.toFixed(0) : "—"; };
const fPct = (v: string | number | null | undefined) => { const n = Number(v); return v != null && v !== "" && !isNaN(n) ? `${(n * 100).toFixed(0)}%` : "—"; };
const ini = (name: string) => name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();

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

// ─── jsPDF design system ──────────────────────────────────────────────────────

type JsPDF = import("jspdf").jsPDF;
type RGB = readonly [number, number, number];

const PW = 210, PH = 297;
const ML = 16, MR = 16, MT = 22, FOOT = 15;
const CW = PW - ML - MR;

const D = {
  dark:   [15, 23, 42]    as RGB,
  mid:    [71, 85, 105]   as RGB,
  light:  [100, 116, 139] as RGB,
  accent: [249, 115, 22]  as RGB,
  accentL:[255, 247, 237] as RGB,
  white:  [255, 255, 255] as RGB,
  rowAlt: [248, 250, 252] as RGB,
  border: [226, 232, 240] as RGB,
  hdrBg:  [241, 245, 249] as RGB,
  pctGrn: [22, 163, 74]   as RGB,
  pctRed: [220, 38, 38]   as RGB,
  green:  [22, 163, 74]   as RGB,
  red:    [220, 38, 38]   as RGB,
  blue:   [59, 130, 246]  as RGB,
  blueL:  [239, 246, 255] as RGB,
  greenL: [240, 253, 244] as RGB,
  redL:   [254, 242, 242] as RGB,
  amber:  [245, 158, 11]  as RGB,
};

const sf = (doc: JsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const sd = (doc: JsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
const st = (doc: JsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

// ─── Mutable preferences (set once before each export) ────────────────────────
let _fnt: PdfFont = "helvetica";
let _acc: RGB = D.accent;

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function applyPdfPrefs(font: PdfFont, accentHex: string) {
  _fnt = font;
  _acc = hexToRgb(accentHex);
}

function pctColor(val: string | number | null | undefined): RGB {
  const n = Number(val);
  if (val == null || val === "" || isNaN(n)) return D.light;
  if (n >= 0.50) return D.pctGrn;
  if (n < 0.35) return D.pctRed;
  return D.dark;
}

/** Section title: 3pt orange left bar + tinted background */
function sectionTitle(doc: JsPDF, label: string, y: number, accent: RGB = _acc): number {
  sf(doc, accent); doc.rect(ML, y, 3, 6, "F");
  // very light tinted bg
  const bg: RGB = [
    Math.min(255, Math.round(accent[0] * 0.05 + 248)),
    Math.min(255, Math.round(accent[1] * 0.05 + 248)),
    Math.min(255, Math.round(accent[2] * 0.02 + 248)),
  ];
  sf(doc, bg); doc.rect(ML + 3, y, CW - 3, 6, "F");
  doc.setFont(_fnt, "bold"); doc.setFontSize(8.5); st(doc, D.dark);
  doc.text(label.toUpperCase(), ML + 8, y + 4.2);
  return y + 9;
}

/** Standard page footer */
function pageFooter(doc: JsPDF, ctx: string, right: string) {
  sd(doc, D.border); doc.setLineWidth(0.25);
  doc.line(ML, PH - FOOT + 3, PW - MR, PH - FOOT + 3);
  doc.setFont(_fnt, "bold"); doc.setFontSize(6.5); st(doc, _acc);
  doc.text("ScoutPro", ML, PH - FOOT + 8);
  doc.setFont(_fnt, "normal"); st(doc, D.mid);
  doc.text(` · ${ctx}`, ML + 14, PH - FOOT + 8);
  st(doc, D.mid); doc.text(right, PW - MR, PH - FOOT + 8, { align: "right" });
}

/** Compact page header with both team logos */
function pageHeader(doc: JsPDF, props: GameReportProps, imgMap: Record<string, string>, label: string) {
  sf(doc, D.dark); doc.rect(0, 0, PW, MT, "F");
  sf(doc, _acc); doc.rect(0, 0, PW, 1.8, "F");

  const homeB64 = props.homeLogoUrl ? imgMap[props.homeLogoUrl] : undefined;
  const awayB64 = props.awayLogoUrl ? imgMap[props.awayLogoUrl] : undefined;
  const LR = 7;

  // Home logo
  if (homeB64) { try { doc.addImage(homeB64, ML, 3, LR * 2, LR * 2, undefined, "FAST"); } catch {} }
  else { sf(doc, [30, 45, 68]); doc.circle(ML + LR, 3 + LR, LR, "F"); doc.setFont(_fnt, "bold"); doc.setFontSize(5.5); st(doc, _acc); doc.text(ini(props.homeTeam), ML + LR, 3 + LR + 1.5, { align: "center" }); }

  doc.setFont(_fnt, "bold"); doc.setFontSize(8); st(doc, D.white);
  doc.text(props.homeTeam.length > 18 ? props.homeTeam.slice(0, 16) + "…" : props.homeTeam, ML + LR * 2 + 3, 9);
  doc.setFont(_fnt, "normal"); doc.setFontSize(5.5); st(doc, [100, 116, 139]);
  doc.text("LOCAL", ML + LR * 2 + 3, 14);

  // Away logo (right side)
  const awayX = PW - MR - LR * 2;
  if (awayB64) { try { doc.addImage(awayB64, awayX, 3, LR * 2, LR * 2, undefined, "FAST"); } catch {} }
  else { sf(doc, [30, 45, 68]); doc.circle(awayX + LR, 3 + LR, LR, "F"); doc.setFont(_fnt, "bold"); doc.setFontSize(5.5); st(doc, _acc); doc.text(ini(props.awayTeam), awayX + LR, 3 + LR + 1.5, { align: "center" }); }

  doc.setFont(_fnt, "bold"); doc.setFontSize(8); st(doc, D.white);
  doc.text(props.awayTeam.length > 18 ? props.awayTeam.slice(0, 16) + "…" : props.awayTeam, awayX - 3, 9, { align: "right" });
  doc.setFont(_fnt, "normal"); doc.setFontSize(5.5); st(doc, [100, 116, 139]);
  doc.text("VISITANTE", awayX - 3, 14, { align: "right" });

  // Center: date + section label
  const cx = PW / 2;
  const fmtDate = new Date(props.date + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  doc.setFont(_fnt, "normal"); doc.setFontSize(6.5); st(doc, [148, 163, 184]);
  doc.text(fmtDate, cx, 9, { align: "center" });
  if (props.location) doc.text(props.location, cx, 14, { align: "center" });
  doc.setFont(_fnt, "bold"); doc.setFontSize(5.5); st(doc, _acc);
  doc.text(label.toUpperCase(), cx, 19, { align: "center" });
}

/** Draw avatar (circular). Graceful fallback to initials. */
function drawAvatar(doc: JsPDF, b64: string | undefined, name: string, cx: number, cy: number, r: number) {
  sf(doc, D.rowAlt); doc.circle(cx, cy, r, "F");
  if (b64) { try { doc.addImage(b64, cx - r, cy - r, r * 2, r * 2, undefined, "FAST"); } catch {} }
  else { doc.setFont(_fnt, "bold"); doc.setFontSize(r * 4); st(doc, _acc); doc.text(ini(name), cx, cy + r * 0.8, { align: "center" }); }
  sd(doc, D.border); doc.setLineWidth(0.2); doc.circle(cx, cy, r, "D");
}

// ── Page 1: Portada ───────────────────────────────────────────────────────────

function drawPortada(doc: JsPDF, props: GameReportProps, imgMap: Record<string, string>) {
  sf(doc, D.dark); doc.rect(0, 0, PW, PH, "F");
  // Right accent strip
  sf(doc, _acc); doc.rect(PW - 7, 0, 7, PH, "F");
  // Top thin line
  sf(doc, [24, 37, 63]); doc.rect(0, 0, PW - 7, 2.5, "F");

  const cx = (PW - 7) / 2;
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const fmtDate = new Date(props.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ScoutPro brand
  doc.setFont(_fnt, "bold"); doc.setFontSize(7.5); st(doc, [100, 116, 139]);
  doc.text("SCOUTPRO", cx, 17, { align: "center" });

  // Tag
  sf(doc, [22, 35, 58]); doc.roundedRect(cx - 42, 22, 84, 7, 2, 2, "F");
  doc.setFont(_fnt, "bold"); doc.setFontSize(6); st(doc, _acc);
  doc.text("INFORME DE SCOUTING · CENTRO DE PARTIDO", cx, 26.5, { align: "center" });

  // Logos
  const LR = 22, logoY = 78;
  const homeB64 = props.homeLogoUrl ? imgMap[props.homeLogoUrl] : undefined;
  const awayB64 = props.awayLogoUrl ? imgMap[props.awayLogoUrl] : undefined;

  sf(doc, [18, 30, 52]); doc.circle(cx - 30, logoY, LR + 3, "F");
  sd(doc, D.accent); doc.setLineWidth(0.6); doc.circle(cx - 30, logoY, LR + 3, "D");
  drawAvatar(doc, homeB64, props.homeTeam, cx - 30, logoY, LR);

  sf(doc, [18, 30, 52]); doc.circle(cx + 30, logoY, LR + 3, "F");
  sd(doc, [55, 70, 90]); doc.setLineWidth(0.6); doc.circle(cx + 30, logoY, LR + 3, "D");
  drawAvatar(doc, awayB64, props.awayTeam, cx + 30, logoY, LR);

  // VS or score
  const hasScore = props.homeScore != null && props.awayScore != null;
  if (hasScore) {
    doc.setFont(_fnt, "bold"); doc.setFontSize(18); st(doc, D.white);
    doc.text(`${props.homeScore}`, cx - 8, logoY + 4, { align: "right" });
    doc.setFontSize(10); st(doc, [55, 70, 90]);
    doc.text("–", cx, logoY + 4, { align: "center" });
    doc.setFontSize(18); st(doc, D.white);
    doc.text(`${props.awayScore}`, cx + 8, logoY + 4, { align: "left" });
  } else {
    doc.setFont(_fnt, "bold"); doc.setFontSize(11); st(doc, [55, 70, 90]);
    doc.text("VS", cx, logoY + 3, { align: "center" });
  }

  // Team names
  doc.setFont(_fnt, "bold"); doc.setFontSize(9.5); st(doc, D.white);
  const hn = props.homeTeam.length > 16 ? props.homeTeam.slice(0, 14) + "…" : props.homeTeam;
  const an = props.awayTeam.length > 16 ? props.awayTeam.slice(0, 14) + "…" : props.awayTeam;
  doc.text(hn.toUpperCase(), cx - 30, logoY + LR + 9, { align: "center" });
  doc.text(an.toUpperCase(), cx + 30, logoY + LR + 9, { align: "center" });
  doc.setFont(_fnt, "normal"); doc.setFontSize(6); st(doc, [100, 116, 139]);
  doc.text("LOCAL", cx - 30, logoY + LR + 14, { align: "center" });
  doc.text("VISITANTE", cx + 30, logoY + LR + 14, { align: "center" });

  // Divider
  sf(doc, _acc); doc.rect(cx - 18, logoY + LR + 20, 36, 0.7, "F");

  // Date + location
  doc.setFont(_fnt, "normal"); doc.setFontSize(8); st(doc, [148, 163, 184]);
  doc.text(fmtDate.charAt(0).toUpperCase() + fmtDate.slice(1), cx, logoY + LR + 30, { align: "center" });
  if (props.location) { doc.setFontSize(7); st(doc, [100, 116, 139]); doc.text(props.location, cx, logoY + LR + 37, { align: "center" }); }

  // Difficulty
  if (props.difficulty) {
    const stars = props.difficulty === "facil" ? 2 : props.difficulty === "medio" ? 3 : 5;
    const label = props.difficulty === "facil" ? "FÁCIL" : props.difficulty === "medio" ? "MEDIO" : "IMPORTANTE";
    const sy = logoY + LR + 48;
    doc.setFont(_fnt, "bold"); doc.setFontSize(6); st(doc, [70, 85, 105]);
    doc.text(`DIFICULTAD: ${label}`, cx, sy, { align: "center" });
    for (let i = 0; i < 5; i++) {
      st(doc, i < stars ? D.amber : [30, 43, 65]);
      doc.text("★", cx - 12 + i * 6, sy + 7, { align: "center" });
    }
  }

  // Contents
  const listY = logoY + LR + 70;
  sf(doc, [18, 30, 52]); doc.roundedRect(cx - 52, listY, 104, 58, 3, 3, "F");
  doc.setFont(_fnt, "bold"); doc.setFontSize(6); st(doc, [70, 85, 105]);
  doc.text("CONTENIDO DEL INFORME", cx, listY + 7, { align: "center" });
  const items = ["Análisis Táctico (Ataque / Defensa / Transición)", "Inteligencia: Fortalezas y Debilidades", "Plantilla y perfil de jugadoras rivales", "Estadísticas individuales con eficiencia", "Playbook del partido"];
  items.forEach((item, i) => {
    sf(doc, _acc); doc.circle(cx - 40, listY + 16 + i * 9, 1.2, "F");
    doc.setFont(_fnt, "normal"); doc.setFontSize(7); st(doc, [175, 188, 208]);
    doc.text(item, cx - 35, listY + 17 + i * 9);
  });

  // Footer
  sd(doc, [28, 42, 65]); doc.setLineWidth(0.25); doc.line(ML, PH - 16, PW - 9, PH - 16);
  doc.setFont(_fnt, "bold"); doc.setFontSize(6.5); st(doc, _acc);
  doc.text("ScoutPro", ML, PH - 9);
  doc.setFont(_fnt, "normal"); st(doc, [65, 80, 100]);
  doc.text(`  ·  Generado el ${today}`, ML + 13, PH - 9);
  st(doc, [40, 54, 72]); doc.text("Documento confidencial", PW - 9, PH - 9, { align: "right" });
}

// ── Page 2: Análisis Táctico ──────────────────────────────────────────────────

function fieldPair(doc: JsPDF, label: string, value: string, x: number, y: number, w: number): number {
  if (!value.trim()) return y;
  doc.setFont(_fnt, "bold"); doc.setFontSize(6); st(doc, D.light);
  doc.text(label.toUpperCase(), x, y); y += 3.5;
  doc.setFont(_fnt, "normal"); doc.setFontSize(8); st(doc, D.dark);
  const lines = doc.splitTextToSize(value, w);
  doc.text(lines.slice(0, 4), x, y);
  return y + lines.slice(0, 4).length * 4 + 2;
}

function drawAnalisis(doc: JsPDF, props: GameReportProps, imgMap: Record<string, string>) {
  sf(doc, D.white); doc.rect(0, 0, PW, PH, "F");
  pageHeader(doc, props, imgMap, "Análisis Táctico");

  const MAX_Y = PH - FOOT;
  const HW = (CW - 6) / 2;
  let y = MT + 4;

  // ── ATAQUE
  y = sectionTitle(doc, "Ataque", y, D.accent);
  const ataqueLeft  = [["Sistemas Principales", props.scout.sistemas], ["Observaciones", props.scout.ataqueObs]].filter(([, v]) => v.trim()) as [string, string][];
  const ataqueRight = [["Ritmo de Juego", props.scout.ritmo], ["Jugadoras Generadoras", props.scout.generadoras]].filter(([, v]) => v.trim()) as [string, string][];
  let yL = y, yR = y;
  ataqueLeft.forEach(([l, v]) => { yL = fieldPair(doc, l, v, ML, yL, HW); });
  ataqueRight.forEach(([l, v]) => { yR = fieldPair(doc, l, v, ML + HW + 6, yR, HW); });
  y = Math.max(yL, yR) + 5;

  // Divider
  if (y < MAX_Y - 40) { sd(doc, D.border); doc.setLineWidth(0.2); doc.line(ML, y, PW - MR, y); y += 5; }

  // ── DEFENSA
  y = sectionTitle(doc, "Defensa", y, D.blue);
  const defLeft  = [["Tipo de Defensa", props.scout.tipoDefensa], ["Presión", props.scout.presion]].filter(([, v]) => v.trim()) as [string, string][];
  const defRight = [["Pick & Roll Defensivo", props.scout.pickRoll], ["Zona", props.scout.zona]].filter(([, v]) => v.trim()) as [string, string][];
  yL = y; yR = y;
  defLeft.forEach(([l, v]) => { yL = fieldPair(doc, l, v, ML, yL, HW); });
  defRight.forEach(([l, v]) => { yR = fieldPair(doc, l, v, ML + HW + 6, yR, HW); });
  y = Math.max(yL, yR);
  if (props.scout.defensaObs.trim()) y = fieldPair(doc, "Observaciones defensivas", props.scout.defensaObs, ML, y + 2, CW);
  y += 5;

  // Divider
  if (y < MAX_Y - 30) { sd(doc, D.border); doc.setLineWidth(0.2); doc.line(ML, y, PW - MR, y); y += 5; }

  // ── TRANSICIÓN
  y = sectionTitle(doc, "Transición", y, [109, 40, 217] as RGB);
  const transLeft  = [["Contraataque", props.scout.contraataque]].filter(([, v]) => v.trim()) as [string, string][];
  const transRight = [["Balance Defensivo", props.scout.balance]].filter(([, v]) => v.trim()) as [string, string][];
  yL = y; yR = y;
  transLeft.forEach(([l, v]) => { yL = fieldPair(doc, l, v, ML, yL, HW); });
  transRight.forEach(([l, v]) => { yR = fieldPair(doc, l, v, ML + HW + 6, yR, HW); });
  y = Math.max(yL, yR);
  if (props.scout.transicionObs.trim()) fieldPair(doc, "Observaciones", props.scout.transicionObs, ML, y + 2, CW);

  pageFooter(doc, `${props.homeTeam} vs ${props.awayTeam}`, "Análisis Táctico · Pág. 2/6");
}

// ── Page 3: Inteligencia + Objetivos ─────────────────────────────────────────

function bulletList(doc: JsPDF, items: string[], x: number, y: number, w: number, color: RGB): number {
  items.slice(0, 8).forEach(item => {
    sf(doc, color); doc.circle(x + 2.5, y - 1, 1.4, "F");
    doc.setFont(_fnt, "normal"); doc.setFontSize(8); st(doc, D.dark);
    const lines = doc.splitTextToSize(item, w - 8);
    doc.text(lines.slice(0, 3), x + 7, y);
    y += lines.slice(0, 3).length * 4 + 1.5;
  });
  return y;
}

function drawInteligencia(doc: JsPDF, props: GameReportProps, imgMap: Record<string, string>) {
  sf(doc, D.white); doc.rect(0, 0, PW, PH, "F");
  pageHeader(doc, props, imgMap, "Inteligencia");

  const MAX_Y = PH - FOOT;
  let y = MT + 4;

  // Claves del partido
  if (props.scout.clavesPartido.trim()) {
    sf(doc, D.accentL); doc.roundedRect(ML, y, CW, 5, 1, 1, "F");
    sd(doc, [254, 215, 170]); doc.setLineWidth(0.2); doc.roundedRect(ML, y, CW, 5, 1, 1, "D");
    doc.setFont(_fnt, "bold"); doc.setFontSize(6.5); st(doc, _acc);
    doc.text("CLAVES DEL PARTIDO", ML + 3, y + 3.3);
    y += 8;
    doc.setFont(_fnt, "normal"); doc.setFontSize(8); st(doc, D.dark);
    const lines = doc.splitTextToSize(props.scout.clavesPartido, CW);
    doc.text(lines.slice(0, 3), ML, y);
    y += lines.slice(0, 3).length * 4 + 5;
  }

  // Jugadoras destacadas
  if (props.scout.jugadorasDestacadas.trim()) {
    doc.setFont(_fnt, "bold"); doc.setFontSize(6.5); st(doc, D.amber);
    doc.text("⚑ JUGADORAS A VIGILAR", ML, y); y += 4;
    doc.setFont(_fnt, "normal"); doc.setFontSize(8); st(doc, D.mid);
    const lines = doc.splitTextToSize(props.scout.jugadorasDestacadas, CW);
    doc.text(lines.slice(0, 2), ML, y);
    y += lines.slice(0, 2).length * 4 + 6;
  }

  // Divider
  sd(doc, D.border); doc.setLineWidth(0.2); doc.line(ML, y, PW - MR, y); y += 6;

  // Fortalezas | Debilidades
  const HW = (CW - 6) / 2;
  y = sectionTitle(doc, "Análisis Competitivo", y, D.accent);

  // Left: Fortalezas (red bg)
  sf(doc, D.redL); doc.roundedRect(ML, y, HW, 5, 1, 1, "F");
  doc.setFont(_fnt, "bold"); doc.setFontSize(6.5); st(doc, D.red);
  doc.text("⚠ FORTALEZAS RIVALES", ML + 3, y + 3.3); y += 7;
  const yFort = y;

  // Right: Debilidades (green bg)
  sf(doc, D.greenL); doc.roundedRect(ML + HW + 6, y - 7, HW, 5, 1, 1, "F");
  doc.setFont(_fnt, "bold"); doc.setFontSize(6.5); st(doc, D.green);
  doc.text("✓ DEBILIDADES RIVALES", ML + HW + 6 + 3, y - 3.7);

  let yL = yFort;
  let yR = yFort;
  if (props.scout.fortalezas.length) {
    yL = bulletList(doc, props.scout.fortalezas, ML, yFort, HW, D.red);
  } else {
    doc.setFont(_fnt, "italic"); doc.setFontSize(7.5); st(doc, [200, 210, 220]); doc.text("Sin datos", ML, yFort); yL = yFort + 6;
  }
  if (props.scout.debilidades.length) {
    yR = bulletList(doc, props.scout.debilidades, ML + HW + 6, yFort, HW, D.green);
  } else {
    doc.setFont(_fnt, "italic"); doc.setFontSize(7.5); st(doc, [200, 210, 220]); doc.text("Sin datos", ML + HW + 6, yFort); yR = yFort + 6;
  }
  y = Math.max(yL, yR) + 6;

  // Objetivos
  if (y < MAX_Y - 30 && props.scout.objetivos.trim()) {
    sd(doc, D.border); doc.setLineWidth(0.2); doc.line(ML, y, PW - MR, y); y += 6;
    y = sectionTitle(doc, "Objetivos del Partido", y, D.blue);
    doc.setFont(_fnt, "normal"); doc.setFontSize(8); st(doc, D.dark);
    const lines = doc.splitTextToSize(props.scout.objetivos, CW);
    doc.text(lines.slice(0, 5), ML, y);
    y += lines.slice(0, 5).length * 4 + 4;
  }

  // Notas del entrenador
  if (y < MAX_Y - 25 && props.scout.notasEntrenador.trim()) {
    sd(doc, D.border); doc.setLineWidth(0.2); doc.line(ML, y, PW - MR, y); y += 6;
    y = sectionTitle(doc, "Notas del Entrenador", y, D.accent);
    doc.setFont(_fnt, "normal"); doc.setFontSize(8); st(doc, D.mid);
    const lines = doc.splitTextToSize(props.scout.notasEntrenador, CW);
    doc.text(lines.slice(0, 5), ML, y);
  }

  pageFooter(doc, `${props.homeTeam} vs ${props.awayTeam}`, "Inteligencia · Pág. 3/6");
}

// ── Page 4: Plantilla Rival ───────────────────────────────────────────────────

const POS_ORDER = ["PG", "SG", "SF", "PF", "C"];
const POS_LABELS: Record<string, string> = { PG: "Base", SG: "Escolta", SF: "Alero", PF: "Ala-Pívot", C: "Pívot" };

function drawPlantilla(doc: JsPDF, props: GameReportProps, players: Player[], imgMap: Record<string, string>) {
  sf(doc, D.white); doc.rect(0, 0, PW, PH, "F");
  pageHeader(doc, props, imgMap, "Plantilla Rival");

  const MAX_Y = PH - FOOT;
  let y = MT + 4;

  // subtitle
  doc.setFont(_fnt, "bold"); doc.setFontSize(8); st(doc, D.mid);
  doc.text(`${props.rivalName} · ${players.length} jugadoras`, PW - MR, y + 3, { align: "right" });
  y += 7;

  // Group by position
  const grouped: Record<string, Player[]> = {};
  const noPos: Player[] = [];
  players.forEach(p => {
    const pos = p.position?.toUpperCase() ?? "";
    const key = POS_ORDER.find(k => k === pos || pos.includes(k));
    if (key) { grouped[key] = grouped[key] ?? []; grouped[key].push(p); }
    else noPos.push(p);
  });
  const sections: Array<[string, Player[]]> = [
    ...POS_ORDER.filter(k => grouped[k]?.length).map(k => [POS_LABELS[k] ?? k, grouped[k]] as [string, Player[]]),
    ...(noPos.length ? [["Otras posiciones", noPos] as [string, Player[]]] : []),
  ];

  // Table columns: #, Jugadora, Pos, Edad, Altura, Nac.
  const RCOLS = [
    { label: "#",     w: 10, align: "center" as const },
    { label: "Jugadora", w: 60, align: "left" as const },
    { label: "Pos",  w: 14, align: "center" as const },
    { label: "Edad", w: 14, align: "center" as const },
    { label: "Altura",w: 16, align: "center" as const },
    { label: "Nac.", w: 20, align: "center" as const },
    { label: "cm",   w: 44, align: "center" as const }, // filler
  ];
  const rColX = (i: number) => { let x = ML; for (let j = 0; j < i; j++) x += RCOLS[j].w; return x; };

  const drawRHdr = (yy: number) => {
    sf(doc, D.hdrBg); doc.rect(ML, yy, CW, 7, "F");
    sd(doc, D.border); doc.setLineWidth(0.2); doc.rect(ML, yy, CW, 7, "D");
    RCOLS.slice(0, 6).forEach((c, i) => {
      doc.setFont(_fnt, "bold"); doc.setFontSize(6.5); st(doc, D.mid);
      doc.text(c.label.toUpperCase(), rColX(i) + (c.align === "center" ? c.w / 2 : 2), yy + 4.5, { align: c.align });
    });
    return yy + 7;
  };

  sections.forEach(([posLabel, posPlayers]) => {
    if (y + 9 + 7 + 8 > MAX_Y) return; // skip if no space
    y = sectionTitle(doc, posLabel, y, D.accent);
    y = drawRHdr(y);
    posPlayers.sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99)).forEach((p, i) => {
      if (y + 8 > MAX_Y) return;
      if (i % 2 === 1) { sf(doc, D.rowAlt); doc.rect(ML, y, CW, 8, "F"); }
      sd(doc, D.border); doc.setLineWidth(0.15); doc.line(ML, y + 8, ML + CW, y + 8);
      const cy = y + 5;
      doc.setFont(_fnt, "bold"); doc.setFontSize(7.5); st(doc, D.mid);
      doc.text(p.jerseyNumber != null ? String(p.jerseyNumber) : "—", rColX(0) + RCOLS[0].w / 2, cy, { align: "center" });
      doc.setFont(_fnt, "bold"); doc.setFontSize(8); st(doc, D.dark);
      doc.text(p.name.length > 28 ? p.name.slice(0, 26) + "…" : p.name, rColX(1) + 2, cy);
      if (p.position) {
        sf(doc, D.accentL); doc.roundedRect(rColX(2) + 1, y + 1.5, 12, 5, 1, 1, "F");
        doc.setFont(_fnt, "bold"); doc.setFontSize(5.5); st(doc, _acc);
        doc.text(p.position, rColX(2) + 7, cy, { align: "center" });
      }
      doc.setFont(_fnt, "normal"); doc.setFontSize(7.5); st(doc, D.mid);
      doc.text(p.age != null ? String(p.age) : "—", rColX(3) + RCOLS[3].w / 2, cy, { align: "center" });
      doc.text(p.height ?? "—", rColX(4) + RCOLS[4].w / 2, cy, { align: "center" });
      doc.text(p.nationality?.slice(0, 3) ?? "—", rColX(5) + RCOLS[5].w / 2, cy, { align: "center" });
      y += 8;
    });
    y += 5;
  });

  pageFooter(doc, `${props.homeTeam} vs ${props.awayTeam}`, "Plantilla · Pág. 4/6");
}

// ── Page 5: Estadísticas ──────────────────────────────────────────────────────

function drawEstadisticas(doc: JsPDF, props: GameReportProps, players: PlayerWithStats[], imgMap: Record<string, string>) {
  sf(doc, D.white); doc.rect(0, 0, PW, PH, "F");
  pageHeader(doc, props, imgMap, "Estadísticas");

  const MAX_Y = PH - FOOT;
  let y = MT + 4;

  // subtitle
  doc.setFont(_fnt, "bold"); doc.setFontSize(8); st(doc, D.mid);
  doc.text(`${props.rivalName} · Media por partido`, PW - MR, y + 3, { align: "right" });
  y += 7;

  // Column layout
  const SCOLS = [
    { label: "#",   w: 9,  align: "center" as const },
    { label: "Jugadora", w: 50, align: "left" as const },
    { label: "Min", w: 14, align: "center" as const },
    { label: "Pts", w: 14, align: "center" as const },
    { label: "Reb", w: 14, align: "center" as const },
    { label: "Ast", w: 12, align: "center" as const },
    { label: "Rob", w: 12, align: "center" as const },
    { label: "Tap", w: 12, align: "center" as const },
    { label: "T2%", w: 16, align: "center" as const },
    { label: "T3%", w: 15, align: "center" as const },
    { label: "TL%", w: 10, align: "center" as const },
  ];
  const sColX = (i: number) => { let x = ML; for (let j = 0; j < i; j++) x += SCOLS[j].w; return x; };

  // Header row
  sf(doc, D.hdrBg); doc.rect(ML, y, CW, 7, "F");
  sd(doc, D.border); doc.setLineWidth(0.2); doc.rect(ML, y, CW, 7, "D");
  SCOLS.forEach((c, i) => {
    doc.setFont(_fnt, "bold"); doc.setFontSize(5.5); st(doc, i === 3 ? D.accent : D.mid);
    doc.text(c.label.toUpperCase(), sColX(i) + (c.align === "center" ? c.w / 2 : 2), y + 4.5, { align: c.align });
  });
  y += 7;

  const sorted = [...players].sort((a, b) => Number(b.stats?.avgPoints ?? 0) - Number(a.stats?.avgPoints ?? 0));
  sorted.slice(0, 24).forEach((p, i) => {
    if (y + 8 > MAX_Y) return;
    if (i % 2 === 1) { sf(doc, D.rowAlt); doc.rect(ML, y, CW, 8, "F"); }
    sd(doc, D.border); doc.setLineWidth(0.15); doc.line(ML, y + 8, ML + CW, y + 8);
    const cy = y + 5.5;
    const s = p.stats;

    doc.setFont(_fnt, "bold"); doc.setFontSize(7); st(doc, D.mid);
    doc.text(p.jerseyNumber != null ? String(p.jerseyNumber) : "—", sColX(0) + SCOLS[0].w / 2, cy, { align: "center" });
    doc.setFont(_fnt, "bold"); doc.setFontSize(7.5); st(doc, D.dark);
    doc.text(p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name, sColX(1) + 2, cy);

    const vals = [
      s?.avgMinutes != null ? f0(s.avgMinutes) + "'" : "—",
      s ? f1(s.avgPoints)   : "—",
      s ? f1(s.avgRebounds) : "—",
      s ? f1(s.avgAssists)  : "—",
      s ? f1(s.avgSteals)   : "—",
      s ? f1(s.avgBlocks)   : "—",
    ];
    const pctVals = [s?.avgFieldGoalPct, s?.avgThreePointPct, s?.avgFreeThrowPct];

    vals.forEach((v, j) => {
      const ci = j + 2;
      const isPts = ci === 3;
      doc.setFont("helvetica", isPts ? "bold" : "normal"); doc.setFontSize(7.5);
      st(doc, v === "—" ? [200, 210, 220] as RGB : isPts ? D.dark : D.mid);
      doc.text(v, sColX(ci) + SCOLS[ci].w / 2, cy, { align: "center" });
    });
    pctVals.forEach((raw, j) => {
      const ci = j + 8;
      const label = fPct(raw);
      doc.setFont(_fnt, "bold"); doc.setFontSize(7);
      st(doc, label === "—" ? [200, 210, 220] as RGB : pctColor(raw));
      doc.text(label, sColX(ci) + SCOLS[ci].w / 2, cy, { align: "center" });
    });

    y += 8;
  });

  // Legend
  if (y + 12 < MAX_Y) {
    y += 5;
    doc.setFont(_fnt, "italic"); doc.setFontSize(6.5); st(doc, [175, 185, 200]);
    doc.text("Verde ≥ 50%  ·  Rojo < 35%  ·  Ordenado por media de puntos", ML, y);
  }

  pageFooter(doc, `${props.homeTeam} vs ${props.awayTeam}`, "Estadísticas · Pág. 5/6");
}

// ── Page 6: Playbook ──────────────────────────────────────────────────────────

function drawPlaybook(doc: JsPDF, props: GameReportProps, plays: string[], imgMap: Record<string, string>) {
  sf(doc, D.white); doc.rect(0, 0, PW, PH, "F");
  pageHeader(doc, props, imgMap, "Playbook");

  const MAX_Y = PH - FOOT;
  let y = MT + 4;

  doc.setFont(_fnt, "bold"); doc.setFontSize(8); st(doc, D.mid);
  doc.text(`${plays.length} jugada${plays.length !== 1 ? "s" : ""} preparadas`, PW - MR, y + 3, { align: "right" });
  y += 7;

  if (!plays.length) {
    sf(doc, D.rowAlt); doc.roundedRect(ML, y, CW, 18, 3, 3, "F");
    doc.setFont(_fnt, "italic"); doc.setFontSize(8.5); st(doc, [180, 190, 205]);
    doc.text("Sin jugadas anotadas para este partido", PW / 2, y + 11, { align: "center" });
  } else {
    plays.forEach((play, i) => {
      const ROW_H = 10;
      if (y + ROW_H > MAX_Y) return;
      if (i % 2 === 1) { sf(doc, D.rowAlt); doc.rect(ML, y, CW, ROW_H, "F"); }
      sd(doc, D.border); doc.setLineWidth(0.2); doc.line(ML, y + ROW_H, ML + CW, y + ROW_H);

      // Number badge
      const bc = i % 2 === 0 ? D.accent : D.mid;
      sf(doc, bc); doc.circle(ML + 6, y + ROW_H / 2, 4, "F");
      doc.setFont(_fnt, "bold"); doc.setFontSize(7); st(doc, D.white);
      doc.text(String(i + 1), ML + 6, y + ROW_H / 2 + 1.5, { align: "center" });

      // Play text
      doc.setFont(_fnt, "bold"); doc.setFontSize(9); st(doc, D.dark);
      const lines = doc.splitTextToSize(play, CW - 18);
      doc.text(lines[0] ?? "", ML + 14, y + ROW_H / 2 + 1.5);
      if (lines.length > 1) {
        doc.setFont(_fnt, "normal"); doc.setFontSize(7.5); st(doc, D.mid);
        doc.text(lines[1], ML + 14, y + ROW_H / 2 + 5.5);
      }
      y += ROW_H;
    });
  }

  pageFooter(doc, `${props.homeTeam} vs ${props.awayTeam}`, "Playbook · Pág. 6/6");
}

// ─── Export button component ───────────────────────────────────────────────────

export function GameReportExportButton({ gameProps }: { gameProps: GameReportProps }) {
  const [exporting, setExporting] = useState(false);

  const { data: rawPlayers = [] } = useListPlayers(
    { teamId: gameProps.rivalTeamId ?? 0 },
    { query: { enabled: !!gameProps.rivalTeamId, queryKey: [...getListPlayersQueryKey({ teamId: gameProps.rivalTeamId ?? 0 }), "game-pdf"] } },
  );

  const [statsMap, setStatsMap] = useState<Record<number, PlayerStats | null>>({});
  const playerIds = (rawPlayers as Player[]).map(p => p.id).join(",");
  useEffect(() => {
    if (!rawPlayers.length) return;
    Promise.all((rawPlayers as Player[]).map(async p => ({ id: p.id, stats: await fetchPlayerStats(p.id) })))
      .then(results => {
        const m: Record<number, PlayerStats | null> = {};
        results.forEach(({ id, stats }) => { m[id] = stats; });
        setStatsMap(m);
      });
  }, [playerIds]);

  const players: Player[] = (rawPlayers as Player[]).sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99));
  const playersWithStats: PlayerWithStats[] = players.map(p => ({ ...p, stats: statsMap[p.id] ?? null }));

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Apply current preferences before drawing
      const prefs = loadPdfPrefs();
      applyPdfPrefs(prefs.font, prefs.accent);

      const { default: jsPDF } = await import("jspdf");
      const imgMap = await fetchAllImages([gameProps.homeLogoUrl, gameProps.awayLogoUrl, ...players.map(p => p.photoUrl)]);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      drawPortada(doc, gameProps, imgMap);
      doc.addPage(); drawAnalisis(doc, gameProps, imgMap);
      doc.addPage(); drawInteligencia(doc, gameProps, imgMap);
      doc.addPage(); drawPlantilla(doc, gameProps, players, imgMap);
      doc.addPage(); drawEstadisticas(doc, gameProps, playersWithStats, imgMap);
      doc.addPage(); drawPlaybook(doc, gameProps, gameProps.plays, imgMap);

      const safe = `${gameProps.homeTeam}-vs-${gameProps.awayTeam}-${gameProps.date}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      doc.save(`informe-${safe}.pdf`);
    } catch (err) { console.error("Game PDF export failed", err); }
    finally { setExporting(false); }
  }, [gameProps, players, playersWithStats]);

  return (
    <div className="flex items-center gap-1">
      <button onClick={handleExport} disabled={exporting}
        className="h-7 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 transition flex items-center gap-1.5 text-primary text-[11px] font-black uppercase tracking-wide disabled:opacity-50">
        {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
        {exporting ? "Generando…" : "PDF"}
      </button>
      <PdfSettingsPopover />
    </div>
  );
}
