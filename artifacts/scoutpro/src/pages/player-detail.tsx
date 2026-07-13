import { useState, useRef, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useGetPlayer, useGetPlayerStats, useListReports, useDeletePlayer,
  useUpdatePlayer, useListPlayers,
  getGetPlayerQueryKey, getGetPlayerStatsQueryKey,
  getListReportsQueryKey, getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/photo-upload";
import {
  usePlayerProfile, getStoredProfile, computeAdvancedStats,
  type SeasonStats, type VideoEntry,
} from "@/hooks/use-player-profile";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  ArrowLeft, Pencil, Trash2, Plus, Save, Check, X,
  TrendingUp, FileText, Video, GitCompare, History,
  User, Target, Activity, ExternalLink, Star,
  ChevronRight, BarChart3, Zap, Shield, Brain,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}
function getYtThumbnail(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
  return null;
}

function parseNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function fmt1(v: string | null): string { return v ?? "—"; }
function fmtPct(v: string | null): string { return v ? v + "%" : "—"; }

// AI comparison
function generateAIComparison(
  nameA: string, sA: SeasonStats, ratingA: string, potA: string,
  nameB: string, sB: SeasonStats, ratingB: string, potB: string,
) {
  const adA = computeAdvancedStats(sA);
  const adB = computeAdvancedStats(sB);
  const advantagesA: string[] = [];
  const advantagesB: string[] = [];

  const compare = (labelA: string, labelB: string, a: number | null, b: number | null, unit = "") => {
    if (a === null || b === null) return;
    if (a > b + (b * 0.08)) advantagesA.push(`${labelA}: ${a.toFixed(1)}${unit} vs ${b.toFixed(1)}${unit}`);
    else if (b > a + (a * 0.08)) advantagesB.push(`${labelB}: ${b.toFixed(1)}${unit} vs ${a.toFixed(1)}${unit}`);
  };

  compare("Mayor anotador", "Mayor anotador", parseNum(sA.points), parseNum(sB.points), " ppg");
  compare("Mejor reboteador", "Mejor reboteador",
    (parseNum(sA.offReb) ?? 0) + (parseNum(sA.defReb) ?? 0),
    (parseNum(sB.offReb) ?? 0) + (parseNum(sB.defReb) ?? 0), " rpg");
  compare("Mejor asistente", "Mejor asistente", parseNum(sA.assists), parseNum(sB.assists), " apg");
  compare("Más robos", "Más robos", parseNum(sA.steals), parseNum(sB.steals), " rpg");
  compare("Mayor eFG%", "Mayor eFG%", parseNum(adA.eFG), parseNum(adB.eFG), "%");
  compare("Mayor TS%", "Mayor TS%", parseNum(adA.tS), parseNum(adB.tS), "%");
  compare("Mayor valoración global", "Mayor valoración global", parseNum(ratingA), parseNum(ratingB));
  compare("Mayor potencial", "Mayor potencial", parseNum(potA), parseNum(potB));

  const rA = parseNum(ratingA) ?? 0, rB = parseNum(ratingB) ?? 0;
  const recommendation =
    rA > rB + 1
      ? `Basado en las valoraciones y estadísticas, ${nameA} presenta un perfil scouting más sólido en este momento. Recomendación: priorizar seguimiento de ${nameA}.`
      : rB > rA + 1
      ? `Basado en las valoraciones y estadísticas, ${nameB} presenta un perfil scouting más sólido en este momento. Recomendación: priorizar seguimiento de ${nameB}.`
      : `Ambos jugadores presentan perfiles similares. Se recomienda observación directa adicional para tomar una decisión de scouting definitiva.`;

  return { advantagesA, advantagesB, recommendation };
}

// ─── small shared components ─────────────────────────────────────────────────

function SaveBadge({ saving, savedAt }: { saving: boolean; savedAt: Date | null }) {
  if (saving) return (
    <span className="text-xs text-amber-500 flex items-center gap-1">
      <Save className="h-3 w-3 animate-pulse" /> Guardando…
    </span>
  );
  if (savedAt) return (
    <span className="text-xs text-emerald-500 flex items-center gap-1">
      <Check className="h-3 w-3" /> Guardado
    </span>
  );
  return null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{children}</div>
  );
}

function InlineTextarea({
  label, value, onChange, placeholder, rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1">
      <SectionLabel>{label}</SectionLabel>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? `${label}…`}
        rows={rows}
        className="text-sm resize-none"
      />
    </div>
  );
}

function StatInput({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="bg-muted/40 border rounded-lg p-2 text-center">
      <Input
        type="number" min="0" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-center text-base font-bold border-0 bg-transparent focus-visible:ring-0 p-0"
        placeholder="—"
      />
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

function RatingCircle({ value, max = 10, label }: { value: string; max?: number; label: string }) {
  const num = parseNum(value);
  const pct = num !== null ? (num / max) * 100 : 0;
  const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f97316" : pct >= 25 ? "#eab308" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-14 w-14">
        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
          <circle
            cx="28" cy="28" r="22" fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-bold text-sm">
          {num !== null ? num : "—"}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-widest text-center">{label}</span>
    </div>
  );
}

function CompareBar({
  labelA, labelB, valA, valB, unit = "",
}: {
  labelA: string; labelB: string; valA: number | null; valB: number | null; unit?: string;
}) {
  const max = Math.max(valA ?? 0, valB ?? 0, 1);
  const pA = valA !== null ? (valA / max) * 100 : 0;
  const pB = valB !== null ? (valB / max) * 100 : 0;
  const colorA = (valA ?? 0) >= (valB ?? 0) ? "bg-primary" : "bg-muted-foreground/40";
  const colorB = (valB ?? 0) > (valA ?? 0) ? "bg-primary" : "bg-muted-foreground/40";
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 border-b last:border-0">
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-sm font-bold">{valA !== null ? `${valA.toFixed(1)}${unit}` : "—"}</span>
        <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden flex justify-end">
          <div className={`h-full rounded-full transition-all ${colorA}`} style={{ width: `${pA}%` }} />
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase text-center whitespace-nowrap px-1">{labelA}</span>
      <div className="flex flex-col items-start gap-0.5">
        <span className="text-sm font-bold">{valB !== null ? `${valB.toFixed(1)}${unit}` : "—"}</span>
        <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${colorB}`} style={{ width: `${pB}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab: General ────────────────────────────────────────────────────────────

function TabGeneral({ player, playerId, profile, onUpdate }: {
  player: { name: string; position: string; jerseyNumber?: number | null; age?: number | null; height?: string | null; weight?: number | null; nationality?: string | null; handedness?: string | null; teamName?: string | null; photoUrl?: string | null };
  playerId: number;
  profile: ReturnType<typeof usePlayerProfile>["profile"];
  onUpdate: (p: Partial<typeof profile>) => void;
}) {
  const dbRows: [string, string | number | null | undefined][] = [
    ["Posición principal", player.position],
    ["Posición secundaria", profile.secondaryPosition || "—"],
    ["Dorsal", player.jerseyNumber != null ? `#${player.jerseyNumber}` : "—"],
    ["Edad", player.age != null ? `${player.age} años` : "—"],
    ["Nacimiento", profile.birthday || "—"],
    ["Nacionalidad", player.nationality || "—"],
    ["Altura", player.height || "—"],
    ["Peso", player.weight != null ? `${player.weight} kg` : "—"],
    ["Mano dominante", player.handedness || "—"],
    ["Equipo actual", player.teamName || "Agente libre"],
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left: Info */}
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Información personal
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" asChild>
                <Link href={`/players/${playerId}/edit`}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar info básica →
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              {dbRows.map(([label, val]) => (
                <div key={label} className="flex items-center justify-between border-b border-dashed border-muted/50 py-1.5">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
                  <span className="font-medium text-right">{val ?? "—"}</span>
                </div>
              ))}
            </div>
            {/* Extended: secondaryPosition + birthday inline */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <SectionLabel>Posición secundaria (editable)</SectionLabel>
                <Input
                  value={profile.secondaryPosition}
                  onChange={(e) => onUpdate({ secondaryPosition: e.target.value })}
                  placeholder="Ej: Alero"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <SectionLabel>Fecha de nacimiento</SectionLabel>
                <Input
                  type="date"
                  value={profile.birthday}
                  onChange={(e) => onUpdate({ birthday: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Perfil de juego
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <SectionLabel>Estilo de juego</SectionLabel>
                <Input value={profile.playStyle} onChange={(e) => onUpdate({ playStyle: e.target.value })} placeholder="Ej: Playmaker físico" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <SectionLabel>Rol en el equipo</SectionLabel>
                <Input value={profile.role} onChange={(e) => onUpdate({ role: e.target.value })} placeholder="Ej: Sexto hombre" className="h-8 text-sm" />
              </div>
            </div>
            <InlineTextarea label="Fortalezas" value={profile.strengths} onChange={(v) => onUpdate({ strengths: v })} placeholder="Principales puntos fuertes del jugador…" rows={2} />
            <InlineTextarea label="Debilidades" value={profile.weaknesses} onChange={(v) => onUpdate({ weaknesses: v })} placeholder="Áreas de mejora…" rows={2} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Observaciones del scout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InlineTextarea label="Observaciones técnicas" value={profile.technicalNotes} onChange={(v) => onUpdate({ technicalNotes: v })} rows={2} />
            <InlineTextarea label="Observaciones tácticas" value={profile.tacticalNotes} onChange={(v) => onUpdate({ tacticalNotes: v })} rows={2} />
            <InlineTextarea label="Observaciones físicas" value={profile.physicalNotes} onChange={(v) => onUpdate({ physicalNotes: v })} rows={2} />
          </CardContent>
        </Card>
      </div>

      {/* Right: Ratings */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" /> Valoraciones (1–10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-around mb-5">
              <RatingCircle value={profile.overallRating} label="Global" />
              <RatingCircle value={profile.currentLevel} label="Nivel actual" />
              <RatingCircle value={profile.potential} label="Potencial" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["overallRating", "currentLevel", "potential"] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <SectionLabel>{k === "overallRating" ? "Global" : k === "currentLevel" ? "Nivel" : "Potencial"}</SectionLabel>
                  <Input
                    type="number" min="1" max="10"
                    value={profile[k]}
                    onChange={(e) => onUpdate({ [k]: e.target.value })}
                    className="h-8 text-center text-sm font-bold"
                    placeholder="1-10"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Notas de seguimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InlineTextarea
              label="Observaciones generales"
              value={profile.scoutingNotes}
              onChange={(v) => onUpdate({ scoutingNotes: v })}
              placeholder="Seguimiento, recomendaciones, comentarios…"
              rows={7}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Estadísticas ───────────────────────────────────────────────────────

type SeasonRow = {
  startYear: number;
  seasonName: string;
  leagueName: string;
  leagueShortName: string;
  teamName: string;
  gamesPlayed: number;
  pts: number; reb: number; ast: number; stl: number; blk: number; min: number;
  fgPct: number | null; fg3Pct: number | null; ftPct: number | null;
};

function TabStats({ playerId, profile, updateStats, updateAdvanced }: {
  playerId: number;
  profile: ReturnType<typeof usePlayerProfile>["profile"];
  updateStats: ReturnType<typeof usePlayerProfile>["updateStats"];
  updateAdvanced: ReturnType<typeof usePlayerProfile>["updateAdvanced"];
}) {
  const { data: seasonRows } = useQuery<SeasonRow[]>({
    queryKey: ["player-stats-seasons", playerId],
    queryFn: async () => {
      const res = await fetch(`/api/players/${playerId}/stats/seasons`);
      if (!res.ok) return [];
      return res.json() as Promise<SeasonRow[]>;
    },
    enabled: !!playerId,
  });

  const s = profile.seasonStats;
  const adv = computeAdvancedStats(s);
  const manual = profile.advancedStats;

  const totReb = (parseNum(s.offReb) ?? 0) + (parseNum(s.defReb) ?? 0);
  const fgPct = parseNum(s.fgMade) !== null && parseNum(s.fgAtt) && parseNum(s.fgAtt)! > 0
    ? ((parseNum(s.fgMade)! / parseNum(s.fgAtt)!) * 100).toFixed(1) + "%" : "—";
  const t3Pct = parseNum(s.t3Made) !== null && parseNum(s.t3Att) && parseNum(s.t3Att)! > 0
    ? ((parseNum(s.t3Made)! / parseNum(s.t3Att)!) * 100).toFixed(1) + "%" : "—";
  const ftPct = parseNum(s.ftMade) !== null && parseNum(s.ftAtt) && parseNum(s.ftAtt)! > 0
    ? ((parseNum(s.ftMade)! / parseNum(s.ftAtt)!) * 100).toFixed(1) + "%" : "—";

  const gamesPlayed = parseNum(s.gamesPlayed) ?? 0;
  const ptsAvg = parseNum(s.points) ?? 0;
  const ptsTotal = gamesPlayed > 0 && ptsAvg > 0 ? Math.round(gamesPlayed * ptsAvg) : null;
  const valAvg = ptsAvg + totReb + (parseNum(s.assists) ?? 0) + (parseNum(s.steals) ?? 0) + (parseNum(s.blocks) ?? 0);
  const valTotal = gamesPlayed > 0 && valAvg > 0 ? Math.round(gamesPlayed * valAvg) : null;
  const hasValData = ptsAvg > 0 || valAvg > 0;

  return (
    <div className="space-y-6">
      {/* ── Historial de estadísticas por temporada (FEB/Liga) ── */}
      {seasonRows && seasonRows.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Estadísticas por temporada (FEB)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-primary/10 bg-primary/5">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Temporada</th>
                    <th className="text-left px-2 py-2 font-semibold text-muted-foreground whitespace-nowrap">Liga</th>
                    <th className="text-left px-2 py-2 font-semibold text-muted-foreground whitespace-nowrap hidden sm:table-cell">Equipo</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground">PJ</th>
                    <th className="text-center px-2 py-2 font-semibold text-primary">PTS</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground">REB</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground">AST</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground hidden sm:table-cell">ROB</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground hidden sm:table-cell">TAP</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground hidden sm:table-cell">MIN</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground hidden md:table-cell">TC%</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground hidden md:table-cell">T3%</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground hidden md:table-cell">TL%</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonRows.map((row, i) => (
                    <tr
                      key={row.startYear}
                      className={`border-b border-primary/5 hover:bg-primary/5 transition-colors ${i === 0 ? "font-semibold" : ""}`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-medium">{row.seasonName}</span>
                        {i === 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 h-4">Actual</Badge>}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{row.leagueShortName?.toUpperCase()}</td>
                      <td className="px-2 py-2 hidden sm:table-cell text-muted-foreground max-w-[140px] truncate">{row.teamName}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{row.gamesPlayed}</td>
                      <td className="px-2 py-2 text-center tabular-nums text-primary font-semibold">{row.pts.toFixed(1)}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{row.reb.toFixed(1)}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{row.ast.toFixed(1)}</td>
                      <td className="px-2 py-2 text-center tabular-nums hidden sm:table-cell">{row.stl.toFixed(1)}</td>
                      <td className="px-2 py-2 text-center tabular-nums hidden sm:table-cell">{row.blk.toFixed(1)}</td>
                      <td className="px-2 py-2 text-center tabular-nums hidden sm:table-cell">{row.min.toFixed(1)}</td>
                      <td className="px-2 py-2 text-center tabular-nums hidden md:table-cell">
                        {row.fgPct != null ? `${(row.fgPct * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums hidden md:table-cell">
                        {row.fg3Pct != null ? `${(row.fg3Pct * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums hidden md:table-cell">
                        {row.ftPct != null ? `${(row.ftPct * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Valoración total PTS ── */}
      {hasValData && (
        <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 p-0.5 shadow-lg shadow-orange-200/40">
          <div className="rounded-[14px] bg-white px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Valoración de temporada</span>
              {gamesPlayed > 0 && <Badge variant="secondary" className="ml-auto">{gamesPlayed} partidos</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* PTS Total */}
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                <div className="text-3xl font-black text-orange-600 leading-none">
                  {ptsTotal !== null ? ptsTotal : (ptsAvg > 0 ? ptsAvg.toFixed(1) : "—")}
                </div>
                <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-1">
                  {ptsTotal !== null ? "PTS Total" : "PTS Prom."}
                </div>
                {ptsTotal !== null && ptsAvg > 0 && (
                  <div className="text-[10px] text-gray-400 mt-0.5">{ptsAvg.toFixed(1)} por partido</div>
                )}
              </div>
              {/* VAL Total */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                <div className="text-3xl font-black text-amber-600 leading-none">
                  {valTotal !== null ? valTotal : (valAvg > 0 ? valAvg.toFixed(1) : "—")}
                </div>
                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1">
                  {valTotal !== null ? "VAL Total" : "VAL Prom."}
                </div>
                {valTotal !== null && valAvg > 0 && (
                  <div className="text-[10px] text-gray-400 mt-0.5">{valAvg.toFixed(1)} por partido</div>
                )}
              </div>
            </div>
            {/* mini breakdown */}
            {valAvg > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                {[
                  { l: "PTS", v: ptsAvg },
                  { l: "REB", v: totReb },
                  { l: "AST", v: parseNum(s.assists) ?? 0 },
                  { l: "ROB", v: parseNum(s.steals) ?? 0 },
                  { l: "TAP", v: parseNum(s.blocks) ?? 0 },
                ].filter(x => x.v > 0).map(({ l, v }) => (
                  <span key={l} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] font-bold text-gray-600">
                    {l} {v.toFixed(1)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Basic stats grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Estadísticas básicas
            {s.gamesPlayed && <Badge variant="secondary" className="ml-1">{s.gamesPlayed} PJ</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
            <StatInput label="PJ" value={s.gamesPlayed} onChange={(v) => updateStats({ gamesPlayed: v })} />
            <StatInput label="MIN" value={s.minutes} onChange={(v) => updateStats({ minutes: v })} />
            <StatInput label="PTS" value={s.points} onChange={(v) => updateStats({ points: v })} />
            <StatInput label="REB-O" value={s.offReb} onChange={(v) => updateStats({ offReb: v })} />
            <StatInput label="REB-D" value={s.defReb} onChange={(v) => updateStats({ defReb: v })} />
            <StatInput label="AST" value={s.assists} onChange={(v) => updateStats({ assists: v })} />
            <StatInput label="ROB" value={s.steals} onChange={(v) => updateStats({ steals: v })} />
            <StatInput label="TAP" value={s.blocks} onChange={(v) => updateStats({ blocks: v })} />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            <StatInput label="PÉR" value={s.turnovers} onChange={(v) => updateStats({ turnovers: v })} />
            <StatInput label="FALT" value={s.fouls} onChange={(v) => updateStats({ fouls: v })} />
            <StatInput label="TC-M" value={s.fgMade} onChange={(v) => updateStats({ fgMade: v })} />
            <StatInput label="TC-I" value={s.fgAtt} onChange={(v) => updateStats({ fgAtt: v })} />
            <StatInput label="T3-M" value={s.t3Made} onChange={(v) => updateStats({ t3Made: v })} />
            <StatInput label="T3-I" value={s.t3Att} onChange={(v) => updateStats({ t3Att: v })} />
            <StatInput label="TL-M" value={s.ftMade} onChange={(v) => updateStats({ ftMade: v })} />
            <StatInput label="TL-I" value={s.ftAtt} onChange={(v) => updateStats({ ftAtt: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Shooting efficiency computed */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "TC%", value: fgPct },
          { label: "T3%", value: t3Pct },
          { label: "TL%", value: ftPct },
          { label: "eFG%", value: fmtPct(adv.eFG) },
          { label: "TS%", value: fmtPct(adv.tS) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-primary">{value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</div>
            {(label === "eFG%" || label === "TS%") && (
              <div className="text-[9px] text-muted-foreground/60 mt-0.5">calculado</div>
            )}
          </div>
        ))}
      </div>

      {/* Resumen display */}
      {(parseNum(s.points) !== null || totReb > 0 || parseNum(s.assists) !== null) && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "PTS", value: s.points },
            { label: "REB", value: totReb > 0 ? String(totReb) : "" },
            { label: "AST", value: s.assists },
            { label: "ROB", value: s.steals },
            { label: "TAP", value: s.blocks },
            { label: "MIN", value: s.minutes },
          ].map(({ label, value }) => (
            <div key={label} className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
              <div className="text-2xl font-display text-primary">{value || "—"}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Advanced stats — manual entry */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Estadísticas avanzadas
            <span className="text-xs font-normal text-muted-foreground">(entrada manual)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {([
              ["per", "PER"],
              ["ortg", "ORtg"],
              ["drtg", "DRtg"],
              ["netRtg", "Net Rtg"],
              ["usagePct", "Usage%"],
              ["pace", "Pace"],
            ] as const).map(([key, label]) => (
              <div key={key} className="bg-muted/40 border rounded-lg p-2 text-center">
                <Input
                  type="number" value={manual[key]}
                  onChange={(e) => updateAdvanced({ [key]: e.target.value })}
                  className="h-8 text-center text-base font-bold border-0 bg-transparent focus-visible:ring-0 p-0"
                  placeholder="—"
                />
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Scouting ───────────────────────────────────────────────────────────

function TabScouting({ profile, onUpdate }: {
  profile: ReturnType<typeof usePlayerProfile>["profile"];
  onUpdate: (p: Partial<typeof profile>) => void;
}) {
  const fields: [string, keyof typeof profile, string][] = [
    ["Tendencias ofensivas", "offensiveTendencies", "Tipos de movimientos, zonas de tiro preferidas, situaciones de 1vs1…"],
    ["Tendencias defensivas", "defensiveTendencies", "Posicionamiento, intensidad, tendencia al foul…"],
    ["Comportamiento en transición", "transitionBehavior", "Rapidez en transición ofensiva/defensiva, toma de decisiones en carrera…"],
    ["Toma de decisiones", "decisionMaking", "Velocidad de decisión, errores frecuentes, acierto en situaciones clave…"],
    ["Lectura táctica", "tacticalReading", "Comprensión del juego, anticipación, posicionamiento sin balón…"],
    ["Rendimiento bajo presión", "pressurePerformance", "Comportamiento en momentos decisivos, reacción al marcador adverso…"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(([label, key, placeholder]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                {key.includes("offensive") ? <Activity className="h-3.5 w-3.5 text-orange-500" /> :
                  key.includes("defensive") ? <Shield className="h-3.5 w-3.5 text-blue-500" /> :
                  key.includes("decision") ? <Brain className="h-3.5 w-3.5 text-purple-500" /> :
                  key.includes("tactical") ? <Target className="h-3.5 w-3.5 text-emerald-500" /> :
                  <Zap className="h-3.5 w-3.5 text-amber-500" />}
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={profile[key] as string}
                onChange={(e) => onUpdate({ [key]: e.target.value })}
                placeholder={placeholder}
                rows={4}
                className="text-sm resize-none"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Vídeos ─────────────────────────────────────────────────────────────

function TabVideos({ profile, addVideo, removeVideo }: {
  profile: ReturnType<typeof usePlayerProfile>["profile"];
  addVideo: ReturnType<typeof usePlayerProfile>["addVideo"];
  removeVideo: ReturnType<typeof usePlayerProfile>["removeVideo"];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<VideoEntry, "id">>({ url: "", title: "", category: "", tags: "", date: new Date().toISOString().split("T")[0] });
  const [playing, setPlaying] = useState<string | null>(null);

  const handleAdd = () => {
    if (!form.url || !form.title) return;
    addVideo(form);
    setForm({ url: "", title: "", category: "", tags: "", date: new Date().toISOString().split("T")[0] });
    setOpen(false);
  };

  const categories = ["Partido", "Entrenamiento", "Highlight", "Análisis", "Otro"];

  return (
    <div className="space-y-4">
      {!open ? (
        <Button onClick={() => setOpen(true)} className="font-display uppercase tracking-wide">
          <Plus className="h-4 w-4 mr-2" /> Añadir vídeo
        </Button>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2"><Video className="h-4 w-4 text-primary" /> Nuevo vídeo</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <SectionLabel>URL (YouTube / Vimeo)</SectionLabel>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://youtube.com/watch?v=…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <SectionLabel>Título</SectionLabel>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Descripción del clip" />
              </div>
              <div className="space-y-1">
                <SectionLabel>Fecha</SectionLabel>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <SectionLabel>Categoría</SectionLabel>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-9 text-sm border border-input rounded-md px-3 bg-background"
                >
                  <option value="">Seleccionar…</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <SectionLabel>Etiquetas</SectionLabel>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tiro, 1vs1, transición…" />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={!form.url || !form.title} className="w-full font-display uppercase">
              <Check className="h-4 w-4 mr-2" /> Guardar vídeo
            </Button>
          </CardContent>
        </Card>
      )}

      {profile.videos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Video className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Sin vídeos asociados todavía.</p>
          <p className="text-xs mt-1">Añade clips de YouTube o Vimeo para este jugador.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profile.videos.map((v) => {
            const thumb = getYtThumbnail(v.url);
            const embed = getEmbedUrl(v.url);
            return (
              <Card key={v.id} className="overflow-hidden">
                {playing === v.id && embed ? (
                  <div className="aspect-video">
                    <iframe src={embed} className="w-full h-full" allowFullScreen title={v.title} />
                  </div>
                ) : (
                  <button
                    className="relative w-full aspect-video bg-muted flex items-center justify-center group"
                    onClick={() => embed && setPlaying(v.id)}
                  >
                    {thumb ? (
                      <img src={thumb} alt={v.title} className="w-full h-full object-cover absolute inset-0" />
                    ) : null}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      {embed ? (
                        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                          <Video className="h-5 w-5 text-white ml-0.5" />
                        </div>
                      ) : (
                        <ExternalLink className="h-6 w-6 text-white" />
                      )}
                    </div>
                  </button>
                )}
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{v.title}</div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {v.category && <Badge variant="secondary" className="text-[10px] h-4 px-1">{v.category}</Badge>}
                        {v.tags && v.tags.split(",").map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] h-4 px-1">{t.trim()}</Badge>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">{v.date}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0" onClick={() => { if (playing === v.id) setPlaying(null); removeVideo(v.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {!embed && (
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-primary flex items-center gap-1 hover:underline">
                      <ExternalLink className="h-3 w-3" /> Ver enlace
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Comparador ─────────────────────────────────────────────────────────

function TabComparator({ playerId, playerA, profileA }: {
  playerId: number;
  playerA: { name: string; position: string; age?: number | null; height?: string | null; weight?: number | null; handedness?: string | null };
  profileA: ReturnType<typeof usePlayerProfile>["profile"];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: allPlayers } = useListPlayers({}, { query: { queryKey: getListPlayersQueryKey({}) } });

  const others = (allPlayers ?? []).filter((p) => p.id !== playerId);
  const playerB = others.find((p) => p.id === selectedId) ?? null;
  const profileB = selectedId ? getStoredProfile(selectedId) : null;

  const sA = profileA.seasonStats;
  const sB = profileB?.seasonStats ?? null;
  const aiResult = playerB && profileB
    ? generateAIComparison(
        playerA.name, sA, profileA.overallRating, profileA.potential,
        playerB.name, sB ?? { gamesPlayed: "", minutes: "", points: "", offReb: "", defReb: "", assists: "", steals: "", blocks: "", turnovers: "", fouls: "", fgMade: "", fgAtt: "", t3Made: "", t3Att: "", ftMade: "", ftAtt: "" },
        profileB.overallRating, profileB.potential,
      )
    : null;

  const statRows: [string, keyof SeasonStats, keyof SeasonStats, string][] = [
    ["Puntos", "points", "points", "ppg"],
    ["Rebotes of.", "offReb", "offReb", ""],
    ["Rebotes def.", "defReb", "defReb", ""],
    ["Asistencias", "assists", "assists", "apg"],
    ["Robos", "steals", "steals", "rpg"],
    ["Tapones", "blocks", "blocks", "bpg"],
    ["Pérdidas", "turnovers", "turnovers", ""],
    ["Minutos", "minutes", "minutes", "mpg"],
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <GitCompare className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <SectionLabel>Seleccionar jugador para comparar</SectionLabel>
              <select
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
                className="w-full h-10 text-sm border border-input rounded-md px-3 bg-background"
              >
                <option value="">— Seleccionar jugador —</option>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.position ? `(${p.position})` : ""} {p.teamName ? `— ${p.teamName}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!playerB ? (
        <div className="text-center py-16 text-muted-foreground">
          <GitCompare className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Selecciona un jugador para comparar.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Headers */}
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="text-center">
              <div className="text-lg font-bold truncate">{playerA.name}</div>
              <Badge>{playerA.position}</Badge>
            </div>
            <div className="text-center text-xs text-muted-foreground font-semibold uppercase tracking-widest">VS</div>
            <div className="text-center">
              <div className="text-lg font-bold truncate">{playerB.name}</div>
              <Badge variant="outline">{playerB.position}</Badge>
            </div>
          </div>

          {/* Physical */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Físico</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {([["Edad", playerA.age, playerB.age, " años"], ["Peso", playerA.weight, playerB.weight, " kg"]] as [string, number | null | undefined, number | null | undefined, string][]).map(([label, a, b, unit]) => (
                <CompareBar key={label} labelA={label} labelB={label} valA={a ?? null} valB={b ?? null} unit={unit} />
              ))}
              <div className="grid grid-cols-3 items-center py-1.5 border-b last:border-0 text-sm gap-2">
                <span className="text-right font-medium">{playerA.height || "—"}</span>
                <span className="text-[10px] text-muted-foreground uppercase text-center">Altura</span>
                <span className="font-medium">{playerB.height || "—"}</span>
              </div>
              <div className="grid grid-cols-3 items-center py-1.5 text-sm gap-2">
                <span className="text-right font-medium">{playerA.handedness || "—"}</span>
                <span className="text-[10px] text-muted-foreground uppercase text-center">Mano</span>
                <span className="font-medium">{playerB.handedness || "—"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Estadísticas</CardTitle></CardHeader>
            <CardContent>
              {statRows.map(([label, keyA, keyB, unit]) => (
                <CompareBar key={label} labelA={label} labelB={label}
                  valA={parseNum(sA[keyA])} valB={sB ? parseNum(sB[keyB]) : null} unit={unit} />
              ))}
            </CardContent>
          </Card>

          {/* Ratings */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Valoraciones (1–10)</CardTitle></CardHeader>
            <CardContent>
              {([["Valoración global", "overallRating"], ["Potencial", "potential"], ["Nivel actual", "currentLevel"]] as const).map(([label, key]) => (
                <CompareBar key={label} labelA={label} labelB={label}
                  valA={parseNum(profileA[key])} valB={parseNum(profileB![key])} />
              ))}
            </CardContent>
          </Card>

          {/* AI Summary */}
          {aiResult && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Resumen IA de scouting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2">
                      Ventajas de {playerA.name}
                    </div>
                    {aiResult.advantagesA.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin ventajas estadísticas claras sobre el rival.</p>
                    ) : (
                      <ul className="space-y-1">
                        {aiResult.advantagesA.map((a, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5">
                            <ChevronRight className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
                      Ventajas de {playerB.name}
                    </div>
                    {aiResult.advantagesB.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin ventajas estadísticas claras sobre el rival.</p>
                    ) : (
                      <ul className="space-y-1">
                        {aiResult.advantagesB.map((a, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5">
                            <ChevronRight className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Recomendación de scouting</div>
                  <p className="text-sm leading-relaxed">{aiResult.recommendation}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Historial ──────────────────────────────────────────────────────────

function TabHistory({ player, reports }: {
  player: { name: string };
  reports: Array<{ id: number; date?: string; scoutName: string; rating: number; summary?: string | null; strengths?: string | null; weaknesses?: string | null; gameName?: string | null }>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-3xl font-bold text-primary">{reports.length}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Informes registrados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-3xl font-bold text-primary">
              {reports.length > 0
                ? (reports.reduce((acc, r) => acc + r.rating, 0) / reports.length).toFixed(1)
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Rating medio</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-3xl font-bold text-primary">
              {reports.length > 0 ? reports[reports.length - 1].date : "—"}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Primer informe</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Línea de tiempo de informes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Sin informes. Los informes son opcionales — el perfil funciona independientemente.
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-muted space-y-4">
              {[...reports].reverse().map((r) => (
                <Link key={r.id} href={`/reports/${r.id}`}>
                  <div className="relative group cursor-pointer">
                    <div className="absolute -left-[29px] w-3 h-3 rounded-full bg-primary border-2 border-background" />
                    <div className="bg-card border rounded-lg p-3 hover:border-primary transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm group-hover:text-primary transition-colors">
                            {r.date} — {r.scoutName}
                          </div>
                          {r.gameName && <div className="text-xs text-muted-foreground">{r.gameName}</div>}
                          {(r.summary || r.strengths) && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {r.summary || r.strengths}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xl font-bold text-primary px-2 py-0.5 bg-primary/10 rounded">
                            {r.rating}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground text-center pt-2">
        Los informes son opcionales. Toda la información de la ficha se guarda automáticamente sin necesidad de generar informes.
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const TABS = [
  { id: "general", label: "General", icon: User },
  { id: "stats", label: "Estadísticas", icon: BarChart3 },
  { id: "scouting", label: "Scouting", icon: Target },
  { id: "videos", label: "Vídeos", icon: Video },
  { id: "comparador", label: "Comparador", icon: GitCompare },
  { id: "historial", label: "Historial", icon: History },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PlayerDetail() {
  const [, params] = useRoute("/players/:id");
  const playerId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("general");

  const { data: player, isLoading } = useGetPlayer(playerId, {
    query: { enabled: !!playerId, queryKey: getGetPlayerQueryKey(playerId) },
  });
  const { data: reports } = useListReports(
    { playerId },
    { query: { enabled: !!playerId, queryKey: getListReportsQueryKey({ playerId }) } },
  );
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();

  const { profile, update, updateStats, updateAdvanced, addVideo, removeVideo, saving, savedAt } =
    usePlayerProfile(playerId);

  const handlePhotoChange = (url: string) => {
    updatePlayer.mutate(
      { id: playerId, data: { photoUrl: url } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(playerId) });
          toast({ title: "Foto actualizada" });
        },
      },
    );
  };

  const handleDelete = () => {
    if (!confirm(`¿Eliminar a ${player?.name}? Esta acción no se puede deshacer.`)) return;
    deletePlayer.mutate(
      { id: playerId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey({}) });
          toast({ title: "Jugador eliminado" });
          setLocation("/jugadores");
        },
      },
    );
  };

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid grid-cols-6 gap-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  if (!player) return (
    <div className="text-center py-20 text-muted-foreground">Jugador no encontrado.</div>
  );

  const initials = player.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <div className="space-y-0">
      {/* ── Header banner ── */}
      <div className="rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white mb-5">
        <div className="p-5 md:p-6">
          <div className="flex items-start gap-5">
            {/* Back */}
            <Link href="/jugadores">
              <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0 mt-1">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            {/* Photo */}
            <div className="flex-shrink-0">
              <div className="h-20 w-20 rounded-full border-3 border-primary/50 overflow-hidden bg-primary/20 flex items-center justify-center relative">
                {player.photoUrl ? (
                  <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-2xl text-primary">{initials}</span>
                )}
                {player.jerseyNumber != null && (
                  <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-slate-900">
                    {player.jerseyNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                    {player.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge className="bg-primary text-primary-foreground font-mono">{player.position}</Badge>
                    {profile.secondaryPosition && (
                      <Badge variant="outline" className="border-white/30 text-white/80 text-xs">{profile.secondaryPosition}</Badge>
                    )}
                    <span className="text-white/60 text-sm">{player.teamName || "Agente libre"}</span>
                  </div>
                  <div className="flex gap-4 mt-2 text-sm text-white/70 flex-wrap">
                    {player.age && <span>{player.age} años</span>}
                    {player.height && <span>{player.height}</span>}
                    {player.weight && <span>{player.weight} kg</span>}
                    {player.nationality && <span>{player.nationality}</span>}
                    {player.handedness && <span>{player.handedness}</span>}
                  </div>
                </div>

                {/* Overall rating */}
                <div className="flex-shrink-0 text-center">
                  <div className="text-5xl font-black text-primary leading-none">
                    {profile.overallRating || "—"}
                  </div>
                  <div className="text-[10px] text-white/50 uppercase tracking-widest mt-1">Valoración</div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-4 flex-wrap items-center">
                <Link href={`/players/${playerId}/edit`}>
                  <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 font-display uppercase tracking-wide text-xs">
                    <Pencil className="h-3 w-3 mr-1.5" /> Editar info básica
                  </Button>
                </Link>
                <Link href={`/reports/new?playerId=${playerId}`}>
                  <Button size="sm" className="font-display uppercase tracking-wide text-xs">
                    <Plus className="h-3 w-3 mr-1.5" /> Informe
                  </Button>
                </Link>
                <div className="ml-auto flex items-center gap-2">
                  <SaveBadge saving={saving} savedAt={savedAt} />
                  <Button
                    size="sm" variant="ghost"
                    className="text-red-400 hover:bg-red-400/10 hover:text-red-300 h-8 w-8 p-0"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Photo upload row */}
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
            <PhotoUpload value={player.photoUrl} onChange={handlePhotoChange} shape="circle" size="sm" />
            <span className="text-xs text-white/40">Haz clic en la foto para actualizarla</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-white/10 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors flex-shrink-0 ${
                activeTab === id
                  ? "text-primary border-b-2 border-primary bg-white/5"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="pb-10">
        {activeTab === "general" && (
          <TabGeneral player={player} playerId={playerId} profile={profile} onUpdate={update} />
        )}
        {activeTab === "stats" && (
          <TabStats playerId={playerId} profile={profile} updateStats={updateStats} updateAdvanced={updateAdvanced} />
        )}
        {activeTab === "scouting" && (
          <TabScouting profile={profile} onUpdate={update} />
        )}
        {activeTab === "videos" && (
          <TabVideos profile={profile} addVideo={addVideo} removeVideo={removeVideo} />
        )}
        {activeTab === "comparador" && (
          <TabComparator playerId={playerId} playerA={player} profileA={profile} />
        )}
        {activeTab === "historial" && (
          <TabHistory player={player} reports={reports ?? []} />
        )}
      </div>
    </div>
  );
}
