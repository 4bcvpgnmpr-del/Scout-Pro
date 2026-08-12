/**
 * TeamReportPDF — generates a professional multi-page A4 PDF dossier
 * using jsPDF's native drawing API (no html2canvas, no DOM capture).
 *
 * Pages:
 *   1. Portada   — dark cover: logo, team name, league, date
 *   2. Plantilla — roster table with player photos
 *   3. Estadísticas — dark stats table
 *   4+. Sistemas — tactical systems with images
 *
 * Images are fetched via /api/image-proxy (server-side, no CORS) and
 * embedded as base64 directly in jsPDF — no html2canvas needed.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  useListPlayers, useListTeamMedia, getListTeamMediaQueryKey,
} from "@workspace/api-client-react";
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

interface Team {
  id: number;
  name: string;
  logoUrl?: string | null;
  league?: string | null;
  city?: string | null;
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

interface PlayerWithStats extends Player {
  stats: PlayerStats | null;
}

interface MediaItem {
  id: number;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  category: string;
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
const initials = (name: string) =>
  name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();

async function fetchPlayerStats(playerId: number): Promise<PlayerStats | null> {
  try {
    const r = await fetch(`/api/players/${playerId}/stats`, { credentials: "include" });
    if (!r.ok) return null;
    return (await r.json()) as PlayerStats;
  } catch { return null; }
}

/** Fetch an image via server-side proxy and return base64 data URL. */
async function fetchImageBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const proxyUrl = /^https?:\/\//i.test(url)
      ? `/api/image-proxy?url=${encodeURIComponent(url)}`
      : url;
    const r = await fetch(proxyUrl, { credentials: "include" });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Fetch all images in parallel; returns map url→base64. */
async function fetchAllImages(urls: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  const results = await Promise.all(
    unique.map(async (u) => {
      const b64 = await fetchImageBase64(u);
      return b64 ? ([u, b64] as const) : null;
    })
  );
  return Object.fromEntries(results.filter((r): r is [string, string] => r !== null));
}

// ─── jsPDF drawing helpers ────────────────────────────────────────────────────

// A4 in mm
const PW = 210;
const PH = 297;

// Colours (r,g,b)
const C_DARK   = [17, 24, 39]   as const;  // #111827
const C_ORANGE = [249, 115, 22] as const;  // #f97316
const C_WHITE  = [255, 255, 255] as const;
const C_GRAY1  = [107, 114, 128] as const; // #6b7280
const C_GRAY2  = [156, 163, 175] as const; // #9ca3af
const C_GRAY3  = [55, 65, 81]   as const;  // #374151
const C_GRAY4  = [209, 213, 219] as const; // #d1d5db
const C_AMBER  = [245, 158, 11] as const;  // #f59e0b
const C_LIGHT  = [249, 250, 251] as const; // #f9fafb

type RGB = readonly [number, number, number];

function hexRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF page generators (jsPDF native)
// ─────────────────────────────────────────────────────────────────────────────

type JsPDF = import("jspdf").jsPDF;

function setFill(doc: JsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function setDraw(doc: JsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function setTxt(doc: JsPDF, c: RGB)  { doc.setTextColor(c[0], c[1], c[2]); }

/** Draw filled rounded rect (jsPDF supports 'F' for fill) */
function rRect(doc: JsPDF, x: number, y: number, w: number, h: number, r: number, c: RGB) {
  setFill(doc, c);
  doc.roundedRect(x, y, w, h, r, r, "F");
}

/** Draw a circle-clipped image, or initials if no image */
function drawAvatar(
  doc: JsPDF,
  b64: string | undefined,
  name: string,
  cx: number, cy: number, radius: number,
  bgDark = false,
) {
  const x = cx - radius;
  const y = cy - radius;
  const d = radius * 2;

  // Background circle
  setFill(doc, bgDark ? [30, 41, 59] : [243, 244, 246]);
  doc.circle(cx, cy, radius, "F");

  if (b64) {
    // jsPDF doesn't support native circle clip, so we draw the image
    // inside a slightly smaller square — good enough for small avatars
    try {
      doc.addImage(b64, cx - radius * 0.85, cy - radius * 0.85, d * 0.85 * 1.0, d * 0.85, undefined, "FAST");
    } catch { /* skip bad image */ }
  } else {
    // Initials fallback
    const ini = initials(name);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(radius * 3.5);
    setTxt(doc, C_ORANGE);
    doc.text(ini, cx, cy + radius * 0.9, { align: "center" });
  }

  // Border circle
  setDraw(doc, bgDark ? [55, 65, 81] : [229, 231, 235]);
  doc.setLineWidth(0.3);
  doc.circle(cx, cy, radius, "D");
}

// ── Page 1: Portada ───────────────────────────────────────────────────────────

function drawCover(doc: JsPDF, team: Team, season: string, logoB64: string | undefined) {
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  // Dark background
  setFill(doc, C_DARK);
  doc.rect(0, 0, PW, PH, "F");

  // Orange top bar
  setFill(doc, C_ORANGE);
  doc.rect(0, 0, PW, 3, "F");

  // Subtle right panel
  setFill(doc, [20, 28, 46]);
  doc.rect(PW * 0.55, 0, PW * 0.45, PH, "F");

  // Logo circle (centered)
  const cx = PW / 2;
  const logoR = 22;
  const logoY = 95;

  // Orange ring
  setDraw(doc, C_ORANGE);
  doc.setLineWidth(1.2);
  doc.circle(cx, logoY, logoR + 2, "D");

  // Avatar
  drawAvatar(doc, logoB64, team.name, cx, logoY, logoR, true);

  // League chip
  if (team.league) {
    const chipW = 70;
    const chipX = cx - chipW / 2;
    rRect(doc, chipX, logoY + logoR + 8, chipW, 7, 3, [30, 15, 5]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    setTxt(doc, C_ORANGE);
    doc.text(team.league.toUpperCase(), cx, logoY + logoR + 13, { align: "center" });
  }

  // Team name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  setTxt(doc, C_WHITE);
  const nameY = logoY + logoR + (team.league ? 26 : 16);
  const nameSplit = doc.splitTextToSize(team.name.toUpperCase(), PW - 40);
  doc.text(nameSplit, cx, nameY, { align: "center" });

  // City · Season
  const subY = nameY + nameSplit.length * 10 + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setTxt(doc, C_GRAY1);
  const sub = [team.city, `Temporada ${season}`].filter(Boolean).join("  ·  ");
  doc.text(sub, cx, subY, { align: "center" });

  // Divider line
  setDraw(doc, C_ORANGE);
  doc.setLineWidth(0.8);
  doc.line(cx - 20, subY + 10, cx + 20, subY + 10);

  // Report label box
  const boxY = subY + 18;
  rRect(doc, cx - 45, boxY, 90, 20, 4, [25, 32, 48]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setTxt(doc, C_GRAY2);
  doc.text("DOSSIER DE EQUIPO", cx, boxY + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  setTxt(doc, C_GRAY3);
  doc.text("Plantilla · Estadísticas · Sistemas de Juego", cx, boxY + 14, { align: "center" });

  // Footer
  setDraw(doc, [35, 42, 58]);
  doc.setLineWidth(0.3);
  doc.line(15, PH - 12, PW - 15, PH - 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  setTxt(doc, C_GRAY3);
  doc.text("SCOUTPRO", 15, PH - 7);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el ${today}`, PW - 15, PH - 7, { align: "right" });
}

// ── Page 2: Plantilla ─────────────────────────────────────────────────────────

function drawPlantilla(
  doc: JsPDF, team: Team, players: Player[], season: string,
  logoB64: string | undefined,
  photoMap: Record<string, string>,
) {
  // White background
  setFill(doc, C_WHITE);
  doc.rect(0, 0, PW, PH, "F");

  // Orange top bar
  setFill(doc, C_ORANGE);
  doc.rect(0, 0, PW, 2.5, "F");

  // Header
  const LOGO_R = 8;
  const LOGO_CX = 18;
  const LOGO_CY = 18;
  drawAvatar(doc, logoB64, team.name, LOGO_CX, LOGO_CY, LOGO_R);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  setTxt(doc, C_ORANGE);
  doc.text("PLANTILLA", 30, 14);
  doc.setFontSize(13);
  setTxt(doc, C_DARK);
  doc.text(team.name.toUpperCase(), 30, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  setTxt(doc, C_GRAY2);
  doc.text(`Temporada ${season}`, PW - 15, 14, { align: "right" });
  doc.text(`${players.length} jugadores`, PW - 15, 20, { align: "right" });

  // Divider
  setDraw(doc, [243, 244, 246]);
  doc.setLineWidth(0.3);
  doc.line(0, 28, PW, 28);

  // Table header
  const ROW_H  = 9.5;
  const HEAD_Y = 34;
  setFill(doc, C_LIGHT);
  doc.rect(0, HEAD_Y - 5, PW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  setTxt(doc, C_GRAY2);
  const cols = [
    { label: "#",       x: 14,  align: "center" },
    { label: "JUGADOR", x: 28,  align: "left"   },
    { label: "POS",     x: 118, align: "center" },
    { label: "EDAD",    x: 140, align: "center" },
    { label: "ALTURA",  x: 163, align: "center" },
    { label: "NAC.",    x: 186, align: "center" },
  ] as const;
  for (const c of cols) {
    doc.text(c.label, c.x, HEAD_Y - 1, { align: c.align as "center" | "left" });
  }

  // Rows
  players.slice(0, 26).forEach((p, i) => {
    const rowY = HEAD_Y + 4 + i * ROW_H;

    // Alternating background
    if (i % 2 === 1) {
      setFill(doc, [250, 250, 250]);
      doc.rect(0, rowY - 5, PW, ROW_H, "F");
    }

    const cy = rowY - 1.5;

    // Jersey #
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setTxt(doc, C_GRAY4);
    doc.text(String(p.jerseyNumber ?? "—"), 14, cy + 1, { align: "center" });

    // Photo
    const photoB64 = p.photoUrl ? photoMap[p.photoUrl] : undefined;
    drawAvatar(doc, photoB64, p.name, 24, cy, 3.5);

    // Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setTxt(doc, C_DARK);
    const shortName = p.name.length > 30 ? p.name.slice(0, 28) + "…" : p.name;
    doc.text(shortName, 30, cy + 1.2);

    // Position badge
    if (p.position) {
      rRect(doc, 110, cy - 3.5, 18, 5.5, 1.5, [255, 237, 213]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      setTxt(doc, C_ORANGE);
      doc.text(p.position, 119, cy + 0.2, { align: "center" });
    }

    // Age, height, nationality
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setTxt(doc, C_GRAY1);
    doc.text(String(p.age ?? "—"), 140, cy + 1.2, { align: "center" });
    doc.text(p.height ? String(p.height) : "—", 163, cy + 1.2, { align: "center" });
    doc.text(p.nationality ? p.nationality.slice(0, 12) : "—", 186, cy + 1.2, { align: "center" });

    // Row separator
    setDraw(doc, [243, 244, 246]);
    doc.setLineWidth(0.2);
    doc.line(0, rowY + ROW_H - 5, PW, rowY + ROW_H - 5);
  });

  drawFooter(doc, team.name, "Plantilla", 2);
}

// ── Page 3: Estadísticas ──────────────────────────────────────────────────────

function drawStats(
  doc: JsPDF, team: Team, players: PlayerWithStats[], season: string,
  logoB64: string | undefined,
  photoMap: Record<string, string>,
) {
  // Dark background
  setFill(doc, C_DARK);
  doc.rect(0, 0, PW, PH, "F");

  // Orange top bar
  setFill(doc, C_ORANGE);
  doc.rect(0, 0, PW, 2.5, "F");

  // Header
  drawAvatar(doc, logoB64, team.name, 18, 18, 8, true);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  setTxt(doc, C_ORANGE);
  doc.text("ESTADÍSTICAS MEDIAS", 30, 14);
  doc.setFontSize(13);
  setTxt(doc, C_WHITE);
  doc.text(team.name.toUpperCase(), 30, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  setTxt(doc, [75, 85, 99]);
  doc.text(`Temporada ${season}`, PW - 15, 17, { align: "right" });

  setDraw(doc, [30, 40, 58]);
  doc.setLineWidth(0.3);
  doc.line(0, 28, PW, 28);

  // Table header
  const HEAD_Y = 35;
  setFill(doc, [20, 30, 48]);
  doc.rect(0, HEAD_Y - 5, PW, 6, "F");

  const statCols = [
    { label: "#",    x: 11,  w: 8  },
    { label: "JUGADOR", x: 27, w: 50 },
    { label: "VAL",  x: 85,  w: 17 },
    { label: "PTS",  x: 102, w: 17 },
    { label: "REB",  x: 119, w: 17 },
    { label: "AST",  x: 136, w: 17 },
    { label: "ROB",  x: 153, w: 14 },
    { label: "TAP",  x: 167, w: 14 },
    { label: "%TC",  x: 181, w: 14 },
    { label: "%3P",  x: 195, w: 14 },
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5);
  for (const [i, c] of statCols.entries()) {
    setTxt(doc, i === 2 ? C_ORANGE : i === 3 ? C_AMBER : [75, 85, 99]);
    doc.text(c.label, c.x + c.w / 2, HEAD_Y - 1, { align: "center" });
  }

  // Rows
  const ROW_H = 9.5;
  players.slice(0, 26).forEach((p, i) => {
    const rowY = HEAD_Y + 4 + i * ROW_H;

    if (i % 2 === 1) {
      setFill(doc, [20, 28, 44]);
      doc.rect(0, rowY - 5, PW, ROW_H, "F");
    }

    const cy = rowY - 1.5;
    const s = p.stats;
    const hasStats = s && (s.gamesPlayed ?? 0) > 0;

    // #
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setTxt(doc, [75, 85, 99]);
    doc.text(String(p.jerseyNumber ?? "—"), 15, cy + 1.2, { align: "center" });

    // Photo
    const photoB64 = p.photoUrl ? photoMap[p.photoUrl] : undefined;
    drawAvatar(doc, photoB64, p.name, 23, cy, 3.2, true);

    // Name + position
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setTxt(doc, [229, 231, 235]);
    doc.text((p.name.length > 24 ? p.name.slice(0, 22) + "…" : p.name), 29, cy + 0.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    setTxt(doc, [75, 85, 99]);
    doc.text(p.position ?? "", 29, cy + 4);

    if (hasStats) {
      const valNum = [s!.avgPoints, s!.avgRebounds, s!.avgAssists, s!.avgSteals, s!.avgBlocks]
        .reduce<number>((acc, v) => acc + (Number(v) || 0), 0);

      const vals = [
        valNum.toFixed(1),
        fmt(s!.avgPoints),
        fmt(s!.avgRebounds),
        fmt(s!.avgAssists),
        fmt(s!.avgSteals),
        fmt(s!.avgBlocks),
        fmtPct(s!.avgFieldGoalPct),
        fmtPct(s!.avgThreePointPct),
      ];
      for (const [j, col] of statCols.slice(2).entries()) {
        setTxt(doc, j === 0 ? C_ORANGE : j === 1 ? C_AMBER : [156, 163, 175]);
        doc.setFont("helvetica", j <= 1 ? "bold" : "normal");
        doc.setFontSize(7);
        doc.text(vals[j] ?? "—", col.x + col.w / 2, cy + 1.2, { align: "center" });
      }
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6);
      setTxt(doc, [55, 65, 81]);
      doc.text("Sin estadísticas", 90, cy + 1.2);
    }

    setDraw(doc, [30, 40, 56]);
    doc.setLineWidth(0.2);
    doc.line(0, rowY + ROW_H - 5, PW, rowY + ROW_H - 5);
  });

  drawFooterDark(doc, team.name, "Estadísticas", 3);
}

// ── Page 4+: Sistemas ─────────────────────────────────────────────────────────

function drawSistemas(
  doc: JsPDF, team: Team, sistemas: MediaItem[], season: string,
  pageNum: number,
  logoB64: string | undefined,
  sysImgMap: Record<string, string>,
) {
  setFill(doc, C_WHITE);
  doc.rect(0, 0, PW, PH, "F");
  setFill(doc, C_ORANGE);
  doc.rect(0, 0, PW, 2.5, "F");

  drawAvatar(doc, logoB64, team.name, 18, 18, 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  setTxt(doc, C_ORANGE);
  doc.text("SISTEMAS DE JUEGO", 30, 14);
  doc.setFontSize(13);
  setTxt(doc, C_DARK);
  doc.text(team.name.toUpperCase(), 30, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  setTxt(doc, C_GRAY2);
  doc.text(`Temporada ${season}`, PW - 15, 17, { align: "right" });

  setDraw(doc, [243, 244, 246]);
  doc.setLineWidth(0.3);
  doc.line(0, 28, PW, 28);

  let curY = 34;
  const MARGIN = 13;
  const CONTENT_W = PW - MARGIN * 2;

  for (const s of sistemas) {
    if (curY > PH - 30) break;

    const sImgUrl = s.url && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(s.url) ? s.url : null;
    const sImgB64 = sImgUrl ? sysImgMap[sImgUrl] : undefined;

    // Title bar (dark)
    const titleH = 9;
    setFill(doc, C_DARK);
    doc.roundedRect(MARGIN, curY, CONTENT_W, titleH, 2, 2, "F");

    // Orange dot
    setFill(doc, C_ORANGE);
    doc.circle(MARGIN + 6, curY + titleH / 2, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTxt(doc, C_WHITE);
    doc.text((s.title || "Sistema").toUpperCase(), MARGIN + 12, curY + 6);
    curY += titleH;

    // Body
    const bodyY = curY;
    const descW = sImgB64 ? CONTENT_W * 0.52 : CONTENT_W;
    const imgW  = sImgB64 ? CONTENT_W * 0.44 : 0;

    let bodyH = 0;

    if (s.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setTxt(doc, [74, 85, 99]);
      const lines = doc.splitTextToSize(s.description, descW - 8);
      const textH = lines.length * 4.5;
      bodyH = Math.max(bodyH, textH + 10);

      // Draw text box background
      setFill(doc, [249, 250, 251]);
      doc.roundedRect(MARGIN, bodyY, descW, bodyH || 20, 0, 0, "F");
      doc.text(lines, MARGIN + 4, bodyY + 6);
    }

    if (sImgB64) {
      const imgTargetH = Math.min(bodyH || 40, 50);
      bodyH = Math.max(bodyH, imgTargetH);
      try {
        doc.addImage(
          sImgB64,
          MARGIN + descW + 2, bodyY,
          imgW - 2, imgTargetH,
          undefined, "FAST",
        );
      } catch { /* skip bad image */ }
    }

    // Border around body
    setDraw(doc, [229, 231, 235]);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, bodyY, CONTENT_W, bodyH || 20, 0, 0, "D");

    curY = bodyY + (bodyH || 20) + 8;
  }

  drawFooter(doc, team.name, "Sistemas de Juego", pageNum);
}

// ── Shared footers ────────────────────────────────────────────────────────────

function drawFooter(doc: JsPDF, teamName: string, label: string, page: number) {
  setDraw(doc, [243, 244, 246]);
  doc.setLineWidth(0.3);
  doc.line(0, PH - 10, PW, PH - 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  setTxt(doc, C_GRAY4);
  doc.text(`SCOUTPRO · ${teamName.toUpperCase()}`, 13, PH - 5);
  doc.setFont("helvetica", "normal");
  doc.text(`${label} · Pág. ${page}`, PW - 13, PH - 5, { align: "right" });
}

function drawFooterDark(doc: JsPDF, teamName: string, label: string, page: number) {
  setDraw(doc, [30, 40, 58]);
  doc.setLineWidth(0.3);
  doc.line(0, PH - 10, PW, PH - 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  setTxt(doc, C_GRAY3);
  doc.text(`SCOUTPRO · ${teamName.toUpperCase()}`, 13, PH - 5);
  doc.setFont("helvetica", "normal");
  doc.text(`${label} · Pág. ${page}`, PW - 13, PH - 5, { align: "right" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Export button
// ─────────────────────────────────────────────────────────────────────────────

export function TeamReportExportButton({ team, season = "2025/26" }: { team: Team; season?: string }) {
  const [exporting, setExporting] = useState(false);

  const { data: players = [] } = useListPlayers(
    { teamId: team.id },
    { query: { queryKey: ["players-pdf", team.id] } },
  );
  const { data: allMedia = [] } = useListTeamMedia(team.id, undefined, {
    query: { queryKey: [...getListTeamMediaQueryKey(team.id), "pdf"] },
  });
  const sistemas = allMedia.filter((m) => m.category === "system");

  const [statsMap, setStatsMap] = useState<Record<number, PlayerStats | null>>({});
  const playerIds = (players as Player[]).map((p) => p.id).join(",");
  useEffect(() => {
    if (!players.length) return;
    Promise.all(
      (players as Player[]).map(async (p) => ({ id: p.id, stats: await fetchPlayerStats(p.id) }))
    ).then((results) => {
      const m: Record<number, PlayerStats | null> = {};
      results.forEach(({ id, stats }) => { m[id] = stats; });
      setStatsMap(m);
    });
  }, [playerIds]);

  const playersWithStats: PlayerWithStats[] = (players as Player[])
    .sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99))
    .map((p) => ({ ...p, stats: statsMap[p.id] ?? null }));

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");

      // ── 1. Collect all image URLs ────────────────────────────────────────
      const allImageUrls = [
        team.logoUrl,
        ...playersWithStats.map((p) => p.photoUrl),
        ...sistemas.map((s) => (s.url && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(s.url) ? s.url : null)),
      ];

      // ── 2. Fetch all as base64 in parallel via server proxy ──────────────
      const imgMap = await fetchAllImages(allImageUrls);
      const logoB64 = team.logoUrl ? imgMap[team.logoUrl] : undefined;
      const photoMap: Record<string, string> = {};
      playersWithStats.forEach((p) => { if (p.photoUrl && imgMap[p.photoUrl]) photoMap[p.photoUrl] = imgMap[p.photoUrl]; });

      // ── 3. Build PDF programmatically ────────────────────────────────────
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Page 1 — Cover
      drawCover(doc, team, season, logoB64);

      // Page 2 — Plantilla
      doc.addPage();
      drawPlantilla(doc, team, playersWithStats, season, logoB64, photoMap);

      // Page 3 — Stats
      doc.addPage();
      drawStats(doc, team, playersWithStats, season, logoB64, photoMap);

      // Pages 4+ — Sistemas (3 per page)
      const SIS_PER = 3;
      for (let i = 0; i < sistemas.length; i += SIS_PER) {
        doc.addPage();
        const sysImgMap: Record<string, string> = {};
        sistemas.slice(i, i + SIS_PER).forEach((s) => {
          if (s.url && imgMap[s.url]) sysImgMap[s.url] = imgMap[s.url];
        });
        drawSistemas(doc, team, sistemas.slice(i, i + SIS_PER), season, 4 + i / SIS_PER, logoB64, sysImgMap);
      }

      const safeName = team.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      doc.save(`dossier-${safeName}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setExporting(false);
    }
  }, [team, season, playersWithStats, sistemas]);

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-1.5 text-xs font-black tracking-wide uppercase px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted transition disabled:opacity-50"
    >
      {exporting
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <FileDown className="h-3.5 w-3.5" />}
      {exporting ? "Generando…" : "Exportar PDF"}
    </button>
  );
}
