/**
 * ScoutingReportPdf — FastScout-style individual player dossier.
 *
 * Pages (captured by html2canvas-pro via use-export-pdf-pages hook):
 *   1. Portada   — dark premium cover, left importance stripe, player data
 *   2. Stats     — white, compact dark header, stat table + skill bars
 *   3. Análisis  — white, compact dark header, strengths/weaknesses + conclusion
 *
 * Design tokens mirror the FastScout palette from team-report-pdf.tsx.
 */

import React from "react";
import type { Report, Player, Game } from "@workspace/api-client-react";

export type ScoutingNotes = {
  clavesPartido?: string;
  sistemas?: string;
  ritmo?: string;
  tipoDefensa?: string;
  fortalezas?: string[];
  debilidades?: string[];
  objetivos?: string;
  notasEntrenador?: string;
};

const PAGE_W = 794;
const PAGE_H = 1123;

// ─── Design tokens (FastScout palette) ────────────────────────────────────────

const C = {
  dark:      "#0F172A",
  dark2:     "#1e293b",
  mid:       "#475569",
  midLight:  "#94a3b8",
  accent:    "#f97316",
  accentL:   "#fff7ed",
  white:     "#ffffff",
  rowAlt:    "#F8FAFC",
  border:    "#E2E8F0",
  hdrBg:     "#F1F5F9",
  impRed:    "#EF4444",   // Clave
  impAmb:    "#F59E0B",   // Medio
  impGrn:    "#22C55E",   // Normal
  pctGrn:    "#16A34A",   // ≥50%
  pctRed:    "#DC2626",   // <35%
  green:     "#16a34a",
  greenBg:   "#f0fdf4",
  red:       "#dc2626",
  redBg:     "#fef2f2",
  textDark:  "#111827",
  textMuted: "#6b7280",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(v: number | null | undefined): string {
  return v != null ? String(v) : "—";
}

function pct(made: number | null | undefined, attempted: number | null | undefined): string | null {
  if (!attempted || attempted === 0) return null;
  return `${(((made || 0) / attempted) * 100).toFixed(1)}%`;
}

function pctRaw(made: number | null | undefined, attempted: number | null | undefined): number | null {
  if (!attempted || attempted === 0) return null;
  return (made || 0) / attempted;
}

function pctColor(ratio: number | null): string {
  if (ratio == null) return C.mid;
  if (ratio >= 0.50) return C.pctGrn;
  if (ratio < 0.35) return C.pctRed;
  return C.textDark;
}

function impColor(imp: string | null): string {
  if (imp === "clave")  return C.impRed;
  if (imp === "medio")  return C.impAmb;
  if (imp === "normal") return C.impGrn;
  return C.accent;
}

function impLabel(imp: string | null): string {
  if (imp === "clave")  return "Clave";
  if (imp === "medio")  return "Medio";
  if (imp === "normal") return "Normal";
  return "";
}

function getImportancia(playerId: number | null | undefined): "clave" | "medio" | "normal" | null {
  if (!playerId) return null;
  try {
    const raw = localStorage.getItem(`sp-profile-${playerId}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const imp = p.importancia;
    if (imp === "clave" || imp === "medio" || imp === "normal") return imp;
    return null;
  } catch { return null; }
}

function barColor(value: number): string {
  if (value >= 8) return "#16a34a";
  if (value >= 6) return "#22c55e";
  if (value >= 5) return "#f59e0b";
  if (value >= 3) return "#f97316";
  return "#ef4444";
}

function generateAIInsights(report: Report, player?: Player): string[] {
  const insights: string[] = [];
  const fgPctR = pctRaw(report.fieldGoalsMade, report.fieldGoalsAttempted);
  const tpPctR = pctRaw(report.threesMade, report.threesAttempted);

  if (fgPctR !== null && fgPctR >= 0.55)
    insights.push(`Anotadora muy eficiente (${(fgPctR * 100).toFixed(0)}% TC). Difícil de frenar cuando recibe con espacio.`);
  else if (fgPctR !== null && fgPctR < 0.35 && (report.fieldGoalsAttempted ?? 0) >= 5)
    insights.push(`Bajo porcentaje de campo (${(fgPctR * 100).toFixed(0)}%). Ceder tiros estáticos sin presión.`);

  if (tpPctR !== null && tpPctR >= 0.40 && (report.threesAttempted ?? 0) >= 3)
    insights.push(`Especialista exterior de élite (${(tpPctR * 100).toFixed(0)}% T3). Cierre urgente en toda acción sin balón.`);
  else if (tpPctR !== null && tpPctR < 0.28 && (report.threesAttempted ?? 0) >= 4)
    insights.push(`Sin amenaza real desde el perímetro (${(tpPctR * 100).toFixed(0)}% T3). Defensa hundida recomendada.`);

  if ((report.assists ?? 0) >= 7)
    insights.push(`Organizadora dominante (${report.assists} AST). Presión alta sobre balón puede generar pérdidas forzadas.`);
  else if ((report.assists ?? 0) >= 4)
    insights.push("Buena visión de pase. Anticipar líneas interiores y pase al poste bajo.");

  if ((report.blocks ?? 0) >= 2)
    insights.push(`Referente defensiva en el área (${report.blocks} tapones). Limitar penetraciones directas al aro.`);
  if ((report.steals ?? 0) >= 3)
    insights.push(`Alta actividad defensiva (${report.steals} robos). Cuidado con pases al lado débil.`);
  if ((report.turnovers ?? 0) >= 4)
    insights.push(`Tasa de pérdidas elevada (${report.turnovers} PÉR). Presión sostenida sobre balón recomendada.`);
  if ((report.points ?? 0) >= 25)
    insights.push(`Anotadora dominante (${report.points} PTS). Atención especial en situaciones de aislamiento.`);
  if ((report.rebounds ?? 0) >= 10)
    insights.push(`Reboteadora dominante (${report.rebounds} REB). Obligatorio bloquear salida en todos los lanzamientos.`);
  if (player?.handedness === "Izquierda")
    insights.push("Jugadora zurda. La mayoría de ataques se dirigen al carril izquierdo — ajustar posicionamiento.");

  return insights.slice(0, 3);
}

// ─── Shared sub-components ────────────────────────────────────────────────────

/** FastScout section title: 3px orange left bar + tinted bg strip */
function SectionTitle({ children, accent = C.accent }: { children: React.ReactNode; accent?: string }) {
  const tinted = accent === C.accent
    ? "#fff3e8"   // orange 5% tint
    : "#f0fdf4";  // green tint fallback
  return (
    <div style={{ display: "flex", alignItems: "stretch", marginBottom: 10 }}>
      <div style={{ width: 3, background: accent, flexShrink: 0, borderRadius: "2px 0 0 2px" }} />
      <div style={{
        flex: 1, background: tinted,
        padding: "5px 10px",
        display: "flex", alignItems: "center",
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: C.dark,
          textTransform: "uppercase" as const, letterSpacing: "0.1em",
        }}>
          {children}
        </span>
      </div>
    </div>
  );
}

/** Compact dark header for inner pages */
function PageHeader({
  playerName, position, teamName, page, total, photoUrl,
}: {
  playerName: string; position: string; teamName?: string | null;
  page: number; total: number; photoUrl?: string | null;
}) {
  const initials = playerName.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      background: C.dark, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 28px",
      height: 52,
    }}>
      {/* Orange top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: C.accent }} />
      {/* Avatar + info */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          overflow: "hidden", background: "#1e293b", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1.5px solid rgba(249,115,22,0.4)",
        }}>
          {photoUrl ? (
            <img src={photoUrl} crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={playerName} />
          ) : (
            <span style={{ fontSize: 10, fontWeight: 900, color: C.accent }}>{initials}</span>
          )}
        </div>
        <div>
          <span style={{ color: C.white, fontWeight: 900, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{playerName}</span>
          {(position || teamName) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              {position && (
                <span style={{
                  background: C.accentL, color: C.accent,
                  fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                }}>
                  {position}
                </span>
              )}
              {teamName && (
                <span style={{ fontSize: 9, color: C.midLight }}>{teamName}</span>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Right: type + page */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: C.midLight, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>INFORME DE SCOUTING</span>
        <div style={{
          background: C.accent, color: C.white,
          fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 4,
          letterSpacing: "0.04em",
        }}>
          PÁG. {page}/{total}
        </div>
      </div>
    </div>
  );
}

/** FastScout footer: "ScoutPro · [name]" left, "Pág. X/3" right */
function PageFooter({ playerName, page, total }: { playerName: string; page: number; total: number }) {
  return (
    <div style={{
      flexShrink: 0, borderTop: `1px solid ${C.border}`,
      padding: "8px 28px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontWeight: 900, fontSize: 10, color: C.accent }}>ScoutPro</span>
        <span style={{ fontSize: 10, color: C.mid }}>· {playerName}</span>
      </div>
      <span style={{ fontSize: 10, color: C.mid }}>Pág. {page}/{total}</span>
    </div>
  );
}

/** Skill bar with rounded corners, color by value */
function SkillBar({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  const color = barColor(value);
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{
          fontSize: 10, color: C.mid, textTransform: "uppercase" as const,
          letterSpacing: "0.06em", fontWeight: 600,
        }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 900, color }}>{value}<span style={{ fontSize: 9, color: C.mid, fontWeight: 400 }}>/10</span></span>
      </div>
      <div style={{ height: 7, background: C.hdrBg, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value * 10}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

// ─── Page 1: Cover ────────────────────────────────────────────────────────────

function proxyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url;
}

function CoverPage({ report, player, game, importancia, teamLogoUrl, pageRef }: {
  report: Report; player?: Player; game?: Game;
  importancia: "clave" | "medio" | "normal" | null;
  teamLogoUrl?: string | null;
  pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const playerName = (player?.name || report.playerName || "").trim();
  const initial = playerName.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const imp = importancia;
  const stripeColor = imp ? impColor(imp) : C.accent;

  const ratingLabel = report.rating >= 8
    ? "Nivel Élite" : report.rating >= 6
    ? "Buen Nivel" : report.rating >= 4
    ? "Nivel Medio" : "A Desarrollar";

  const today = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div ref={pageRef} style={{
      width: PAGE_W, height: PAGE_H,
      background: C.dark,
      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      display: "flex", overflow: "hidden",
    }}>
      {/* Left importance stripe */}
      <div style={{
        width: 8, flexShrink: 0, background: stripeColor,
      }} />

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        {/* Subtle decorative orbs */}
        <div style={{ position: "absolute", top: -120, right: -120, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.10) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 60, left: -80, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.05) 0%,transparent 70%)", pointerEvents: "none" }} />

        {/* Header bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "22px 36px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0, position: "relative", zIndex: 1,
        }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, background: C.accent, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 13, fontFamily: "monospace" }}>SP</span>
            </div>
            <span style={{ color: "white", fontWeight: 900, fontSize: 15, letterSpacing: "-0.01em" }}>
              Scout<span style={{ color: C.accent }}>Pro</span>
            </span>
            {teamLogoUrl && (
              <>
                <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.15)", marginLeft: 4 }} />
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", flexShrink: 0,
                }}>
                  <img
                    src={teamLogoUrl}
                    crossOrigin="anonymous"
                    alt="Team logo"
                    style={{ width: 34, height: 34, objectFit: "contain" }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Right meta */}
          <div style={{ textAlign: "right" as const }}>
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase" as const, marginBottom: 2 }}>
              INFORME INDIVIDUAL DE SCOUTING
            </div>
            <div style={{ color: "rgba(255,255,255,0.16)", fontSize: 8 }}>{today}</div>
          </div>
        </div>

        {/* Importance badge (if set) */}
        {imp && (
          <div style={{
            position: "absolute", top: 72, right: 36,
            display: "flex", alignItems: "center", gap: 6,
            background: `${stripeColor}22`,
            border: `1px solid ${stripeColor}55`,
            borderRadius: 999, padding: "4px 12px",
            zIndex: 2,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: stripeColor }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: stripeColor, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
              {impLabel(imp)}
            </span>
          </div>
        )}

        {/* Central hero */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "20px 36px 0",
          position: "relative", zIndex: 1,
        }}>
          {/* Player photo */}
          <div style={{ position: "relative", marginBottom: 26 }}>
            <div style={{
              width: 188, height: 188, borderRadius: "50%",
              background: "rgba(249,115,22,0.10)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: 168, height: 168, borderRadius: "50%",
                border: `3px solid ${stripeColor}66`,
                overflow: "hidden", background: "#1e2d47",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {player?.photoUrl ? (
                  <img src={player.photoUrl} crossOrigin="anonymous"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={playerName} />
                ) : (
                  <span style={{ fontSize: 54, fontWeight: 900, color: `${stripeColor}66` }}>{initial}</span>
                )}
              </div>
            </div>
            {player?.jerseyNumber != null && (
              <div style={{
                position: "absolute", bottom: 6, right: 6,
                width: 36, height: 36, background: stripeColor, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #060d1a",
              }}>
                <span style={{ color: "white", fontWeight: 900, fontSize: 12 }}>#{player.jerseyNumber}</span>
              </div>
            )}
          </div>

          {/* Name */}
          <h1 style={{
            color: "white", fontSize: playerName.length > 20 ? 38 : 50,
            fontWeight: 900, letterSpacing: "-0.03em",
            margin: "0 0 14px", lineHeight: 1,
            textTransform: "uppercase" as const, textAlign: "center" as const,
          }}>
            {playerName}
          </h1>

          {/* Tags */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            flexWrap: "wrap" as const, justifyContent: "center", marginBottom: 28,
          }}>
            <span style={{
              background: stripeColor, color: "white",
              padding: "4px 14px", borderRadius: 999,
              fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const,
            }}>
              {player?.position || "—"}
            </span>
            {player?.teamName && (
              <span style={{
                border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.72)",
                padding: "4px 14px", borderRadius: 999, fontSize: 11,
              }}>{player.teamName}</span>
            )}
            {player?.age != null && (
              <span style={{
                border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.4)",
                padding: "4px 12px", borderRadius: 999, fontSize: 11,
              }}>{player.age} años</span>
            )}
            {player?.nationality && (
              <span style={{
                border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.4)",
                padding: "4px 12px", borderRadius: 999, fontSize: 11,
              }}>{player.nationality}</span>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 48, height: 2, background: `${stripeColor}55`, marginBottom: 28 }} />

          {/* Rating + Game card */}
          <div style={{
            display: "flex", alignItems: "stretch", gap: 0,
            width: "100%", maxWidth: 580,
          }}>
            {/* Rating box */}
            <div style={{
              flex: "0 0 150px",
              background: `${stripeColor}18`,
              border: `1px solid ${stripeColor}33`,
              borderRadius: "12px 0 0 12px",
              padding: "20px 14px",
              textAlign: "center" as const,
              display: "flex", flexDirection: "column" as const,
              alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 6 }}>VALORACIÓN</div>
              <div style={{ fontSize: 64, fontWeight: 900, color: stripeColor, lineHeight: 1 }}>{report.rating}</div>
              <div style={{ color: "rgba(255,255,255,0.22)", fontSize: 11, marginTop: 2 }}>/10</div>
              <div style={{
                marginTop: 8, background: `${stripeColor}22`,
                borderRadius: 999, padding: "3px 10px",
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: stripeColor }}>{ratingLabel}</span>
              </div>
            </div>

            {/* Game / Report info */}
            <div style={{
              flex: 1,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderLeft: "none",
              borderRadius: "0 12px 12px 0",
              padding: "20px 22px",
              display: "flex", flexDirection: "column" as const,
              justifyContent: "center", gap: 6,
            }}>
              {game ? (
                <>
                  <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 2 }}>PARTIDO ANALIZADO</div>
                  <div style={{ color: "white", fontSize: 13, fontWeight: 700 }}>{game.homeTeam} vs {game.awayTeam}</div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>📅 {game.date}</div>
                  {game.location && <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>📍 {game.location}</div>}
                  {game.homeScore != null && game.awayScore != null && (
                    <div style={{ color: stripeColor, fontSize: 14, fontWeight: 800, marginTop: 2 }}>
                      {game.homeScore} — {game.awayScore}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 2 }}>TIPO DE INFORME</div>
                  <div style={{ color: "white", fontSize: 13 }}>Scouting general</div>
                </>
              )}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>ANALIZADO POR</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 600, marginTop: 3 }}>{report.scoutName}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg,${stripeColor},transparent)`, flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ─── Page 2: Stats ────────────────────────────────────────────────────────────

interface StatRowProps {
  label: string;
  value: string;
  subValue?: string;
  pctRatio?: number | null;
  even?: boolean;
  highlight?: boolean;
}

function StatRow({ label, value, subValue, pctRatio, even, highlight }: StatRowProps) {
  const textColor = pctRatio != null ? pctColor(pctRatio) : (highlight ? C.accent : C.textDark);
  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: "7px 10px",
      background: even ? C.rowAlt : C.white,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ flex: 1, fontSize: 11, color: C.mid, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {subValue && (
          <span style={{ fontSize: 10, color: C.mid }}>{subValue}</span>
        )}
        <span style={{
          fontSize: 13, fontWeight: 900, color: textColor,
          minWidth: 40, textAlign: "right" as const,
        }}>{value}</span>
      </div>
    </div>
  );
}

function StatsPage({ report, player, importancia, pageRef }: {
  report: Report; player?: Player;
  importancia: "clave" | "medio" | "normal" | null;
  pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const insights = generateAIInsights(report, player);
  const playerName = (player?.name || report.playerName || "").trim();
  const stripeColor = importancia ? impColor(importancia) : C.accent;

  const fgPctR = pctRaw(report.fieldGoalsMade, report.fieldGoalsAttempted);
  const tpPctR = pctRaw(report.threesMade, report.threesAttempted);
  const ftPctR = pctRaw(report.freeThrowsMade, report.freeThrowsAttempted);
  const fgStr = pct(report.fieldGoalsMade, report.fieldGoalsAttempted);
  const tpStr = pct(report.threesMade, report.threesAttempted);
  const ftStr = pct(report.freeThrowsMade, report.freeThrowsAttempted);
  const eFGRaw = report.fieldGoalsAttempted && report.fieldGoalsAttempted > 0
    ? ((report.fieldGoalsMade || 0) + 0.5 * (report.threesMade || 0)) / report.fieldGoalsAttempted
    : null;
  const eFGStr = eFGRaw != null ? `${(eFGRaw * 100).toFixed(1)}%` : null;

  const hasRatings = report.offensiveRating != null || report.defensiveRating != null ||
    report.athleticismRating != null || report.iQRating != null;

  return (
    <div ref={pageRef} style={{
      width: PAGE_W, height: PAGE_H, background: C.white,
      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
      position: "relative",
    }}>
      {/* 2px orange top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: stripeColor, zIndex: 1 }} />

      <PageHeader
        playerName={playerName} position={player?.position || ""}
        teamName={player?.teamName} page={2} total={3}
        photoUrl={player?.photoUrl}
      />

      <div style={{ flex: 1, padding: "20px 26px", display: "flex", gap: 20, overflow: "hidden" }}>

        {/* Left column: ratings + profile + AI */}
        <div style={{ flex: "0 0 290px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Overall rating widget */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px", background: C.rowAlt,
            borderRadius: 10, border: `1px solid ${C.border}`,
          }}>
            <div style={{ flexShrink: 0 }}>
              <svg width={80} height={80} viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="30" fill="none" stroke={C.hdrBg} strokeWidth="7" />
                <circle cx="40" cy="40" r="30" fill="none" stroke={stripeColor} strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 30}`}
                  strokeDashoffset={`${2 * Math.PI * 30 * (1 - report.rating / 10)}`}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
                <text x="40" y="40" textAnchor="middle" dy="0.35em"
                  fill={stripeColor} fontSize="20" fontWeight="900" fontFamily="system-ui">{report.rating}</text>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.mid, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 3 }}>Valoración Global</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.textDark, lineHeight: 1 }}>
                {report.rating}<span style={{ fontSize: 13, color: C.mid, fontWeight: 400 }}>/10</span>
              </div>
              {importancia && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  marginTop: 6, background: `${stripeColor}15`,
                  borderRadius: 999, padding: "2px 10px",
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: stripeColor }} />
                  <span style={{ fontSize: 9, fontWeight: 800, color: stripeColor, textTransform: "uppercase" as const }}>
                    {impLabel(importancia)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Skill bars */}
          {hasRatings && (
            <div>
              <SectionTitle>Valoraciones</SectionTitle>
              <div style={{ padding: "2px 0 4px" }}>
                <SkillBar label="Ataque" value={report.offensiveRating} />
                <SkillBar label="Defensa" value={report.defensiveRating} />
                <SkillBar label="Atletismo" value={report.athleticismRating} />
                <SkillBar label="Basketball IQ" value={report.iQRating} />
              </div>
            </div>
          )}

          {/* Player profile */}
          {player && (
            <div>
              <SectionTitle>Perfil Jugadora</SectionTitle>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "4px 12px", padding: "4px 0",
              }}>
                {player.height && (
                  <div style={{ fontSize: 11, color: C.textDark }}>
                    <span style={{ color: C.mid }}>Altura: </span>{player.height}
                  </div>
                )}
                {player.weight != null && (
                  <div style={{ fontSize: 11, color: C.textDark }}>
                    <span style={{ color: C.mid }}>Peso: </span>{player.weight} kg
                  </div>
                )}
                {player.handedness && (
                  <div style={{ fontSize: 11, color: C.textDark }}>
                    <span style={{ color: C.mid }}>Mano: </span>{player.handedness}
                  </div>
                )}
                {player.nationality && (
                  <div style={{ fontSize: 11, color: C.textDark }}>
                    <span style={{ color: C.mid }}>Nación: </span>{player.nationality}
                  </div>
                )}
                {player.jerseyNumber != null && (
                  <div style={{ fontSize: 11, color: C.textDark }}>
                    <span style={{ color: C.mid }}>Dorsal: </span>#{player.jerseyNumber}
                  </div>
                )}
                {player.age != null && (
                  <div style={{ fontSize: 11, color: C.textDark }}>
                    <span style={{ color: C.mid }}>Edad: </span>{player.age} años
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Insights */}
          {insights.length > 0 && (
            <div style={{ marginTop: "auto" }}>
              <SectionTitle>Observaciones IA</SectionTitle>
              <div style={{
                background: "linear-gradient(135deg,#1e1b4b,#1e3a5f)",
                borderRadius: 10, padding: "13px",
                border: "1px solid rgba(249,115,22,0.2)",
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {insights.map((insight, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: stripeColor, marginTop: 6, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.5 }}>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: stats table */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <SectionTitle>Estadísticas del Partido</SectionTitle>

            {/* Table header */}
            <div style={{
              display: "flex", alignItems: "center",
              padding: "6px 10px",
              background: C.hdrBg,
              borderBottom: `2px solid ${C.border}`,
            }}>
              <span style={{ flex: 1, fontSize: 9, fontWeight: 800, color: C.mid, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>ESTADÍSTICA</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: C.mid, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>VALOR</span>
            </div>

            {/* Stat rows */}
            <StatRow label="Puntos" value={n(report.points)} even={false} highlight={true} />
            <StatRow label="Rebotes" value={n(report.rebounds)} even={true} />
            <StatRow
              label="Rebotes Ofensivos / Defensivos"
              value={`${n(report.offensiveRebounds)} / ${n(report.defensiveRebounds)}`}
              even={false}
            />
            <StatRow label="Asistencias" value={n(report.assists)} even={true} />
            <StatRow label="Robos" value={n(report.steals)} even={false} />
            <StatRow label="Tapones" value={n(report.blocks)} even={true} />
            <StatRow label="Pérdidas" value={n(report.turnovers)} even={false} />
            <StatRow label="Minutos Jugados" value={n(report.minutesPlayed)} even={true} />
          </div>

          {/* Shooting efficiency */}
          <div>
            <SectionTitle>Eficiencia Anotadora</SectionTitle>

            {/* Table header */}
            <div style={{
              display: "flex", alignItems: "center",
              padding: "6px 10px",
              background: C.hdrBg,
              borderBottom: `2px solid ${C.border}`,
            }}>
              <span style={{ flex: 1, fontSize: 9, fontWeight: 800, color: C.mid, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>TIPO</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: C.mid, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>M/I</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: C.mid, textTransform: "uppercase" as const, letterSpacing: "0.08em", minWidth: 50, textAlign: "right" as const }}>%</span>
            </div>

            {report.fieldGoalsAttempted != null ? (
              <>
                <div style={{
                  display: "flex", alignItems: "center",
                  padding: "7px 10px", background: C.white,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={{ flex: 1, fontSize: 11, color: C.mid, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Tiros de Campo</span>
                  <span style={{ fontSize: 10, color: C.mid, marginRight: 8 }}>{report.fieldGoalsMade ?? 0}/{report.fieldGoalsAttempted}</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: pctColor(fgPctR), minWidth: 50, textAlign: "right" as const }}>{fgStr ?? "—"}</span>
                </div>
                {report.threesAttempted != null && (
                  <div style={{
                    display: "flex", alignItems: "center",
                    padding: "7px 10px", background: C.rowAlt,
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    <span style={{ flex: 1, fontSize: 11, color: C.mid, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Triples</span>
                    <span style={{ fontSize: 10, color: C.mid, marginRight: 8 }}>{report.threesMade ?? 0}/{report.threesAttempted}</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: pctColor(tpPctR), minWidth: 50, textAlign: "right" as const }}>{tpStr ?? "—"}</span>
                  </div>
                )}
                {report.freeThrowsAttempted != null && (
                  <div style={{
                    display: "flex", alignItems: "center",
                    padding: "7px 10px", background: C.white,
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    <span style={{ flex: 1, fontSize: 11, color: C.mid, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Tiros Libres</span>
                    <span style={{ fontSize: 10, color: C.mid, marginRight: 8 }}>{report.freeThrowsMade ?? 0}/{report.freeThrowsAttempted}</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: pctColor(ftPctR), minWidth: 50, textAlign: "right" as const }}>{ftStr ?? "—"}</span>
                  </div>
                )}
                {eFGStr && (
                  <div style={{
                    display: "flex", alignItems: "center",
                    padding: "7px 10px", background: C.rowAlt,
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    <span style={{ flex: 1, fontSize: 11, color: C.mid, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>eFG% (ajustado)</span>
                    <span style={{ fontSize: 10, color: C.mid, marginRight: 8 }}>—</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: pctColor(eFGRaw), minWidth: 50, textAlign: "right" as const }}>{eFGStr}</span>
                  </div>
                )}
                {/* Legend */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "5px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: C.pctGrn }} />
                    <span style={{ fontSize: 9, color: C.mid }}>≥50% eficiencia alta</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: C.pctRed }} />
                    <span style={{ fontSize: 9, color: C.mid }}>&lt;35% baja eficiencia</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: "12px 10px", color: C.mid, fontSize: 12, fontStyle: "italic" }}>
                Sin datos de tiro registrados
              </div>
            )}
          </div>

          {/* Context */}
          <div style={{ marginTop: "auto" }}>
            <SectionTitle>Contexto del Análisis</SectionTitle>
            <div style={{
              background: C.rowAlt, borderRadius: 8, padding: "10px 12px",
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ fontSize: 11, color: C.textDark }}>
                  <span style={{ color: C.mid, fontWeight: 600 }}>Scout: </span>{report.scoutName}
                </div>
                {report.date && (
                  <div style={{ fontSize: 11, color: C.textDark }}>
                    <span style={{ color: C.mid, fontWeight: 600 }}>Fecha: </span>{report.date}
                  </div>
                )}
                {player?.teamName && (
                  <div style={{ fontSize: 11, color: C.textDark }}>
                    <span style={{ color: C.mid, fontWeight: 600 }}>Club: </span>{player.teamName}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PageFooter playerName={playerName} page={2} total={3} />
    </div>
  );
}

// ─── Page 3: Analysis ─────────────────────────────────────────────────────────

function AnalysisPage({ report, player, notes, importancia, pageRef }: {
  report: Report; player?: Player; notes?: ScoutingNotes | null;
  importancia: "clave" | "medio" | "normal" | null;
  pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const playerName = (player?.name || report.playerName || "").trim();
  const stripeColor = importancia ? impColor(importancia) : C.accent;
  const strengthsList = (report.strengths || "").split(/[\n,·]/).map(s => s.trim()).filter(Boolean);
  const weaknessesList = (report.weaknesses || "").split(/[\n,·]/).map(s => s.trim()).filter(Boolean);
  const claves = notes?.clavesPartido || notes?.objetivos || "";
  const defense = notes?.tipoDefensa || "";
  const attack = notes?.sistemas || "";

  const conclusionText = report.rating >= 8
    ? "Jugadora recomendada para seguimiento prioritario. Nivel excelente."
    : report.rating >= 6
    ? "Jugadora interesante. Se recomienda ampliar el análisis en próximos partidos."
    : report.rating >= 4
    ? "Jugadora con potencial a desarrollar. Reevaluar en 2-3 partidos."
    : "Nivel actual por debajo del estándar requerido. No se recomienda seguimiento.";

  return (
    <div ref={pageRef} style={{
      width: PAGE_W, height: PAGE_H, background: C.white,
      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
      position: "relative",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: stripeColor, zIndex: 1 }} />

      <PageHeader
        playerName={playerName} position={player?.position || ""}
        teamName={player?.teamName} page={3} total={3}
        photoUrl={player?.photoUrl}
      />

      <div style={{ flex: 1, padding: "20px 26px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>

        {/* Fortalezas / Debilidades */}
        <div>
          <SectionTitle>Análisis de Scouting</SectionTitle>
          <div style={{ display: "flex", gap: 14 }}>

            {/* Fortalezas */}
            <div style={{
              flex: 1, background: C.greenBg, borderRadius: 10,
              padding: "14px", border: "1px solid #bbf7d0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{ width: 3, height: 14, background: C.green, borderRadius: 2 }} />
                <span style={{
                  fontSize: 10, fontWeight: 800, color: C.green,
                  textTransform: "uppercase" as const, letterSpacing: "0.1em",
                }}>Fortalezas</span>
              </div>
              {strengthsList.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {strengthsList.slice(0, 8).map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: C.green, fontWeight: 900, fontSize: 11, flexShrink: 0, marginTop: 1 }}>+</span>
                      <span style={{ fontSize: 11.5, color: "#166534", lineHeight: 1.45 }}>{s}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>Sin fortalezas registradas</span>
              )}
            </div>

            {/* Debilidades */}
            <div style={{
              flex: 1, background: C.redBg, borderRadius: 10,
              padding: "14px", border: "1px solid #fecaca",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{ width: 3, height: 14, background: C.red, borderRadius: 2 }} />
                <span style={{
                  fontSize: 10, fontWeight: 800, color: C.red,
                  textTransform: "uppercase" as const, letterSpacing: "0.1em",
                }}>Debilidades</span>
              </div>
              {weaknessesList.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {weaknessesList.slice(0, 8).map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: C.red, fontWeight: 900, fontSize: 11, flexShrink: 0, marginTop: 1 }}>−</span>
                      <span style={{ fontSize: 11.5, color: "#7f1d1d", lineHeight: 1.45 }}>{w}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>Sin debilidades registradas</span>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        {report.summary && (
          <div>
            <SectionTitle>Resumen del Scout</SectionTitle>
            <div style={{
              background: C.rowAlt, borderRadius: 8, padding: "14px",
              border: `1px solid ${C.border}`,
            }}>
              <p style={{ fontSize: 12.5, color: C.textDark, lineHeight: 1.65, margin: 0 }}>{report.summary}</p>
            </div>
          </div>
        )}

        {/* Recommendation */}
        {report.recommendation && (
          <div>
            <SectionTitle>Recomendación Final</SectionTitle>
            <div style={{
              background: C.accentL, borderRadius: 8, padding: "14px",
              border: "1px solid #fed7aa",
            }}>
              <p style={{ fontSize: 12.5, color: "#9a3412", lineHeight: 1.55, margin: 0, fontWeight: 600 }}>
                {report.recommendation}
              </p>
            </div>
          </div>
        )}

        {/* Game notes */}
        {(claves || defense || attack) && (
          <div>
            <SectionTitle>Claves del Partido</SectionTitle>
            <div style={{
              background: "#f0f9ff", borderRadius: 8, padding: "14px",
              border: "1px solid #bae6fd",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              {claves && (
                <div>
                  <div style={{ fontSize: 9, color: "#0369a1", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 3 }}>Claves para ganar</div>
                  <p style={{ fontSize: 11.5, color: "#0c4a6e", margin: 0, lineHeight: 1.5 }}>{claves}</p>
                </div>
              )}
              {defense && (
                <div>
                  <div style={{ fontSize: 9, color: "#0369a1", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 3 }}>Defensa rival</div>
                  <p style={{ fontSize: 11.5, color: "#0c4a6e", margin: 0, lineHeight: 1.5 }}>{defense}</p>
                </div>
              )}
              {attack && (
                <div>
                  <div style={{ fontSize: 9, color: "#0369a1", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 3 }}>Sistema ofensivo rival</div>
                  <p style={{ fontSize: 11.5, color: "#0c4a6e", margin: 0, lineHeight: 1.5 }}>{attack}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conclusion bar */}
        <div style={{ marginTop: "auto" }}>
          <div style={{
            background: C.dark, borderRadius: 10, padding: "16px 20px",
            border: `1px solid ${stripeColor}33`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 8, color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 5,
              }}>CONCLUSIÓN SCOUT</div>
              <div style={{ color: "white", fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, maxWidth: 460 }}>
                {conclusionText}
              </div>
            </div>
            <div style={{
              flexShrink: 0, marginLeft: 16, textAlign: "center" as const,
              background: `${stripeColor}18`, border: `1px solid ${stripeColor}33`,
              borderRadius: 8, padding: "8px 18px",
            }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: stripeColor, lineHeight: 1 }}>{report.rating}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginTop: 2 }}>puntos</div>
            </div>
          </div>
        </div>
      </div>

      <PageFooter playerName={playerName} page={3} total={3} />
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

type Props = {
  report: Report;
  player?: Player;
  game?: Game;
  notes?: ScoutingNotes | null;
  page1Ref: React.RefObject<HTMLDivElement | null>;
  page2Ref: React.RefObject<HTMLDivElement | null>;
  page3Ref: React.RefObject<HTMLDivElement | null>;
};

export function ScoutingReportPdf({ report, player, game, notes, page1Ref, page2Ref, page3Ref }: Props) {
  const importancia = getImportancia(player?.id);

  return (
    <div aria-hidden="true" style={{ position: "fixed", left: -9999, top: 0, zIndex: -1, pointerEvents: "none" }}>
      <CoverPage report={report} player={player} game={game} importancia={importancia} teamLogoUrl={proxyUrl(player?.teamLogoUrl)} pageRef={page1Ref} />
      <StatsPage report={report} player={player} importancia={importancia} pageRef={page2Ref} />
      <AnalysisPage report={report} player={player} notes={notes} importancia={importancia} pageRef={page3Ref} />
    </div>
  );
}
