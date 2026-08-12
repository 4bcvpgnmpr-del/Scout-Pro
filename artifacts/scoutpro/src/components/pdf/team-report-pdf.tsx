/**
 * TeamReportPDF — exports a professional multi-page A4 PDF dossier.
 *
 * Pages:
 *   1. Portada   — dark cover: logo, team name, league, date
 *   2. Plantilla — roster table (photo, #, name, pos, age, height, nationality)
 *   3. Stats     — dark stats table (VAL, Pts, Reb, Ast, Rob, Tap, Min, %TC, %3P, %TL)
 *   4+. Sistemas — tactical systems with title, description, image
 *
 * Uses html2canvas-pro (required for Tailwind v4 oklch colours) + jsPDF.
 * Each page is a fixed 794×1123 px div rendered off-screen.
 *
 * Image strategy: all image URLs are pre-fetched as base64 data-URLs and
 * passed into every page component via `imgMap`. The off-screen divs therefore
 * always render real base64 data, not network URLs that the browser would
 * never load for an element at left:-9999px.
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
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

/** Map: original URL → base64 data-URL */
type ImgMap = Record<string, string>;

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

/** Resolve URL from imgMap (or return original as fallback). */
const ri = (url: string | null | undefined, map: ImgMap): string | undefined =>
  url ? (map[url] ?? url) : undefined;

async function fetchPlayerStats(playerId: number): Promise<PlayerStats | null> {
  try {
    const r = await fetch(`/api/players/${playerId}/stats`, { credentials: "include" });
    if (!r.ok) return null;
    return (await r.json()) as PlayerStats;
  } catch { return null; }
}

/** Fetch one image URL and convert to base64 data-URL.
 *  External URLs (e.g. imagenes.feb.es) are routed through /api/image-proxy
 *  to avoid CORS restrictions on the client side. */
async function imgToBase64(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;

  // Route external URLs through the server-side proxy
  const fetchUrl = /^https?:\/\//i.test(url)
    ? `/api/image-proxy?url=${encodeURIComponent(url)}`
    : url;

  try {
    const r = await fetch(fetchUrl, { credentials: "include" });
    if (!r.ok) return url;
    const blob = await r.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

/** Pre-load all unique non-null URLs → base64 map. */
async function preloadImgMap(urls: (string | null | undefined)[]): Promise<ImgMap> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  const pairs = await Promise.all(unique.map(async (u) => [u, await imgToBase64(u)] as const));
  return Object.fromEntries(pairs);
}

// ─── PDF page dimensions ──────────────────────────────────────────────────────

const W = 794;   // A4 at 96dpi
const H = 1123;

// ─── Shared colours ───────────────────────────────────────────────────────────

const DARK_BG   = "#111827";
const ORANGE    = "#f97316";
const ORANGE_DK = "#ea580c";

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TeamLogo({ team, size, imgMap }: { team: Team; size: number; imgMap: ImgMap }) {
  const ini = initials(team.name);
  const b64 = ri(team.logoUrl, imgMap);
  return (
    <div style={{
      width: size, height: size, borderRadius: size > 80 ? "50%" : 14,
      border: size > 80 ? `4px solid ${ORANGE}` : `2px solid rgba(249,115,22,0.3)`,
      overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(249,115,22,0.08)", flexShrink: 0,
      ...(size > 80 ? { boxShadow: `0 0 60px rgba(249,115,22,0.25)`, marginBottom: 40 } : {}),
    }}>
      {b64
        ? <img src={b64} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontSize: size * 0.32, fontWeight: 900, color: ORANGE }}>{ini}</span>
      }
    </div>
  );
}

function PlayerAvatar({ player, size, dark, imgMap }: { player: Player; size: number; dark?: boolean; imgMap: ImgMap }) {
  const ini = initials(player.name);
  const b64 = ri(player.photoUrl, imgMap);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `1.5px solid ${dark ? "rgba(255,255,255,0.1)" : "#e5e7eb"}`,
      overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      background: dark ? "rgba(255,255,255,0.05)" : "#f3f4f6", flexShrink: 0,
    }}>
      {b64
        ? <img src={b64} alt={player.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontSize: size * 0.32, fontWeight: 900, color: ORANGE }}>{ini}</span>
      }
    </div>
  );
}

function PageFooter({ team, page, label }: { team: Team; page: number; label: string }) {
  return (
    <div style={{
      borderTop: "1px solid #f3f4f6", padding: "12px 48px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      background: "#fafafa",
    }}>
      <span style={{ fontSize: 10, color: "#d1d5db", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        ScoutPro · {team.name}
      </span>
      <span style={{ fontSize: 10, color: "#d1d5db" }}>{label} · Pág. {page}</span>
    </div>
  );
}

function PageFooterDark({ team, page, label }: { team: Team; page: number; label: string }) {
  return (
    <div style={{
      borderTop: "1px solid rgba(255,255,255,0.05)", padding: "12px 48px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <span style={{ fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        ScoutPro · {team.name}
      </span>
      <span style={{ fontSize: 10, color: "#374151" }}>{label} · Pág. {page}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 1: Portada
// ─────────────────────────────────────────────────────────────────────────────

function CoverPage({ team, season, imgMap }: { team: Team; season: string; imgMap: ImgMap }) {
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{
      width: W, height: H, background: DARK_BG,
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ height: 8, background: `linear-gradient(90deg, ${ORANGE}, ${ORANGE_DK})` }} />

      <div style={{
        position: "absolute", top: 8, right: 0, width: 360, height: H,
        background: "rgba(249,115,22,0.04)",
        clipPath: "polygon(40% 0%, 100% 0%, 100% 100%, 0% 100%)",
      }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 80px", position: "relative" }}>
        <TeamLogo team={team} size={180} imgMap={imgMap} />

        {team.league && (
          <div style={{
            background: "rgba(249,115,22,0.15)", border: `1px solid rgba(249,115,22,0.3)`,
            borderRadius: 99, padding: "4px 16px", marginBottom: 16,
            color: ORANGE, fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase",
          }}>{team.league}</div>
        )}

        <h1 style={{
          color: "#ffffff", fontSize: 52, fontWeight: 900,
          letterSpacing: "-0.02em", textTransform: "uppercase", textAlign: "center",
          lineHeight: 1.1, margin: "0 0 12px", fontStyle: "italic",
        }}>{team.name}</h1>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          {team.city && (
            <>
              <span style={{ color: "#6b7280", fontSize: 14, fontWeight: 600 }}>{team.city}</span>
              <span style={{ color: "#374151", fontSize: 14 }}>·</span>
            </>
          )}
          <span style={{ color: "#6b7280", fontSize: 14, fontWeight: 600 }}>Temporada {season}</span>
        </div>

        <div style={{ width: 120, height: 3, borderRadius: 99, background: `linear-gradient(90deg, ${ORANGE}, transparent)`, margin: "48px 0" }} />

        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: "24px 48px", textAlign: "center",
        }}>
          <p style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>
            Dossier de Equipo
          </p>
          <p style={{ color: "#4b5563", fontSize: 11, margin: "6px 0 0", letterSpacing: "0.1em" }}>
            Plantilla · Estadísticas · Sistemas de Juego
          </p>
        </div>
      </div>

      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 48px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "#374151", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>ScoutPro</span>
        <span style={{ color: "#374151", fontSize: 11 }}>Generado el {today}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 2: Plantilla
// ─────────────────────────────────────────────────────────────────────────────

function PlantillaPage({ team, players, season, imgMap }: { team: Team; players: Player[]; season: string; imgMap: ImgMap }) {
  const cols = ["#", "Jugador", "Pos", "Edad", "Alt", "Nac."];

  return (
    <div style={{
      width: W, height: H, background: "#ffffff",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ height: 6, background: `linear-gradient(90deg, ${ORANGE}, ${ORANGE_DK})` }} />

      <div style={{
        padding: "28px 48px 20px", borderBottom: "1px solid #f3f4f6",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <TeamLogo team={team} size={56} imgMap={imgMap} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: ORANGE, letterSpacing: "0.2em", textTransform: "uppercase" }}>Plantilla</p>
          <h2 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 900, color: "#111827", textTransform: "uppercase", fontStyle: "italic" }}>{team.name}</h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#9ca3af" }}>Temporada</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "#374151" }}>{season}</p>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#d1d5db" }}>{players.length} jugadores</p>
        </div>
      </div>

      <div style={{ display: "flex", padding: "10px 48px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
        {cols.map((c, i) => (
          <div key={c} style={{
            fontSize: 9, fontWeight: 800, color: "#9ca3af",
            letterSpacing: "0.15em", textTransform: "uppercase",
            width: i === 0 ? 32 : i === 1 ? 260 : 80,
            textAlign: i > 1 ? "center" : "left", flexShrink: 0,
          }}>{c}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "hidden" }}>
        {players.slice(0, 22).map((p, idx) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center",
            padding: "9px 48px",
            background: idx % 2 === 0 ? "#ffffff" : "#fafafa",
            borderBottom: "1px solid #f3f4f6",
          }}>
            <div style={{ width: 32, fontSize: 12, fontWeight: 700, color: "#d1d5db", fontFamily: "monospace" }}>{p.jerseyNumber ?? "—"}</div>
            <div style={{ width: 260, display: "flex", alignItems: "center", gap: 10 }}>
              <PlayerAvatar player={p} size={32} imgMap={imgMap} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{p.name}</span>
            </div>
            <div style={{ width: 80, textAlign: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: ORANGE, background: "rgba(249,115,22,0.1)", borderRadius: 6, padding: "2px 8px" }}>{p.position ?? "—"}</span>
            </div>
            <div style={{ width: 80, fontSize: 13, color: "#6b7280", textAlign: "center" }}>{p.age ?? "—"}</div>
            <div style={{ width: 80, fontSize: 13, color: "#6b7280", textAlign: "center" }}>{p.height ?? "—"}</div>
            <div style={{ width: 80, fontSize: 13, color: "#6b7280", textAlign: "center" }}>{p.nationality ?? "—"}</div>
          </div>
        ))}
      </div>

      <PageFooter team={team} page={2} label="Plantilla" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 3: Estadísticas
// ─────────────────────────────────────────────────────────────────────────────

function StatsPage({ team, players, season, imgMap }: { team: Team; players: PlayerWithStats[]; season: string; imgMap: ImgMap }) {
  const headers = ["VAL", "Pts", "Reb", "Ast", "Rob", "Tap", "Min", "%TC", "%3P", "%TL"];

  return (
    <div style={{
      width: W, height: H, background: DARK_BG,
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ height: 6, background: `linear-gradient(90deg, ${ORANGE}, ${ORANGE_DK})` }} />

      <div style={{
        padding: "28px 48px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <TeamLogo team={team} size={56} imgMap={imgMap} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: ORANGE, letterSpacing: "0.2em", textTransform: "uppercase" }}>Estadísticas Medias</p>
          <h2 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 900, color: "#ffffff", textTransform: "uppercase", fontStyle: "italic" }}>{team.name}</h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>Temporada</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "#6b7280" }}>{season}</p>
        </div>
      </div>

      <div style={{ display: "flex", padding: "10px 48px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ width: 32, fontSize: 9, fontWeight: 800, color: "#4b5563", letterSpacing: "0.15em", textTransform: "uppercase" }}>#</div>
        <div style={{ width: 220, fontSize: 9, fontWeight: 800, color: "#4b5563", letterSpacing: "0.15em", textTransform: "uppercase" }}>Jugador</div>
        {headers.map((h, i) => (
          <div key={h} style={{
            width: 49, textAlign: "center", fontSize: 9, fontWeight: 800,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: i === 0 ? ORANGE : i === 1 ? "#f59e0b" : "#4b5563",
          }}>{h}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "hidden" }}>
        {players.slice(0, 22).map((p, idx) => {
          const s = p.stats;
          const hasStats = s && (s.gamesPlayed ?? 0) > 0;
          const valNum = hasStats
            ? [s!.avgPoints, s!.avgRebounds, s!.avgAssists, s!.avgSteals, s!.avgBlocks]
                .reduce<number>((acc, v) => acc + (Number(v) || 0), 0)
            : 0;

          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center",
              padding: "9px 48px",
              background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div style={{ width: 32, fontSize: 11, color: "#374151", fontFamily: "monospace" }}>{p.jerseyNumber ?? "—"}</div>
              <div style={{ width: 220, display: "flex", alignItems: "center", gap: 8 }}>
                <PlayerAvatar player={p} size={28} dark imgMap={imgMap} />
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{p.name}</p>
                  <p style={{ margin: 0, fontSize: 9, color: "#4b5563" }}>{p.position ?? ""}</p>
                </div>
              </div>
              {hasStats ? (
                <>
                  <div style={{ width: 49, textAlign: "center", fontSize: 12, fontWeight: 900, color: ORANGE }}>{valNum.toFixed(1)}</div>
                  <div style={{ width: 49, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{fmt(s!.avgPoints)}</div>
                  <div style={{ width: 49, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>{fmt(s!.avgRebounds)}</div>
                  <div style={{ width: 49, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>{fmt(s!.avgAssists)}</div>
                  <div style={{ width: 49, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>{fmt(s!.avgSteals)}</div>
                  <div style={{ width: 49, textAlign: "center", fontSize: 12, color: "#6b7280" }}>{fmt(s!.avgBlocks)}</div>
                  <div style={{ width: 49, textAlign: "center", fontSize: 12, color: "#6b7280" }}>{s!.avgMinutes ? fmt(s!.avgMinutes, 0) + "'" : "—"}</div>
                  <div style={{ width: 49, textAlign: "center", fontSize: 12, color: "#6b7280" }}>{fmtPct(s!.avgFieldGoalPct)}</div>
                  <div style={{ width: 49, textAlign: "center", fontSize: 12, color: "#6b7280" }}>{fmtPct(s!.avgThreePointPct)}</div>
                  <div style={{ width: 49, textAlign: "center", fontSize: 12, color: "#6b7280" }}>{fmtPct(s!.avgFreeThrowPct)}</div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: "#374151", fontStyle: "italic", paddingLeft: 4 }}>Sin estadísticas</div>
              )}
            </div>
          );
        })}
      </div>

      <PageFooterDark team={team} page={3} label="Estadísticas" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 4+: Sistemas de Juego
// ─────────────────────────────────────────────────────────────────────────────

function SistemasPage({ team, sistemas, season, pageNum, imgMap }: {
  team: Team; sistemas: MediaItem[]; season: string; pageNum: number; imgMap: ImgMap;
}) {
  return (
    <div style={{
      width: W, height: H, background: "#ffffff",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ height: 6, background: `linear-gradient(90deg, ${ORANGE}, ${ORANGE_DK})` }} />

      <div style={{
        padding: "28px 48px 20px", borderBottom: "1px solid #f3f4f6",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <TeamLogo team={team} size={56} imgMap={imgMap} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: ORANGE, letterSpacing: "0.2em", textTransform: "uppercase" }}>Sistemas de Juego</p>
          <h2 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 900, color: "#111827", textTransform: "uppercase", fontStyle: "italic" }}>{team.name}</h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#9ca3af" }}>Temporada</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "#374151" }}>{season}</p>
        </div>
      </div>

      <div style={{ flex: 1, padding: "24px 48px", overflowY: "hidden", display: "flex", flexDirection: "column", gap: 20 }}>
        {sistemas.map((s) => {
          const sImgUrl = s.url && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(s.url) ? s.url : null;
          const sImgB64 = sImgUrl ? ri(sImgUrl, imgMap) : undefined;

          return (
            <div key={s.id} style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden", flexShrink: 0 }}>
              <div style={{ background: "#111827", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: ORANGE, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 900, color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.05em", fontStyle: "italic" }}>
                  {s.title || "Sistema"}
                </span>
              </div>
              <div style={{ display: "flex" }}>
                {s.description && (
                  <div style={{ padding: "16px 20px", flex: sImgB64 ? "0 0 280px" : 1, borderRight: sImgB64 ? "1px solid #f3f4f6" : "none" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#4b5563", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{s.description}</p>
                  </div>
                )}
                {sImgB64 && (
                  <div style={{ flex: 1, maxHeight: 200, overflow: "hidden" }}>
                    <img src={sImgB64} alt={s.title ?? "Sistema"} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12 }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PageFooter team={team} page={pageNum} label="Sistemas de Juego" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export button + orchestration
// ─────────────────────────────────────────────────────────────────────────────

export function TeamReportExportButton({ team, season = "2025/26" }: { team: Team; season?: string }) {
  const [exporting, setExporting] = useState(false);
  /** base64 image map — populated lazily when export is triggered */
  const [imgMap, setImgMap] = useState<ImgMap>({});
  const [imgMapReady, setImgMapReady] = useState(false);

  // Fetch players + media
  const { data: players = [] } = useListPlayers(
    { teamId: team.id },
    { query: { queryKey: ["players-pdf", team.id] } },
  );
  const { data: allMedia = [] } = useListTeamMedia(team.id, undefined, {
    query: { queryKey: [...getListTeamMediaQueryKey(team.id), "pdf"] },
  });
  const sistemas = allMedia.filter((m) => m.category === "system");

  // Refs
  const coverRef     = useRef<HTMLDivElement | null>(null);
  const plantillaRef = useRef<HTMLDivElement | null>(null);
  const statsRef     = useRef<HTMLDivElement | null>(null);
  const SIS_PER_PAGE = 3;
  const sistemasChunks: MediaItem[][] = [];
  for (let i = 0; i < sistemas.length; i += SIS_PER_PAGE) {
    sistemasChunks.push(sistemas.slice(i, i + SIS_PER_PAGE));
  }
  const sisRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Stats pre-fetch
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

  // When imgMap is ready, proceed to capture
  const captureRef = useRef(false);
  useEffect(() => {
    if (!imgMapReady || !exporting || captureRef.current) return;
    captureRef.current = true;

    (async () => {
      try {
        const [html2canvasMod, jspdfMod] = await Promise.all([
          import("html2canvas-pro").then((m) => m.default),
          import("jspdf"),
        ]);
        const jsPDF = jspdfMod.default;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        const refs: Array<HTMLDivElement | null> = [
          coverRef.current,
          plantillaRef.current,
          statsRef.current,
          ...sisRefs.current.slice(0, sistemasChunks.length),
        ].filter(Boolean) as HTMLDivElement[];

        for (let i = 0; i < refs.length; i++) {
          const el = refs[i];
          if (!el) continue;
          if (i > 0) pdf.addPage();
          const canvas = await html2canvasMod(el, {
            scale: 2,
            useCORS: false,
            allowTaint: false,
            backgroundColor: null,
            imageTimeout: 0,
          });
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, 210, 297);
        }

        const safeName = team.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
        pdf.save(`dossier-${safeName}.pdf`);
      } catch (err) {
        console.error("PDF export failed", err);
      } finally {
        setExporting(false);
        setImgMapReady(false);
        setImgMap({});
        captureRef.current = false;
      }
    })();
  }, [imgMapReady, exporting, sistemasChunks.length, team.name]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    captureRef.current = false;

    // Collect all image URLs
    const imageUrls: (string | null | undefined)[] = [
      team.logoUrl,
      ...playersWithStats.map((p) => p.photoUrl),
      ...sistemas
        .map((s) => s.url)
        .filter((u) => u && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(u)),
    ];

    const map = await preloadImgMap(imageUrls);
    setImgMap(map);
    // Small delay so React re-renders the off-screen pages with base64 images
    setTimeout(() => setImgMapReady(true), 150);
  }, [team.logoUrl, playersWithStats, sistemas]);

  return (
    <>
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

      {/* ── Off-screen A4 pages — only mounted when exporting ───────────────── */}
      {exporting && (
        <div style={{ position: "fixed", left: -9999, top: 0, zIndex: -1, pointerEvents: "none" }}>
          <div ref={coverRef} style={{ width: W, height: H }}>
            <CoverPage team={team} season={season} imgMap={imgMap} />
          </div>
          <div ref={plantillaRef} style={{ width: W, height: H }}>
            <PlantillaPage team={team} players={playersWithStats} season={season} imgMap={imgMap} />
          </div>
          <div ref={statsRef} style={{ width: W, height: H }}>
            <StatsPage team={team} players={playersWithStats} season={season} imgMap={imgMap} />
          </div>
          {sistemasChunks.map((chunk, idx) => (
            <div key={idx} ref={(el) => { sisRefs.current[idx] = el; }} style={{ width: W, height: H }}>
              <SistemasPage team={team} sistemas={chunk} season={season} pageNum={4 + idx} imgMap={imgMap} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
