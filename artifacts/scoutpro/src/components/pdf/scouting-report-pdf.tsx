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

const C = {
  primary: "#f97316",
  primaryLight: "#fff7ed",
  dark: "#060d1a",
  dark2: "#0f172a",
  white: "#ffffff",
  textDark: "#111827",
  textMuted: "#6b7280",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  red: "#dc2626",
  redBg: "#fef2f2",
  border: "#e5e7eb",
  indigo: "#6366f1",
  blue: "#0284c7",
};

function generateAIInsights(report: Report, player?: Player): string[] {
  const insights: string[] = [];
  const fga = report.fieldGoalsAttempted;
  const fgm = report.fieldGoalsMade;
  const tpa = report.threesAttempted;
  const tpm = report.threesMade;
  const fta = report.freeThrowsAttempted;
  const ftm = report.freeThrowsMade;
  const pts = report.points;
  const ast = report.assists;
  const reb = report.rebounds;
  const blk = report.blocks;
  const stl = report.steals;
  const tov = report.turnovers;
  const offRtg = report.offensiveRating;
  const defRtg = report.defensiveRating;

  const fgPct = fga && fga > 0 ? (fgm || 0) / fga : null;
  const tpPct = tpa && tpa > 0 ? (tpm || 0) / tpa : null;

  if (fgPct !== null && fgPct >= 0.55) {
    insights.push(`Anotadora muy eficiente (${(fgPct * 100).toFixed(0)}% TC). Difícil de frenar cuando recibe con espacio.`);
  } else if (fgPct !== null && fgPct < 0.35 && fga && fga >= 5) {
    insights.push(`Bajo porcentaje de campo (${(fgPct * 100).toFixed(0)}%). Ceder tiros estáticos sin presión.`);
  }

  if (tpPct !== null && tpPct >= 0.40 && tpa && tpa >= 3) {
    insights.push(`Especialista exterior de élite (${(tpPct * 100).toFixed(0)}% T3). Cierre urgente en toda acción sin balón.`);
  } else if (tpPct !== null && tpPct < 0.28 && tpa && tpa >= 4) {
    insights.push(`Sin amenaza real desde el perímetro (${(tpPct * 100).toFixed(0)}% T3). Defensa hundida recomendada.`);
  }

  if (ast && ast >= 7) {
    insights.push(`Organizadora dominante (${ast} AST). Presión alta sobre balón puede generar pérdidas forzadas.`);
  } else if (ast && ast >= 4) {
    insights.push(`Buena visión de pase. Anticipar líneas interiores y pase al poste bajo.`);
  }

  if (blk && blk >= 2) {
    insights.push(`Referente defensiva en el área (${blk} tapones). Limitar penetraciones directas al aro.`);
  }

  if (stl && stl >= 3) {
    insights.push(`Alta actividad defensiva (${stl} robos). Cuidado con pases al lado débil.`);
  }

  if (tov && tov >= 4) {
    insights.push(`Tasa de pérdidas elevada (${tov} PÉR). Presión sostenida sobre balón recomendada.`);
  }

  if (pts && pts >= 25) {
    insights.push(`Anotadora dominante (${pts} PTS). Atención especial en situaciones de aislamiento.`);
  }

  if (reb && reb >= 10) {
    insights.push(`Reboteadora dominante (${reb} REB). Obligatorio bloquear salida en todos los lanzamientos.`);
  }

  if (player?.handedness === "Izquierda") {
    insights.push(`Jugadora zurda. La mayoría de ataques se dirigen al carril izquierdo — ajustar posicionamiento.`);
  }

  if (offRtg && offRtg >= 8 && defRtg != null && defRtg <= 3) {
    insights.push(`Perfil exclusivamente ofensivo. Atacar sistemáticamente su lado en defensa.`);
  }

  return insights.slice(0, 3);
}

function n(v: number | null | undefined): string {
  return v != null ? String(v) : "—";
}

function pct(made: number | null | undefined, attempted: number | null | undefined): string | null {
  if (!attempted || attempted === 0) return null;
  return `${(((made || 0) / attempted) * 100).toFixed(1)}%`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, borderBottom: `2px solid ${C.primary}`, marginBottom: 2 }}>
      <div style={{ width: 3, height: 16, background: C.primary, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 800, color: C.textDark, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>
        {children}
      </span>
    </div>
  );
}

function RatingBar({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  const colorMap: Record<number, string> = {
    1: "#ef4444", 2: "#f97316", 3: "#f97316", 4: "#f59e0b",
    5: "#eab308", 6: "#84cc16", 7: "#22c55e", 8: "#16a34a",
    9: "#15803d", 10: "#166534",
  };
  const barColor = colorMap[Math.round(value)] || C.primary;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.06em", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: barColor }}>{value}/10</span>
      </div>
      <div style={{ height: 6, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value * 10}%`, background: barColor, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function StatBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? C.primaryLight : "#f9fafb",
      border: `1px solid ${highlight ? "#fed7aa" : C.border}`,
      borderRadius: 8, padding: "10px 6px", textAlign: "center" as const,
      display: "flex", flexDirection: "column" as const, gap: 2,
    }}>
      <span style={{ fontSize: 18, fontWeight: 900, color: highlight ? C.primary : C.textDark, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700 }}>{label}</span>
    </div>
  );
}

function PageHeader({ playerName, position, teamName, page, total }: {
  playerName: string; position: string; teamName?: string | null; page: number; total: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 32px", background: C.primary, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: C.white, fontWeight: 900, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{playerName}</span>
        <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 4, padding: "2px 8px", color: C.white, fontSize: 11, fontWeight: 700 }}>{position}</span>
        {teamName && <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>· {teamName}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: "0.06em" }}>INFORME DE SCOUTING</span>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>·</span>
        <span style={{ color: C.white, fontSize: 10, fontWeight: 700 }}>{page}/{total}</span>
      </div>
    </div>
  );
}

function PageFooter({ scoutName, date }: { scoutName: string; date?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 32px", borderTop: `1px solid ${C.border}`, flexShrink: 0, marginTop: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: C.primary, fontWeight: 900, fontSize: 11, letterSpacing: "0.04em" }}>SCOUT</span>
        <span style={{ color: C.textMuted, fontSize: 11 }}>FLOW</span>
        <span style={{ color: C.border, fontSize: 11 }}>|</span>
        <span style={{ color: C.textMuted, fontSize: 10 }}>Generado por {scoutName}</span>
        {date && <><span style={{ color: C.border, fontSize: 10 }}>·</span><span style={{ color: C.textMuted, fontSize: 10 }}>{date}</span></>}
      </div>
      <span style={{ color: "#d1d5db", fontSize: 10 }}>Uso confidencial · scoutflow.app</span>
    </div>
  );
}

function CoverPage({ report, player, game, pageRef }: {
  report: Report; player?: Player; game?: Game; pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const playerName = (player?.name || report.playerName || "").trim();
  const initial = playerName.charAt(0).toUpperCase();

  return (
    <div ref={pageRef} style={{
      width: PAGE_W, height: PAGE_H,
      background: "linear-gradient(150deg, #060d1a 0%, #0f172a 45%, #1a1035 100%)",
      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ position: "absolute", top: -100, right: -100, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.13) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 80, left: -60, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "30%", right: 44, width: 1, height: 420, background: "linear-gradient(180deg,transparent,rgba(249,115,22,0.25),transparent)", pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 40px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: C.primary, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontWeight: 900, fontSize: 15, fontFamily: "monospace" }}>SF</span>
          </div>
          <div>
            <span style={{ color: "white", fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em" }}>SCOUT</span>
            <span style={{ color: C.primary, fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em" }}>FLOW</span>
          </div>
        </div>
        <div style={{ textAlign: "right" as const }}>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" as const, marginBottom: 3 }}>INFORME DE SCOUTING PROFESIONAL</div>
          <div style={{ color: "rgba(255,255,255,0.18)", fontSize: 9 }}>{new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 40px" }}>

        <div style={{ position: "relative", marginBottom: 30 }}>
          <div style={{ width: 196, height: 196, borderRadius: "50%", background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 174, height: 174, borderRadius: "50%", border: "3px solid rgba(249,115,22,0.45)", overflow: "hidden", background: "#1e2d47", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {player?.photoUrl ? (
                <img src={player.photoUrl} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={playerName} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#1e3a5f,#1a1035)" }}>
                  <span style={{ fontSize: 58, fontWeight: 900, color: "rgba(249,115,22,0.45)" }}>{initial}</span>
                </div>
              )}
            </div>
          </div>
          {player?.jerseyNumber != null && (
            <div style={{ position: "absolute", bottom: 8, right: 8, width: 38, height: 38, background: C.primary, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #060d1a" }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 13 }}>#{player.jerseyNumber}</span>
            </div>
          )}
        </div>

        <h1 style={{ color: "white", fontSize: player && playerName.length > 18 ? 40 : 52, fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 16px", lineHeight: 1, textTransform: "uppercase" as const, textAlign: "center" as const }}>
          {playerName}
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, justifyContent: "center", marginBottom: 36 }}>
          <span style={{ background: C.primary, color: "white", padding: "5px 16px", borderRadius: 999, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            {player?.position || "—"}
          </span>
          {player?.teamName && <span style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)", padding: "5px 16px", borderRadius: 999, fontSize: 12 }}>{player.teamName}</span>}
          {player?.age != null && <span style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", padding: "5px 14px", borderRadius: 999, fontSize: 12 }}>{player.age} años</span>}
          {player?.nationality && <span style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", padding: "5px 14px", borderRadius: 999, fontSize: 12 }}>{player.nationality}</span>}
        </div>

        <div style={{ width: 56, height: 2, background: "rgba(249,115,22,0.4)", marginBottom: 36 }} />

        <div style={{ display: "flex", alignItems: "stretch", gap: 0, width: "100%", maxWidth: 600 }}>
          <div style={{ flex: "0 0 160px", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: "14px 0 0 14px", padding: "22px 16px", textAlign: "center" as const, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 8 }}>VALORACIÓN</div>
            <div style={{ fontSize: 70, fontWeight: 900, color: C.primary, lineHeight: 1 }}>{report.rating}</div>
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 2 }}>/10</div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderLeft: "none", borderRadius: "0 14px 14px 0", padding: "22px 26px", display: "flex", flexDirection: "column" as const, justifyContent: "center", gap: 8 }}>
            {game ? (
              <>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 4 }}>PARTIDO ANALIZADO</div>
                <div style={{ color: "white", fontSize: 14, fontWeight: 700 }}>{game.homeTeam} vs {game.awayTeam}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>📅 {game.date}</div>
                {game.location && <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>📍 {game.location}</div>}
                {game.homeScore != null && game.awayScore != null && (
                  <div style={{ color: C.primary, fontSize: 15, fontWeight: 800, marginTop: 2 }}>{game.homeScore} — {game.awayScore}</div>
                )}
              </>
            ) : (
              <>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 4 }}>TIPO DE INFORME</div>
                <div style={{ color: "white", fontSize: 13 }}>Scouting general</div>
              </>
            )}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>ANALIZADO POR</div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 600, marginTop: 3 }}>{report.scoutName}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 4, background: `linear-gradient(90deg,${C.primary},transparent)`, flexShrink: 0 }} />
    </div>
  );
}

function StatsPage({ report, player, pageRef }: {
  report: Report; player?: Player; pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const insights = generateAIInsights(report, player);
  const fgPct = pct(report.fieldGoalsMade, report.fieldGoalsAttempted);
  const tpPct = pct(report.threesMade, report.threesAttempted);
  const ftPct = pct(report.freeThrowsMade, report.freeThrowsAttempted);
  const eFG = report.fieldGoalsAttempted && report.fieldGoalsAttempted > 0
    ? `${(((report.fieldGoalsMade || 0) + 0.5 * (report.threesMade || 0)) / report.fieldGoalsAttempted * 100).toFixed(1)}%`
    : null;
  const playerName = (player?.name || report.playerName || "").trim();
  const ratingLabel = report.rating >= 8 ? "🏆 Élite" : report.rating >= 6 ? "⭐ Buen nivel" : report.rating >= 4 ? "📊 Medio" : "⚠️ A mejorar";
  const hasRatings = report.offensiveRating != null || report.defensiveRating != null || report.athleticismRating != null || report.iQRating != null;

  return (
    <div ref={pageRef} style={{
      width: PAGE_W, height: PAGE_H, background: C.white,
      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <PageHeader playerName={playerName} position={player?.position || ""} teamName={player?.teamName} page={2} total={3} />

      <div style={{ flex: 1, padding: "22px 28px", display: "flex", gap: 22, overflow: "hidden" }}>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <SectionTitle>Valoraciones del Scout</SectionTitle>

          <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "14px", background: "#f9fafb", borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ flexShrink: 0 }}>
              <svg width={88} height={88} viewBox="0 0 88 88">
                <circle cx="44" cy="44" r="34" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                <circle cx="44" cy="44" r="34" fill="none" stroke={C.primary} strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - report.rating / 10)}`}
                  strokeLinecap="round"
                  transform="rotate(-90 44 44)"
                />
                <text x="44" y="44" textAnchor="middle" dy="0.35em" fill={C.primary} fontSize="22" fontWeight="900" fontFamily="system-ui">{report.rating}</text>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>Valoración Global</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: C.textDark, lineHeight: 1 }}>
                {report.rating}<span style={{ fontSize: 14, color: C.textMuted, fontWeight: 400 }}>/10</span>
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 5 }}>{ratingLabel}</div>
            </div>
          </div>

          {hasRatings && (
            <div style={{ background: "#fafafa", borderRadius: 10, padding: "14px", border: `1px solid ${C.border}` }}>
              <RatingBar label="Ataque" value={report.offensiveRating} />
              <RatingBar label="Defensa" value={report.defensiveRating} />
              <RatingBar label="Atletismo" value={report.athleticismRating} />
              <RatingBar label="Basketball IQ" value={report.iQRating} />
            </div>
          )}

          {player && (
            <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 10 }}>Perfil Jugadora</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {player.height && <div style={{ fontSize: 11, color: C.textDark }}><span style={{ color: C.textMuted }}>Altura: </span>{player.height}</div>}
                {player.weight != null && <div style={{ fontSize: 11, color: C.textDark }}><span style={{ color: C.textMuted }}>Peso: </span>{player.weight} kg</div>}
                {player.handedness && <div style={{ fontSize: 11, color: C.textDark }}><span style={{ color: C.textMuted }}>Mano: </span>{player.handedness}</div>}
                {player.nationality && <div style={{ fontSize: 11, color: C.textDark }}><span style={{ color: C.textMuted }}>Nación: </span>{player.nationality}</div>}
                {player.jerseyNumber != null && <div style={{ fontSize: 11, color: C.textDark }}><span style={{ color: C.textMuted }}>Dorsal: </span>#{player.jerseyNumber}</div>}
                {player.age != null && <div style={{ fontSize: 11, color: C.textDark }}><span style={{ color: C.textMuted }}>Edad: </span>{player.age} años</div>}
              </div>
            </div>
          )}

          {insights.length > 0 && (
            <div style={{ background: "linear-gradient(135deg,#1e1b4b,#1e3a5f)", borderRadius: 12, padding: "15px", border: "1px solid rgba(249,115,22,0.2)", marginTop: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 14 }}>🤖</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: C.primary, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Alerta IA · Observaciones</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {insights.map((insight, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.primary, marginTop: 6, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <SectionTitle>Estadísticas del Partido</SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            <StatBox label="PTS" value={n(report.points)} highlight={true} />
            <StatBox label="REB" value={n(report.rebounds)} />
            <StatBox label="AST" value={n(report.assists)} />
            <StatBox label="ROB" value={n(report.steals)} />
            <StatBox label="TAP" value={n(report.blocks)} />
            <StatBox label="PÉR" value={n(report.turnovers)} />
            <StatBox label="MIN" value={n(report.minutesPlayed)} />
            <StatBox label="REB OF" value={n(report.offensiveRebounds)} />
            <StatBox label="REB DEF" value={n(report.defensiveRebounds)} />
          </div>

          <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 10 }}>Eficiencia Anotadora</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {fgPct && <StatBox label="TC%" value={fgPct} />}
              {tpPct && <StatBox label="T3%" value={tpPct} />}
              {ftPct && <StatBox label="TL%" value={ftPct} />}
              {eFG && <StatBox label="eFG%" value={eFG} />}
              {!fgPct && !tpPct && !ftPct && (
                <div style={{ gridColumn: "1/-1", color: C.textMuted, fontSize: 12, textAlign: "center" as const, padding: "8px 0" }}>Sin datos de tiro registrados</div>
              )}
            </div>
          </div>

          {report.fieldGoalsAttempted != null && (
            <div style={{ fontSize: 11, color: C.textMuted, textAlign: "center" as const, padding: "4px 0" }}>
              TC: {report.fieldGoalsMade ?? 0}/{report.fieldGoalsAttempted}
              {report.threesAttempted ? ` · T3: ${report.threesMade ?? 0}/${report.threesAttempted}` : ""}
              {report.freeThrowsAttempted ? ` · TL: ${report.freeThrowsMade ?? 0}/${report.freeThrowsAttempted}` : ""}
            </div>
          )}

          <div style={{ marginTop: "auto", background: "#f0f9ff", borderRadius: 12, padding: "14px", border: "1px solid #bae6fd" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#0284c7", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8 }}>Contexto del Análisis</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ fontSize: 11, color: "#0c4a6e" }}><span style={{ color: "#0369a1", fontWeight: 600 }}>Scout: </span>{report.scoutName}</div>
              {report.date && <div style={{ fontSize: 11, color: "#0c4a6e" }}><span style={{ color: "#0369a1", fontWeight: 600 }}>Fecha análisis: </span>{report.date}</div>}
              {player?.teamName && <div style={{ fontSize: 11, color: "#0c4a6e" }}><span style={{ color: "#0369a1", fontWeight: 600 }}>Club: </span>{player.teamName}</div>}
            </div>
          </div>
        </div>
      </div>

      <PageFooter scoutName={report.scoutName} date={report.date} />
    </div>
  );
}

function AnalysisPage({ report, player, notes, pageRef }: {
  report: Report; player?: Player; notes?: ScoutingNotes | null; pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const playerName = (player?.name || report.playerName || "").trim();
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
    }}>
      <PageHeader playerName={playerName} position={player?.position || ""} teamName={player?.teamName} page={3} total={3} />

      <div style={{ flex: 1, padding: "22px 28px", display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>

        <SectionTitle>Análisis de Scouting</SectionTitle>

        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1, background: C.greenBg, borderRadius: 12, padding: "16px", border: "1px solid #bbf7d0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 15 }}>✅</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.green, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Fortalezas</span>
            </div>
            {strengthsList.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {strengthsList.slice(0, 7).map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: C.green, fontWeight: 900, fontSize: 12, flexShrink: 0, marginTop: 1 }}>+</span>
                    <span style={{ fontSize: 12, color: "#166534", lineHeight: 1.4 }}>{s}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>Sin fortalezas registradas</span>
            )}
          </div>

          <div style={{ flex: 1, background: C.redBg, borderRadius: 12, padding: "16px", border: "1px solid #fecaca" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 15 }}>⚠️</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.red, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Debilidades</span>
            </div>
            {weaknessesList.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {weaknessesList.slice(0, 7).map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: C.red, fontWeight: 900, fontSize: 12, flexShrink: 0, marginTop: 1 }}>−</span>
                    <span style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.4 }}>{w}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>Sin debilidades registradas</span>
            )}
          </div>
        </div>

        {report.summary && (
          <div style={{ background: "#f8fafc", borderRadius: 12, padding: "16px", border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <div style={{ width: 3, height: 14, background: C.indigo, borderRadius: 2 }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: C.indigo, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Resumen del Scout</span>
            </div>
            <p style={{ fontSize: 13, color: C.textDark, lineHeight: 1.65, margin: 0 }}>{report.summary}</p>
          </div>
        )}

        {report.recommendation && (
          <div style={{ background: C.primaryLight, borderRadius: 12, padding: "16px", border: "1px solid #fed7aa" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>🎯</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.primary, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Recomendación Final</span>
            </div>
            <p style={{ fontSize: 13, color: "#9a3412", lineHeight: 1.55, margin: 0, fontWeight: 600 }}>{report.recommendation}</p>
          </div>
        )}

        {(claves || defense || attack) && (
          <div style={{ background: "#f0f9ff", borderRadius: 12, padding: "16px", border: "1px solid #bae6fd" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>📋</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.blue, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Claves del Partido</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {claves && <div><div style={{ fontSize: 10, color: "#0369a1", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 3 }}>Claves para ganar</div><p style={{ fontSize: 12, color: "#0c4a6e", margin: 0, lineHeight: 1.5 }}>{claves}</p></div>}
              {defense && <div><div style={{ fontSize: 10, color: "#0369a1", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 3 }}>Defensa rival</div><p style={{ fontSize: 12, color: "#0c4a6e", margin: 0, lineHeight: 1.5 }}>{defense}</p></div>}
              {attack && <div><div style={{ fontSize: 10, color: "#0369a1", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 3 }}>Sistema ofensivo rival</div><p style={{ fontSize: 12, color: "#0c4a6e", margin: 0, lineHeight: 1.5 }}>{attack}</p></div>}
            </div>
          </div>
        )}

        <div style={{ marginTop: "auto", background: "linear-gradient(135deg,#060d1a,#111827)", borderRadius: 12, padding: "16px 20px", border: "1px solid rgba(249,115,22,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 5 }}>CONCLUSIÓN SCOUT</div>
              <div style={{ color: "white", fontSize: 13, fontWeight: 600, lineHeight: 1.4, maxWidth: 460 }}>{conclusionText}</div>
            </div>
            <div style={{ textAlign: "right" as const, flexShrink: 0, marginLeft: 16 }}>
              <div style={{ fontSize: 38, fontWeight: 900, color: C.primary, lineHeight: 1 }}>{report.rating}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginTop: 2 }}>puntos</div>
            </div>
          </div>
        </div>
      </div>

      <PageFooter scoutName={report.scoutName} date={report.date} />
    </div>
  );
}

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
  return (
    <div aria-hidden="true" style={{ position: "fixed", left: -9999, top: 0, zIndex: -1, pointerEvents: "none" }}>
      <CoverPage report={report} player={player} game={game} pageRef={page1Ref} />
      <StatsPage report={report} player={player} pageRef={page2Ref} />
      <AnalysisPage report={report} player={player} notes={notes} pageRef={page3Ref} />
    </div>
  );
}
