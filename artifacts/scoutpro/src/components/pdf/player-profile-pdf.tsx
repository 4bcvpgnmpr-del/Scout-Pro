/**
 * PlayerProfilePdfButton — 2-page A4 player dossier.
 * Page 1: Stats + Attributes + Strengths/Weaknesses
 * Page 2: Full Scouting analysis
 * Photo is pre-fetched to base64 so html2canvas-pro can embed it.
 */
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const PAGE_W = 794;
const PAGE_H = 1123;

const C = {
  dark:     "#0F172A",
  dark2:    "#1e293b",
  accent:   "#f97316",
  white:    "#ffffff",
  light:    "#F8FAFC",
  muted:    "#94a3b8",
  border:   "#E2E8F0",
  text:     "#1e293b",
  green:    "#16a34a",
  greenBg:  "#f0fdf4",
  red:      "#dc2626",
  redBg:    "#fef2f2",
  purple:   "#7c3aed",
  purpleBg: "#f5f3ff",
  blue:     "#2563eb",
  blueBg:   "#eff6ff",
  amber:    "#d97706",
  amberBg:  "#fffbeb",
};

function pct(v: number | null | undefined): string {
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
      <span style={{ fontSize: 10, fontWeight: 600, color: C.text, width: 72, flexShrink: 0 }}>{label}</span>
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

/** Shared dark header used on both pages */
function PageHeader({ player, photoDataUrl, initials, isPage2 }: {
  player: any; photoDataUrl: string | null; initials: string; isPage2?: boolean;
}) {
  return (
    <div style={{ background: C.dark, padding: "20px 36px", display: "flex", alignItems: "center", gap: 20 }}>
      {/* Photo or initials */}
      <div style={{
        width: 80, height: 104, background: "#1e293b", borderRadius: 8,
        border: "2px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", flexShrink: 0,
      }}>
        {photoDataUrl
          ? <img src={photoDataUrl} alt={player.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
          : <span style={{ fontSize: 28, fontWeight: 900, color: "rgba(255,255,255,0.18)" }}>{initials}</span>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: -0.5, lineHeight: 1.1 }}>
          {player.name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginTop: 4 }}>
          {player.position}{player.teamName ? ` — ${player.teamName}` : ""}
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
          {[
            ["Edad",    player.age         ? `${player.age} años` : "—"],
            ["Altura",  player.height      || "—"],
            ["Peso",    player.weight      ? `${player.weight} kg` : "—"],
            ["Nac.",    player.nationality || "—"],
            ["Mano",    player.handedness  || "—"],
            ["Dorsal",  player.jerseyNumber != null ? `#${player.jerseyNumber}` : "—"],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 7, fontWeight: 700, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: 1 }}>{lbl}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.white, marginTop: 1 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Page label */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: C.accent, letterSpacing: 2 }}>SCOUTPRO</div>
        <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
          {isPage2 ? "Informe de Scouting" : "Perfil del Jugador"}
        </div>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
          {new Date().toLocaleDateString("es-ES")}
        </div>
      </div>
    </div>
  );
}

function PageFooter({ page, total }: { page: number; total: number }) {
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      background: C.dark, padding: "8px 36px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: 2 }}>SCOUTPRO</div>
      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>Documento confidencial · Pág. {page}/{total}</div>
    </div>
  );
}

export function PlayerProfilePdfButton({ player, profile, febRow }: {
  player: any;
  profile: any;
  febRow: any | null;
}) {
  const page1Ref = useRef<HTMLDivElement | null>(null);
  const page2Ref = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      // 1. Pre-fetch photo → base64 so html2canvas can embed it
      let fetchedPhoto: string | null = null;
      if (player.photoUrl) {
        try {
          const resp = await fetch(player.photoUrl, { credentials: "include" });
          if (resp.ok) {
            const blob = await resp.blob();
            fetchedPhoto = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }
        } catch { /* fallback to initials */ }
      }
      // Update state so the hidden divs re-render with the photo
      setPhotoDataUrl(fetchedPhoto);
      // Wait a tick for React to re-render
      await new Promise((r) => setTimeout(r, 120));

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const opts = { scale: 2, useCORS: false, allowTaint: false, backgroundColor: "#ffffff" };

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Page 1
      if (page1Ref.current) {
        const c1 = await (html2canvas as any)(page1Ref.current, opts);
        doc.addImage(c1.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
      }
      // Page 2
      if (page2Ref.current) {
        doc.addPage();
        const c2 = await (html2canvas as any)(page2Ref.current, opts);
        doc.addImage(c2.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
      }

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
  const rows   = buildRows(gp, pts, reb, ast, stl, blk, minAvg,
    febRow?.fgPct ?? null, febRow?.fg3Pct ?? null, febRow?.ftPct ?? null);

  const initials = (player.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const scoutingFields: [string, keyof typeof profile, string, string][] = [
    ["Tendencias ofensivas",         "offensiveTendencies",  "#ea580c", C.amberBg],
    ["Tendencias defensivas",        "defensiveTendencies",  C.blue,    C.blueBg],
    ["Comportamiento en transición", "transitionBehavior",   C.green,   C.greenBg],
    ["Toma de decisiones",           "decisionMaking",       C.purple,  C.purpleBg],
    ["Lectura táctica",              "tacticalReading",      "#0891b2", "#ecfeff"],
    ["Rendimiento bajo presión",     "pressurePerformance",  C.red,     C.redBg],
  ];

  const headerProps = { player, photoDataUrl, initials };

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

      {/* ── Hidden pages ── */}
      <div style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none" }} aria-hidden="true">

        {/* ═══ PAGE 1: Stats + Attributes + Strengths/Weaknesses ═══ */}
        <div ref={page1Ref} style={{
          width: PAGE_W, height: PAGE_H, background: C.white,
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden", position: "relative",
        }}>
          <PageHeader {...headerProps} />

          {/* FEB badge */}
          {febRow && (
            <div style={{ background: "#0f172a", padding: "5px 36px", display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "#10b981", flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: 1 }}>
                Estadísticas FEB — {febRow.leagueShortName || febRow.leagueName} {febRow.seasonName}
              </span>
            </div>
          )}

          {/* Key stats bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: C.light, borderBottom: `2px solid ${C.border}` }}>
            {[
              ["PJ",  gp > 0      ? String(gp)           : "—"],
              ["PPJ", pts  > 0    ? pts.toFixed(1)        : "—"],
              ["RPJ", reb  > 0    ? reb.toFixed(1)        : "—"],
              ["APJ", ast  > 0    ? ast.toFixed(1)        : "—"],
              ["RPJ", stl  > 0    ? stl.toFixed(1)        : "—"],
              ["FG%", pct(febRow?.fgPct ?? null)],
              ["VAL", febRow?.val != null ? Number(febRow.val).toFixed(1) : "—"],
            ].map(([lbl, val], i) => (
              <div key={`${lbl}${i}`} style={{
                textAlign: "center", padding: "10px 6px",
                borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
              }}>
                <div style={{ fontSize: 7.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{lbl}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: i === 1 ? C.accent : C.dark, marginTop: 2, lineHeight: 1 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Body */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, padding: "16px 36px 48px" }}>

            {/* LEFT: Stats + Attributes + Perfil */}
            <div>
              <SectionTitle label="Estadísticas por Temporada" />
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr style={{ background: C.dark }}>
                    {["Métrica", "Total", "Prom."].map((h, i) => (
                      <th key={h} style={{
                        padding: "5px 8px", color: C.white,
                        textAlign: i === 0 ? "left" : "center",
                        fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, total, avg], i) => (
                    <tr key={label} style={{ background: i % 2 === 0 ? C.white : C.light }}>
                      <td style={{ padding: "4px 8px", color: C.text, fontWeight: 600 }}>{label}</td>
                      <td style={{ padding: "4px 8px", textAlign: "center", fontFamily: "monospace", color: C.muted }}>{total}</td>
                      <td style={{ padding: "4px 8px", textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: C.dark }}>{avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 14 }}>
                <SectionTitle label="Atributos del Jugador" />
                <AttrBar label="Potencial"  value={profile.potential} />
                <AttrBar label="Defensa"    value={profile.defensiveRating} />
                <AttrBar label="Físico"     value={profile.athleticism} />
                <AttrBar label="Visión"     value={profile.bbIQ} />
              </div>

              {(profile.role || profile.playStyle) && (
                <div style={{ marginTop: 12 }}>
                  <SectionTitle label="Perfil de Juego" color="#6366f1" />
                  {profile.role && (
                    <div style={{ fontSize: 10, color: C.text, marginBottom: 4 }}>
                      <strong>Rol:</strong> {profile.role}
                    </div>
                  )}
                  {profile.playStyle && (
                    <div style={{ fontSize: 10, color: C.text }}>
                      <strong>Estilo:</strong> {profile.playStyle}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: Fortalezas + Debilidades + Notas */}
            <div>
              <SectionTitle label="Fortalezas" color={C.green} />
              <div style={{ background: C.greenBg, borderRadius: 6, padding: "10px 12px", marginBottom: 12, minHeight: 72 }}>
                {profile.strengths
                  ? profile.strengths.split("\n").filter(Boolean).map((line: string, i: number) => (
                      <div key={i} style={{ fontSize: 10, color: "#166534", marginBottom: 5, display: "flex", gap: 6 }}>
                        <span style={{ color: C.green, flexShrink: 0, fontWeight: 700 }}>✓</span>{line}
                      </div>
                    ))
                  : <span style={{ color: C.muted, fontSize: 10, fontStyle: "italic" }}>Sin datos registrados.</span>
                }
              </div>

              <SectionTitle label="Debilidades" color={C.red} />
              <div style={{ background: C.redBg, borderRadius: 6, padding: "10px 12px", marginBottom: 12, minHeight: 72 }}>
                {profile.weaknesses
                  ? profile.weaknesses.split("\n").filter(Boolean).map((line: string, i: number) => (
                      <div key={i} style={{ fontSize: 10, color: "#991b1b", marginBottom: 5, display: "flex", gap: 6 }}>
                        <span style={{ color: C.red, flexShrink: 0, fontWeight: 700 }}>✗</span>{line}
                      </div>
                    ))
                  : <span style={{ color: C.muted, fontSize: 10, fontStyle: "italic" }}>Sin datos registrados.</span>
                }
              </div>

              {profile.technicalNotes && (
                <>
                  <SectionTitle label="Notas del Scout" color={C.purple} />
                  <div style={{ background: C.purpleBg, borderRadius: 6, padding: "10px 12px" }}>
                    <p style={{ fontSize: 10, color: "#4c1d95", lineHeight: 1.6, margin: 0 }}>
                      {profile.technicalNotes}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <PageFooter page={1} total={2} />
        </div>

        {/* ═══ PAGE 2: Scouting Analysis ═══ */}
        <div ref={page2Ref} style={{
          width: PAGE_W, height: PAGE_H, background: C.white,
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden", position: "relative",
        }}>
          <PageHeader {...headerProps} isPage2 />

          <div style={{ padding: "18px 36px 48px" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 13, fontWeight: 900, color: C.dark, letterSpacing: -0.3,
                borderBottom: `3px solid ${C.accent}`, paddingBottom: 8,
              }}>
                Análisis de Scouting
              </div>
              <div style={{ fontSize: 9.5, color: C.muted, marginTop: 4 }}>
                Evaluación cualitativa del perfil técnico y táctico del jugador
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {scoutingFields.map(([label, key, color, bg]) => {
                const val = profile[key] as string | undefined;
                return (
                  <div key={key} style={{ background: C.light, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <div style={{
                      background: color, padding: "7px 14px",
                      fontSize: 8.5, fontWeight: 800, color: C.white,
                      textTransform: "uppercase", letterSpacing: 1.5,
                    }}>
                      {label}
                    </div>
                    <div style={{ padding: "10px 14px", minHeight: 90, background: bg }}>
                      {val
                        ? <p style={{ fontSize: 10, color: C.text, lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{val}</p>
                        : <span style={{ fontSize: 9.5, color: C.muted, fontStyle: "italic" }}>Sin notas registradas.</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <PageFooter page={2} total={2} />
        </div>

      </div>
    </>
  );
}
