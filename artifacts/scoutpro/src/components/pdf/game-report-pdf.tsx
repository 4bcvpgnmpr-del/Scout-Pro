/**
 * GameReportPDF — professional multi-page A4 scouting report for a game.
 *
 * Pages:
 *   1. Portada       — dark cover, both team logos, date, location, difficulty
 *   2. Análisis      — tactical breakdown: Ataque / Defensa / Transición
 *   3. Inteligencia  — Fortalezas, Debilidades, Objetivos, Notas entrenador
 *   4. Plantilla     — rival roster with photos (grid layout)
 *   5. Estadísticas  — rival player stats table
 *   6. Playbook      — key plays for the game
 *
 * All images fetched server-side via /api/image-proxy to bypass CORS.
 * Drawn directly with jsPDF API — no html2canvas, no DOM capture.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useListPlayers, getListPlayersQueryKey } from "@workspace/api-client-react";
import { FileDown, Loader2 } from "lucide-react";

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
  id: number;
  name: string;
  position?: string | null;
  jerseyNumber?: number | null;
  photoUrl?: string | null;
  age?: number | null;
  height?: string | null;
  nationality?: string | null;
}

interface PlayerWithStats extends Player { stats: PlayerStats | null }

export interface GameReportProps {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  date: string;
  location?: string | null;
  difficulty?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  rivalTeamId: number | null;
  rivalName: string;
  scout: ScoutingData;
  plays: string[];            // from localStorage sf-playbook-{id}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: string | number | null | undefined, dec = 1) => {
  const n = Number(v);
  return v != null && v !== "" && !isNaN(n) ? n.toFixed(dec) : "—";
};
const fmtPct = (v: string | number | null | undefined) => {
  const n = Number(v);
  return v != null && v !== "" && !isNaN(n) ? `${(n * 100).toFixed(0)}%` : "—";
};
const ini = (name: string) =>
  name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();

async function fetchPlayerStats(playerId: number): Promise<PlayerStats | null> {
  try {
    const r = await fetch(`/api/players/${playerId}/stats`, { credentials: "include" });
    if (!r.ok) return null;
    return (await r.json()) as PlayerStats;
  } catch { return null; }
}

async function imgToBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const proxy = /^https?:\/\//i.test(url)
      ? `/api/image-proxy?url=${encodeURIComponent(url)}`
      : url;
    const r = await fetch(proxy, { credentials: "include" });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function fetchImgMap(urls: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  const pairs = await Promise.all(unique.map(async u => {
    const b64 = await imgToBase64(u);
    return b64 ? ([u, b64] as const) : null;
  }));
  return Object.fromEntries(pairs.filter((p): p is [string, string] => p !== null));
}

// ─── jsPDF drawing ────────────────────────────────────────────────────────────

type JsPDF = import("jspdf").jsPDF;
type RGB = readonly [number, number, number];

const PW = 210, PH = 297;

const C = {
  dark:   [17, 24, 39]    as RGB,
  dark2:  [26, 35, 55]    as RGB,
  orange: [249, 115, 22]  as RGB,
  orangeDk:[234, 88, 12]  as RGB,
  white:  [255, 255, 255] as RGB,
  gray1:  [107, 114, 128] as RGB,
  gray2:  [156, 163, 175] as RGB,
  gray3:  [75, 85, 99]    as RGB,
  gray4:  [209, 213, 219] as RGB,
  amber:  [245, 158, 11]  as RGB,
  blue:   [96, 165, 250]  as RGB,
  green:  [74, 222, 128]  as RGB,
  red:    [248, 113, 113] as RGB,
  purple: [196, 181, 253] as RGB,
  light:  [249, 250, 251] as RGB,
  border: [243, 244, 246] as RGB,
};

const sf = (doc: JsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const sd = (doc: JsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
const st = (doc: JsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

function topBar(doc: JsPDF) {
  sf(doc, C.orange); doc.rect(0, 0, PW, 2.5, "F");
}

function footer(doc: JsPDF, left: string, right: string, dark = false) {
  sd(doc, dark ? [35, 45, 65] : C.border); doc.setLineWidth(0.3);
  doc.line(0, PH - 10, PW, PH - 10);
  doc.setFont("helvetica", "bold"); doc.setFontSize(5.5);
  st(doc, dark ? [55, 65, 81] : C.gray4);
  doc.text(left.toUpperCase(), 13, PH - 5);
  doc.setFont("helvetica", "normal");
  doc.text(right, PW - 13, PH - 5, { align: "right" });
}

function drawAvatar(doc: JsPDF, b64: string | undefined, name: string, cx: number, cy: number, r: number, dark = false) {
  sf(doc, dark ? [30, 41, 60] : [243, 244, 246]);
  doc.circle(cx, cy, r, "F");
  if (b64) {
    try { doc.addImage(b64, cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7, undefined, "FAST"); } catch {}
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(r * 3.5);
    st(doc, C.orange);
    doc.text(ini(name), cx, cy + r * 0.9, { align: "center" });
  }
  sd(doc, dark ? [55, 65, 81] : [229, 231, 235]); doc.setLineWidth(0.3);
  doc.circle(cx, cy, r, "D");
}

function matchHeader(doc: JsPDF, props: GameReportProps, imgMap: Record<string, string>, dark = false) {
  topBar(doc);
  const homeB64 = props.homeLogoUrl ? imgMap[props.homeLogoUrl] : undefined;
  const awayB64 = props.awayLogoUrl ? imgMap[props.awayLogoUrl] : undefined;
  drawAvatar(doc, homeB64, props.homeTeam, 22, 19, 9, dark);
  drawAvatar(doc, awayB64, props.awayTeam, PW - 22, 19, 9, dark);
  // Home name
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  st(doc, dark ? C.white : C.dark);
  doc.text(props.homeTeam.toUpperCase(), 34, 17);
  doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  st(doc, dark ? C.gray3 : C.gray2);
  doc.text("LOCAL", 34, 22);
  // Away name (right aligned)
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  st(doc, dark ? C.white : C.dark);
  doc.text(props.awayTeam.toUpperCase(), PW - 34, 17, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  st(doc, dark ? C.gray3 : C.gray2);
  doc.text("VISITANTE", PW - 34, 22, { align: "right" });
  // Date center
  const fmtDate = new Date(props.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  st(doc, dark ? [75, 85, 99] : C.gray2);
  doc.text(fmtDate, PW / 2, 17, { align: "center" });
  if (props.location) doc.text(props.location, PW / 2, 22, { align: "center" });
  // Divider
  sd(doc, dark ? [30, 40, 58] : C.border); doc.setLineWidth(0.3);
  doc.line(0, 28, PW, 28);
}

// ── Page 1: Portada ───────────────────────────────────────────────────────────

function drawPortada(doc: JsPDF, props: GameReportProps, imgMap: Record<string, string>) {
  sf(doc, C.dark); doc.rect(0, 0, PW, PH, "F");
  // Side accent
  sf(doc, C.dark2); doc.rect(PW * 0.6, 0, PW * 0.4, PH, "F");
  // Top bar
  sf(doc, C.orange); doc.rect(0, 0, PW, 3.5, "F");

  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const fmtDate = new Date(props.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const cx = PW / 2;

  // Scouting tag
  sf(doc, [30, 15, 5]);
  doc.roundedRect(cx - 35, 28, 70, 8, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6);
  st(doc, C.orange);
  doc.text("INFORME DE SCOUTING", cx, 33.5, { align: "center" });

  // Team logos side by side
  const LOGO_R = 22;
  const logoY = 80;
  const homeB64 = props.homeLogoUrl ? imgMap[props.homeLogoUrl] : undefined;
  const awayB64 = props.awayLogoUrl ? imgMap[props.awayLogoUrl] : undefined;

  // Home side ring + logo
  sd(doc, C.orange); doc.setLineWidth(1);
  doc.circle(cx - 32, logoY, LOGO_R + 1.5, "D");
  drawAvatar(doc, homeB64, props.homeTeam, cx - 32, logoY, LOGO_R, true);

  // Away side ring + logo
  sd(doc, [75, 85, 99]); doc.setLineWidth(1);
  doc.circle(cx + 32, logoY, LOGO_R + 1.5, "D");
  drawAvatar(doc, awayB64, props.awayTeam, cx + 32, logoY, LOGO_R, true);

  // VS / Score
  const hasScore = props.homeScore != null && props.awayScore != null;
  if (hasScore) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    st(doc, C.white);
    doc.text(`${props.homeScore}`, cx - 10, logoY + 3, { align: "right" });
    doc.setFontSize(13); st(doc, [75, 85, 99]);
    doc.text("–", cx, logoY + 3, { align: "center" });
    doc.setFontSize(22); st(doc, C.white);
    doc.text(`${props.awayScore}`, cx + 10, logoY + 3, { align: "left" });
  } else {
    doc.setFont("helvetica", "black"); doc.setFontSize(14);
    st(doc, [55, 65, 81]);
    doc.text("VS", cx, logoY + 3, { align: "center" });
  }

  // Team names under logos
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  st(doc, C.white);
  const homeShort = props.homeTeam.length > 20 ? props.homeTeam.slice(0, 18) + "…" : props.homeTeam;
  const awayShort = props.awayTeam.length > 20 ? props.awayTeam.slice(0, 18) + "…" : props.awayTeam;
  doc.text(homeShort.toUpperCase(), cx - 32, logoY + LOGO_R + 8, { align: "center" });
  doc.text(awayShort.toUpperCase(), cx + 32, logoY + LOGO_R + 8, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  st(doc, [75, 85, 99]);
  doc.text("LOCAL", cx - 32, logoY + LOGO_R + 14, { align: "center" });
  doc.text("VISITANTE", cx + 32, logoY + LOGO_R + 14, { align: "center" });

  // Divider
  sd(doc, [35, 45, 65]); doc.setLineWidth(0.5);
  doc.line(cx - 18, logoY + LOGO_R + 20, cx + 18, logoY + LOGO_R + 20);

  // Date & location
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  st(doc, C.gray2);
  doc.text(fmtDate.charAt(0).toUpperCase() + fmtDate.slice(1), cx, logoY + LOGO_R + 30, { align: "center" });
  if (props.location) {
    doc.setFontSize(7); st(doc, C.gray3);
    doc.text(`📍 ${props.location}`, cx, logoY + LOGO_R + 38, { align: "center" });
  }

  // Difficulty stars
  if (props.difficulty) {
    const stars = props.difficulty === "facil" ? 2 : props.difficulty === "medio" ? 3 : 5;
    const label = props.difficulty === "facil" ? "FÁCIL" : props.difficulty === "medio" ? "MEDIO" : "IMPORTANTE";
    const starY = logoY + LOGO_R + 50;
    doc.setFont("helvetica", "bold"); doc.setFontSize(6);
    st(doc, C.gray3); doc.text(`DIFICULTAD: ${label}`, cx, starY, { align: "center" });
    for (let i = 0; i < 5; i++) {
      st(doc, i < stars ? C.amber : [40, 50, 68]);
      doc.text("★", cx - 14 + i * 7, starY + 7, { align: "center" });
    }
  }

  // Content sections list
  const secY = logoY + LOGO_R + 75;
  const sections = ["Análisis Táctico", "Fortalezas y Debilidades", "Plantilla Rival", "Estadísticas", "Playbook"];
  sf(doc, [22, 32, 50]);
  doc.roundedRect(cx - 55, secY - 5, 110, sections.length * 9 + 8, 4, 4, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6);
  st(doc, [75, 85, 99]); doc.text("CONTENIDO DEL INFORME", cx, secY + 2, { align: "center" });
  sections.forEach((s, i) => {
    sf(doc, C.orange); doc.circle(cx - 42, secY + 12 + i * 9, 1.2, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    st(doc, [180, 190, 210]);
    doc.text(s, cx - 36, secY + 13 + i * 9);
  });

  // Footer
  sd(doc, [35, 45, 65]); doc.setLineWidth(0.3);
  doc.line(15, PH - 14, PW - 15, PH - 14);
  doc.setFont("helvetica", "bold"); doc.setFontSize(6);
  st(doc, [55, 65, 81]); doc.text("SCOUTPRO", 15, PH - 8);
  doc.setFont("helvetica", "normal"); st(doc, [40, 50, 65]);
  doc.text(`Generado el ${today}`, PW - 15, PH - 8, { align: "right" });
}

// ── Page 2: Análisis Táctico ──────────────────────────────────────────────────

function section(doc: JsPDF, label: string, color: RGB, y: number): number {
  sf(doc, color); doc.rect(13, y, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); st(doc, color);
  doc.text(label.toUpperCase(), 18, y + 2.5);
  return y + 6;
}

function fieldBlock(doc: JsPDF, label: string, value: string, x: number, y: number, w: number, maxH = 30): number {
  if (!value.trim()) return y;
  doc.setFont("helvetica", "bold"); doc.setFontSize(6);
  st(doc, C.gray2); doc.text(label.toUpperCase(), x, y);
  y += 3.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  st(doc, [50, 60, 80]);
  const lines = doc.splitTextToSize(value, w);
  const h = Math.min(lines.length, Math.floor(maxH / 4)) * 4;
  doc.text(lines.slice(0, Math.floor(maxH / 4)), x, y);
  return y + h + 3;
}

function drawAnalisis(doc: JsPDF, props: GameReportProps, imgMap: Record<string, string>) {
  sf(doc, C.white); doc.rect(0, 0, PW, PH, "F");
  matchHeader(doc, props, imgMap, false);

  const M = 13;
  const W2 = (PW - M * 2 - 6) / 2;
  let y = 33;

  // ── ATAQUE ────────────────────────────────────────────────────────
  y = section(doc, "Ataque", C.orange, y) + 1;
  const ataqueFields = [
    ["Sistemas Principales", props.scout.sistemas],
    ["Ritmo de Juego", props.scout.ritmo],
    ["Jugadoras Generadoras", props.scout.generadoras],
    ["Observaciones", props.scout.ataqueObs],
  ].filter(([, v]) => v.trim());

  if (ataqueFields.length) {
    const colA = ataqueFields.slice(0, 2);
    const colB = ataqueFields.slice(2, 4);
    let yA = y, yB = y;
    colA.forEach(([l, v]) => { yA = fieldBlock(doc, l, v, M, yA, W2); });
    colB.forEach(([l, v]) => { yB = fieldBlock(doc, l, v, M + W2 + 6, yB, W2); });
    y = Math.max(yA, yB) + 3;
  }

  // Divider
  sd(doc, C.border); doc.setLineWidth(0.2); doc.line(M, y, PW - M, y); y += 5;

  // ── DEFENSA ───────────────────────────────────────────────────────
  y = section(doc, "Defensa", C.blue, y) + 1;
  const defFields = [
    ["Tipo de Defensa", props.scout.tipoDefensa],
    ["Presión", props.scout.presion],
    ["Pick & Roll Defensivo", props.scout.pickRoll],
    ["Defensa en Zona", props.scout.zona],
  ].filter(([, v]) => v.trim());

  if (defFields.length) {
    const colA = defFields.slice(0, 2);
    const colB = defFields.slice(2, 4);
    let yA = y, yB = y;
    colA.forEach(([l, v]) => { yA = fieldBlock(doc, l, v, M, yA, W2); });
    colB.forEach(([l, v]) => { yB = fieldBlock(doc, l, v, M + W2 + 6, yB, W2); });
    y = Math.max(yA, yB);
    if (props.scout.defensaObs.trim()) y = fieldBlock(doc, "Observaciones", props.scout.defensaObs, M, y + 2, PW - M * 2);
    y += 3;
  }

  // Divider
  sd(doc, C.border); doc.setLineWidth(0.2); doc.line(M, y, PW - M, y); y += 5;

  // ── TRANSICIÓN ────────────────────────────────────────────────────
  y = section(doc, "Transición", C.purple, y) + 1;
  const transFields = [
    ["Contraataque", props.scout.contraataque],
    ["Balance Defensivo", props.scout.balance],
  ].filter(([, v]) => v.trim());
  let yA = y, yB = y;
  transFields.slice(0, 1).forEach(([l, v]) => { yA = fieldBlock(doc, l, v, M, yA, W2); });
  transFields.slice(1, 2).forEach(([l, v]) => { yB = fieldBlock(doc, l, v, M + W2 + 6, yB, W2); });
  y = Math.max(yA, yB);
  if (props.scout.transicionObs.trim()) y = fieldBlock(doc, "Observaciones", props.scout.transicionObs, M, y + 2, PW - M * 2);

  footer(doc, `ScoutPro · ${props.homeTeam} vs ${props.awayTeam}`, `Análisis Táctico · Pág. 2`);
}

// ── Page 3: Inteligencia + Objetivos ─────────────────────────────────────────

function bulletList(doc: JsPDF, items: string[], x: number, y: number, w: number, color: RGB): number {
  items.forEach(item => {
    sf(doc, color); doc.circle(x + 2, y - 1, 1.2, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(doc, [50, 62, 80]);
    const lines = doc.splitTextToSize(item, w - 8);
    doc.text(lines, x + 6, y);
    y += lines.length * 4 + 2;
  });
  return y;
}

function drawInteligencia(doc: JsPDF, props: GameReportProps, imgMap: Record<string, string>) {
  sf(doc, C.dark); doc.rect(0, 0, PW, PH, "F");
  sf(doc, C.dark2); doc.rect(PW * 0.5, 0, PW * 0.5, PH, "F");
  matchHeader(doc, props, imgMap, true);

  const M = 13;
  let y = 34;

  // Claves del partido
  if (props.scout.clavesPartido.trim()) {
    sf(doc, [22, 32, 52]);
    doc.roundedRect(M, y, PW - M * 2, 4, 1, 1, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6);
    st(doc, C.orange); doc.text("CLAVES DEL PARTIDO", M + 3, y + 2.8);
    y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(doc, [180, 190, 210]);
    const lines = doc.splitTextToSize(props.scout.clavesPartido, PW - M * 2);
    doc.text(lines.slice(0, 4), M, y);
    y += lines.slice(0, 4).length * 4 + 5;
  }

  // Jugadoras destacadas
  if (props.scout.jugadorasDestacadas.trim()) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(6);
    st(doc, C.amber); doc.text("JUGADORAS A VIGILAR", M, y); y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(doc, [180, 190, 210]);
    const lines = doc.splitTextToSize(props.scout.jugadorasDestacadas, PW - M * 2);
    doc.text(lines.slice(0, 3), M, y);
    y += lines.slice(0, 3).length * 4 + 6;
  }

  // Divider
  sd(doc, [35, 45, 65]); doc.setLineWidth(0.2);
  doc.line(M, y, PW - M, y); y += 5;

  // Fortalezas | Debilidades (two columns)
  const colW = (PW - M * 2 - 6) / 2;
  let yLeft = y;
  let yRight = y;

  // Left: Fortalezas
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  st(doc, C.red); doc.text("⚠ FORTALEZAS", M, yLeft); yLeft += 5;
  if (props.scout.fortalezas.length) {
    yLeft = bulletList(doc, props.scout.fortalezas.slice(0, 8), M, yLeft, colW, C.red);
  } else {
    doc.setFont("helvetica", "italic"); doc.setFontSize(7); st(doc, [55, 65, 81]);
    doc.text("Sin datos", M, yLeft); yLeft += 5;
  }

  // Right: Debilidades
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  st(doc, C.green); doc.text("✓ DEBILIDADES", M + colW + 6, yRight); yRight += 5;
  if (props.scout.debilidades.length) {
    yRight = bulletList(doc, props.scout.debilidades.slice(0, 8), M + colW + 6, yRight, colW, C.green);
  } else {
    doc.setFont("helvetica", "italic"); doc.setFontSize(7); st(doc, [55, 65, 81]);
    doc.text("Sin datos", M + colW + 6, yRight); yRight += 5;
  }

  y = Math.max(yLeft, yRight) + 5;

  // Divider
  sd(doc, [35, 45, 65]); doc.setLineWidth(0.2);
  doc.line(M, y, PW - M, y); y += 5;

  // Objetivos
  if (props.scout.objetivos.trim()) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
    st(doc, C.blue); doc.text("OBJETIVOS DEL PARTIDO", M, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(doc, [150, 165, 185]);
    const lines = doc.splitTextToSize(props.scout.objetivos, PW - M * 2);
    doc.text(lines.slice(0, 6), M, y);
    y += lines.slice(0, 6).length * 4 + 5;
  }

  // Notas del entrenador
  if (props.scout.notasEntrenador.trim()) {
    if (y < PH - 50) {
      sd(doc, [35, 45, 65]); doc.setLineWidth(0.2);
      doc.line(M, y, PW - M, y); y += 5;
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      st(doc, C.orange); doc.text("NOTAS DEL ENTRENADOR", M, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(doc, [150, 165, 185]);
      const lines = doc.splitTextToSize(props.scout.notasEntrenador, PW - M * 2);
      doc.text(lines.slice(0, 5), M, y);
    }
  }

  footer(doc, `ScoutPro · ${props.homeTeam} vs ${props.awayTeam}`, `Inteligencia · Pág. 3`, true);
}

// ── Page 4: Plantilla Rival ───────────────────────────────────────────────────

function drawPlantilla(doc: JsPDF, props: GameReportProps, players: Player[], imgMap: Record<string, string>) {
  sf(doc, C.white); doc.rect(0, 0, PW, PH, "F");
  matchHeader(doc, props, imgMap, false);

  const M = 13;
  const COLS = 4;
  const CARD_W = (PW - M * 2 - (COLS - 1) * 4) / COLS;
  const CARD_H = 38;
  let y = 33;

  // Section label
  doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  st(doc, C.orange); doc.text(`PLANTILLA · ${props.rivalName.toUpperCase()}`, M, y + 4);
  doc.setFont("helvetica", "normal"); doc.setFontSize(6); st(doc, C.gray2);
  doc.text(`${players.length} jugadoras`, PW - M, y + 4, { align: "right" });
  y += 10;

  players.slice(0, 24).forEach((p, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = M + col * (CARD_W + 4) + CARD_W / 2;
    const cy = y + row * (CARD_H + 3);

    // Card bg
    sf(doc, C.light);
    doc.roundedRect(M + col * (CARD_W + 4), cy, CARD_W, CARD_H, 3, 3, "F");
    sd(doc, C.border); doc.setLineWidth(0.3);
    doc.roundedRect(M + col * (CARD_W + 4), cy, CARD_W, CARD_H, 3, 3, "D");

    // Photo
    const photoB64 = p.photoUrl ? imgMap[p.photoUrl] : undefined;
    drawAvatar(doc, photoB64, p.name, cx, cy + 10, 7);

    // Jersey # badge
    if (p.jerseyNumber != null) {
      sf(doc, C.orange);
      doc.circle(M + col * (CARD_W + 4) + CARD_W - 5, cy + 4, 4, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(5.5); st(doc, C.white);
      doc.text(String(p.jerseyNumber), M + col * (CARD_W + 4) + CARD_W - 5, cy + 5.5, { align: "center" });
    }

    // Position badge
    if (p.position) {
      sf(doc, [255, 237, 213]);
      doc.roundedRect(cx - 7, cy + 18.5, 14, 5, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(5); st(doc, C.orange);
      doc.text(p.position, cx, cy + 22, { align: "center" });
    }

    // Name
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(doc, C.dark);
    const shortName = p.name.split(" ").slice(-1)[0] ?? p.name; // last name
    doc.text(shortName.length > 14 ? shortName.slice(0, 12) + "…" : shortName, cx, cy + 28, { align: "center" });

    // Details
    const details = [p.age ? `${p.age}a` : "", p.height ?? "", p.nationality?.slice(0, 3) ?? ""].filter(Boolean).join(" · ");
    doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); st(doc, C.gray2);
    doc.text(details, cx, cy + 33, { align: "center" });
  });

  footer(doc, `ScoutPro · ${props.homeTeam} vs ${props.awayTeam}`, `Plantilla · Pág. 4`);
}

// ── Page 5: Estadísticas ──────────────────────────────────────────────────────

function drawEstadisticas(doc: JsPDF, props: GameReportProps, players: PlayerWithStats[], imgMap: Record<string, string>) {
  sf(doc, C.dark); doc.rect(0, 0, PW, PH, "F");
  matchHeader(doc, props, imgMap, true);

  const M = 13;
  let y = 33;

  // Section label
  doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  st(doc, C.orange); doc.text(`ESTADÍSTICAS · ${props.rivalName.toUpperCase()}`, M, y + 4); y += 10;

  // Table header
  sf(doc, [22, 32, 52]);
  doc.roundedRect(M, y, PW - M * 2, 7, 1, 1, "F");
  const statCols = [
    { label: "#",    x: M + 4,  w: 8  },
    { label: "JUGADORA", x: M + 14, w: 55 },
    { label: "PTS",  x: 95, w: 17 },
    { label: "REB",  x: 112, w: 17 },
    { label: "AST",  x: 129, w: 14 },
    { label: "ROB",  x: 143, w: 14 },
    { label: "TAP",  x: 157, w: 14 },
    { label: "MIN",  x: 171, w: 13 },
    { label: "%TC",  x: 184, w: 13 },
  ];
  doc.setFont("helvetica", "bold"); doc.setFontSize(5.5);
  statCols.forEach((c, i) => {
    st(doc, i === 2 ? C.orange : i === 3 ? C.amber : [75, 85, 99]);
    doc.text(c.label, c.x + (i > 1 ? c.w / 2 : 0), y + 4.5, { align: i > 1 ? "center" : "left" });
  });
  y += 9;

  const ROW_H = 9;
  players.slice(0, 24).forEach((p, i) => {
    if (i % 2 === 1) { sf(doc, [20, 30, 48]); doc.rect(M, y - ROW_H + 2, PW - M * 2, ROW_H, "F"); }
    const cy = y - 1;
    const s = p.stats;
    const hasStats = s && (s.gamesPlayed ?? 0) > 0;

    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
    st(doc, [75, 85, 99]); doc.text(String(p.jerseyNumber ?? "—"), M + 4, cy);
    const photoB64 = p.photoUrl ? imgMap[p.photoUrl] : undefined;
    drawAvatar(doc, photoB64, p.name, M + 18, cy - 1.5, 3, true);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); st(doc, [220, 225, 235]);
    doc.text(p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name, M + 24, cy);

    if (hasStats) {
      const vals = [fmt(s!.avgPoints), fmt(s!.avgRebounds), fmt(s!.avgAssists), fmt(s!.avgSteals), fmt(s!.avgBlocks), s!.avgMinutes ? fmt(s!.avgMinutes, 0) + "'" : "—", fmtPct(s!.avgFieldGoalPct)];
      statCols.slice(2).forEach((c, j) => {
        doc.setFont("helvetica", j <= 1 ? "bold" : "normal"); doc.setFontSize(7);
        st(doc, j === 0 ? C.orange : j === 1 ? C.amber : [130, 140, 160]);
        doc.text(vals[j] ?? "—", c.x + c.w / 2, cy, { align: "center" });
      });
    } else {
      doc.setFont("helvetica", "italic"); doc.setFontSize(6); st(doc, [45, 55, 70]);
      doc.text("Sin estadísticas", 95, cy);
    }

    sd(doc, [28, 38, 55]); doc.setLineWidth(0.15); doc.line(M, y + 1, PW - M, y + 1);
    y += ROW_H;
  });

  footer(doc, `ScoutPro · ${props.homeTeam} vs ${props.awayTeam}`, `Estadísticas · Pág. 5`, true);
}

// ── Page 6: Playbook ──────────────────────────────────────────────────────────

function drawPlaybook(doc: JsPDF, props: GameReportProps, plays: string[], imgMap: Record<string, string>) {
  sf(doc, C.white); doc.rect(0, 0, PW, PH, "F");
  matchHeader(doc, props, imgMap, false);

  const M = 13;
  let y = 33;

  // Section label
  doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  st(doc, C.orange); doc.text("PLAYBOOK DEL PARTIDO", M, y + 4);
  doc.setFont("helvetica", "normal"); doc.setFontSize(6); st(doc, C.gray2);
  doc.text(`${plays.length} jugada${plays.length !== 1 ? "s" : ""}`, PW - M, y + 4, { align: "right" });
  y += 12;

  if (!plays.length) {
    sf(doc, C.light); doc.roundedRect(M, y, PW - M * 2, 20, 4, 4, "F");
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); st(doc, C.gray2);
    doc.text("Sin jugadas anotadas para este partido", PW / 2, y + 12, { align: "center" });
  } else {
    plays.forEach((play, i) => {
      const ROW_H = 11;
      // Alternating background
      if (i % 2 === 0) { sf(doc, C.light); doc.roundedRect(M, y, PW - M * 2, ROW_H, 1.5, 1.5, "F"); }
      // Number badge
      sf(doc, i % 2 === 0 ? C.orange : [229, 231, 235]);
      doc.circle(M + 6, y + ROW_H / 2, 4, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      st(doc, i % 2 === 0 ? C.white : C.gray1);
      doc.text(String(i + 1), M + 6, y + ROW_H / 2 + 1.5, { align: "center" });
      // Play text
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      st(doc, C.dark);
      const lines = doc.splitTextToSize(play, PW - M * 2 - 20);
      doc.text(lines[0] ?? "", M + 14, y + ROW_H / 2 + 1.5);
      if (lines.length > 1) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); st(doc, C.gray1);
        doc.text(lines[1], M + 14, y + ROW_H / 2 + 5.5);
      }
      // Bottom border
      sd(doc, C.border); doc.setLineWidth(0.2);
      doc.line(M, y + ROW_H, PW - M, y + ROW_H);
      y += ROW_H + 2;
      if (y > PH - 20) return; // safety
    });
  }

  footer(doc, `ScoutPro · ${props.homeTeam} vs ${props.awayTeam}`, `Playbook · Pág. 6`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Export button component
// ─────────────────────────────────────────────────────────────────────────────

export function GameReportExportButton({ gameProps }: { gameProps: GameReportProps }) {
  const [exporting, setExporting] = useState(false);

  const { data: rawPlayers = [] } = useListPlayers(
    { teamId: gameProps.rivalTeamId ?? 0 },
    { query: { enabled: !!gameProps.rivalTeamId, queryKey: [...getListPlayersQueryKey({ teamId: gameProps.rivalTeamId ?? 0 }), "pdf"] } },
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
      const { default: jsPDF } = await import("jspdf");

      // Collect & fetch all images
      const allUrls = [
        gameProps.homeLogoUrl,
        gameProps.awayLogoUrl,
        ...players.map(p => p.photoUrl),
      ];
      const imgMap = await fetchImgMap(allUrls);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      drawPortada(doc, gameProps, imgMap);

      doc.addPage();
      drawAnalisis(doc, gameProps, imgMap);

      doc.addPage();
      drawInteligencia(doc, gameProps, imgMap);

      doc.addPage();
      drawPlantilla(doc, gameProps, players, imgMap);

      doc.addPage();
      drawEstadisticas(doc, gameProps, playersWithStats, imgMap);

      doc.addPage();
      drawPlaybook(doc, gameProps, gameProps.plays, imgMap);

      const safe = `${gameProps.homeTeam}-vs-${gameProps.awayTeam}-${gameProps.date}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      doc.save(`informe-${safe}.pdf`);
    } catch (err) {
      console.error("Game PDF export failed", err);
    } finally {
      setExporting(false);
    }
  }, [gameProps, players, playersWithStats]);

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="h-7 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 transition flex items-center gap-1.5 text-primary text-[11px] font-black uppercase tracking-wide disabled:opacity-50"
    >
      {exporting
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <FileDown className="h-3 w-3" />}
      {exporting ? "Generando…" : "PDF"}
    </button>
  );
}
