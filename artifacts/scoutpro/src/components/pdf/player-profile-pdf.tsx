/**
 * PlayerProfilePdfButton — A4 player dossier.
 * Professional dark-header layout captured with html2canvas-pro + jsPDF.
 */
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const PAGE_W = 794;
const PAGE_H = 1123;

const C = {
  dark:    "#0F172A",
  dark2:   "#1e293b",
  accent:  "#f97316",
  white:   "#ffffff",
  light:   "#F8FAFC",
  muted:   "#94a3b8",
  border:  "#E2E8F0",
  text:    "#1e293b",
  green:   "#16a34a",
  greenBg: "#f0fdf4",
  red:     "#dc2626",
  redBg:   "#fef2f2",
  purple:  "#7c3aed",
  purpleBg:"#f5f3ff",
};

function pct(v: number | null): string {
  return v != null ? `${(v * 100).toFixed(1)}%` : "—";
}

function buildRows(
  gp: number, pts: number, reb: number, ast: number,
  stl: number, blk: number, minAvg: number,
  fgPct: number | null, fg3Pct: number | null, ftPct: number | null
): [string, string, string][] {
  const fmt = (avg: number) => gp > 0 && avg > 0 ? String(Math.round(gp * avg)) : "—";
  return [
    ["Partidos",    String(gp || "—"), "—"],
    ["Minutos",     fmt(minAvg), minAvg > 0 ? minAvg.toFixed(1) : "—"],
    ["Puntos",      fmt(pts),    pts  > 0 ? pts.toFixed(1)  : "—"],
    ["Rebotes",     fmt(reb),    reb  > 0 ? reb.toFixed(1)  : "—"],
    ["Asistencias", fmt(ast),    ast  > 0 ? ast.toFixed(1)  : "—"],
    ["Robos",       fmt(stl),    stl  > 0 ? stl.toFixed(1)  : "—"],
    ["Tapones",     fmt(blk),    blk  > 0 ? blk.toFixed(1)  : "—"],
    ["FG%",         "—",         pct(fgPct)],
    ["3P%",         "—",         pct(fg3Pct)],
    ["TL%",         "—",         pct(ftPct)],
  ];
}

function AttrBar({ label, value }: { label: string; value: any }) {
  const v = Number(value) || 0;
  const color = v >= 75 ? "#16a34a" : v >= 50 ? C.accent : v >= 25 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: C.text, width: 68, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: C.border, borderRadius: 4, height: 7, overflow: "hidden" }}>
        <div style={{ width: `${v}%`, background: color, height: 7, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: C.dark, width: 26, textAlign: "right" }}>
        {v || "—"}
      </span>
    </div>
  );
}

function SectionTitle({ label, color = C.accent }: { label: string; color?: string }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 800, color, textTransform: "uppercase",
      letterSpacing: 2, borderBottom: `2px solid ${color}`,
      paddingBottom: 5, marginBottom: 10,
    }}>
      {label}
    </div>
  );
}

export function PlayerProfilePdfButton({ player, profile, febRow }: {
  player: any;
  profile: any;
  febRow: any | null;
}) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!pageRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const canvas = await (html2canvas as any)(pageRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
      });
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
      doc.save(`${(player.name || "jugador").replace(/\s+/g, "_")}_perfil.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(false);
    }
  };

  // Resolved stats
  const gp     = febRow?.gamesPlayed ?? 0;
  const pts    = febRow?.pts    ?? 0;
  const reb    = febRow?.reb    ?? 0;
  const ast    = febRow?.ast    ?? 0;
  const stl    = febRow?.stl    ?? 0;
  const blk    = febRow?.blk    ?? 0;
  const minAvg = febRow?.min    ?? 0;
  const rows   = buildRows(gp, pts, reb, ast, stl, blk, minAvg, febRow?.fgPct ?? null, febRow?.fg3Pct ?? null, febRow?.ftPct ?? null);

  const initials = (player.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={exporting}
        onClick={handleExport}
        className="border-white/[0.15] text-white hover:bg-white/5 bg-transparent text-[11px] font-semibold h-7 px-2.5"
      >
        <Download className="h-3 w-3 mr-1.5" />
        {exporting ? "Generando…" : "Exportar PDF"}
      </Button>

      {/* ── Hidden A4 print layout ── */}
      <div
        style={{ position: "fixed", left: -9999, top: 0, width: PAGE_W, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <div
          ref={pageRef}
          style={{
            width: PAGE_W, height: PAGE_H,
            background: C.white,
            fontFamily: "system-ui, -apple-system, sans-serif",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* ── HEADER ── */}
          <div style={{ background: C.dark, padding: "28px 36px", display: "flex", alignItems: "center", gap: 24 }}>
            {/* Initials / photo placeholder */}
            <div style={{
              width: 96, height: 124, background: "#1e293b", borderRadius: 8,
              border: "2px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.25)", fontSize: 32, fontWeight: 900, flexShrink: 0,
            }}>
              {initials}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.white, letterSpacing: -0.5, lineHeight: 1.1 }}>
                {player.name}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginTop: 5 }}>
                {player.position}
                {player.teamName ? ` — ${player.teamName}` : ""}
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
                {[
                  ["Edad",    player.age      ? `${player.age} años` : "—"],
                  ["Altura",  player.height   || "—"],
                  ["Peso",    player.weight   ? `${player.weight} kg` : "—"],
                  ["Nac.",    player.nationality || "—"],
                  ["Mano",    player.handedness  || "—"],
                  ["Dorsal",  player.jerseyNumber != null ? `#${player.jerseyNumber}` : "—"],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: 1 }}>{lbl}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.white, marginTop: 2 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating circle */}
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{
                width: 88, height: 88, borderRadius: "50%",
                border: `3px solid ${C.accent}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: "rgba(249,115,22,0.1)",
              }}>
                <span style={{ fontSize: 30, fontWeight: 900, color: C.accent, lineHeight: 1 }}>
                  {profile.overallRating || "—"}
                </span>
                <span style={{ fontSize: 6.5, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1, marginTop: 3 }}>
                  Valoración
                </span>
              </div>
              <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.3)", marginTop: 6, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
                ScoutPro
              </div>
            </div>
          </div>

          {/* FEB Source Badge */}
          {febRow && (
            <div style={{ background: "#0f172a", padding: "5px 36px", display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "#10b981", flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: 1 }}>
                Estadísticas FEB — {febRow.leagueShortName || febRow.leagueName} {febRow.seasonName}
              </span>
            </div>
          )}

          {/* ── KEY STATS BAR ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", background: C.light, borderBottom: `2px solid ${C.border}` }}>
            {[
              ["PJ",  gp > 0 ? String(gp) : "—"],
              ["PPJ", pts  > 0 ? pts.toFixed(1)  : "—"],
              ["RPJ", reb  > 0 ? reb.toFixed(1)  : "—"],
              ["APJ", ast  > 0 ? ast.toFixed(1)  : "—"],
              ["FG%", pct(febRow?.fgPct ?? null)],
              ["VAL", febRow?.val != null ? Number(febRow.val).toFixed(1) : "—"],
            ].map(([lbl, val], i) => (
              <div key={lbl} style={{
                textAlign: "center", padding: "12px 8px",
                borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
              }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{lbl}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: i === 1 ? C.accent : C.dark, marginTop: 2, lineHeight: 1 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* ── BODY ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: "18px 36px" }}>

            {/* LEFT: Stats table + Attributes */}
            <div>
              <SectionTitle label="Estadísticas por Temporada" />
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
                <thead>
                  <tr style={{ background: C.dark }}>
                    {["Métrica", "Total", "Prom."].map((h, i) => (
                      <th key={h} style={{
                        padding: "5px 8px", color: C.white,
                        textAlign: i === 0 ? "left" : "center",
                        fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, total, avg], i) => (
                    <tr key={label} style={{ background: i % 2 === 0 ? C.white : C.light }}>
                      <td style={{ padding: "5px 8px", color: C.text, fontWeight: 600 }}>{label}</td>
                      <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: "monospace", color: C.muted }}>{total}</td>
                      <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: C.dark }}>{avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 16 }}>
                <SectionTitle label="Atributos del Jugador" />
                <AttrBar label="Global"    value={profile.overallRating} />
                <AttrBar label="Potencial" value={profile.potential} />
                <AttrBar label="Defensa"   value={profile.defensiveRating} />
                <AttrBar label="Físico"    value={profile.athleticism} />
                <AttrBar label="Visión"    value={profile.bbIQ} />
              </div>

              {(profile.role || profile.playStyle) && (
                <div style={{ marginTop: 14 }}>
                  <SectionTitle label="Perfil de Juego" color="#6366f1" />
                  {profile.role && (
                    <div style={{ fontSize: 10.5, color: C.text, marginBottom: 4 }}>
                      <strong>Rol:</strong> {profile.role}
                    </div>
                  )}
                  {profile.playStyle && (
                    <div style={{ fontSize: 10.5, color: C.text }}>
                      <strong>Estilo:</strong> {profile.playStyle}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: Strengths, Weaknesses, Notes */}
            <div>
              <SectionTitle label="Fortalezas" color={C.green} />
              <div style={{ background: C.greenBg, borderRadius: 6, padding: "10px 12px", marginBottom: 14, minHeight: 80 }}>
                {profile.strengths
                  ? profile.strengths.split("\n").filter(Boolean).map((line: string, i: number) => (
                      <div key={i} style={{ fontSize: 10.5, color: "#166534", marginBottom: 5, display: "flex", gap: 6 }}>
                        <span style={{ color: C.green, flexShrink: 0, fontWeight: 700 }}>✓</span>
                        {line}
                      </div>
                    ))
                  : <span style={{ color: C.muted, fontSize: 10.5, fontStyle: "italic" }}>Sin datos registrados.</span>
                }
              </div>

              <SectionTitle label="Debilidades" color={C.red} />
              <div style={{ background: C.redBg, borderRadius: 6, padding: "10px 12px", marginBottom: 14, minHeight: 80 }}>
                {profile.weaknesses
                  ? profile.weaknesses.split("\n").filter(Boolean).map((line: string, i: number) => (
                      <div key={i} style={{ fontSize: 10.5, color: "#991b1b", marginBottom: 5, display: "flex", gap: 6 }}>
                        <span style={{ color: C.red, flexShrink: 0, fontWeight: 700 }}>✗</span>
                        {line}
                      </div>
                    ))
                  : <span style={{ color: C.muted, fontSize: 10.5, fontStyle: "italic" }}>Sin datos registrados.</span>
                }
              </div>

              {profile.technicalNotes && (
                <>
                  <SectionTitle label="Notas del Scout" color={C.purple} />
                  <div style={{ background: C.purpleBg, borderRadius: 6, padding: "10px 12px", marginBottom: 14 }}>
                    <p style={{ fontSize: 10.5, color: "#4c1d95", lineHeight: 1.6, margin: 0 }}>
                      {profile.technicalNotes}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: C.dark, padding: "10px 36px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.accent, letterSpacing: 2 }}>SCOUTPRO</div>
            <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.35)" }}>
              Generado el {new Date().toLocaleDateString("es-ES")}
            </div>
            <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.35)" }}>Documento confidencial</div>
          </div>
        </div>
      </div>
    </>
  );
}
