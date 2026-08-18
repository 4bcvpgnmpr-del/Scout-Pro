import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useGetPlayer, useListReports, useDeletePlayer,
  useUpdatePlayer, useListPlayers,
  getGetPlayerQueryKey, getListReportsQueryKey, getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
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
import {
  ArrowLeft, Pencil, Trash2, Plus, Save, Check, X,
  Video, GitCompare, History, User, Target, Activity, 
  ExternalLink, ChevronRight, BarChart3, Zap, Shield, 
  Brain, Globe, Ruler, Scale, Hand, Hash,
  Star
} from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

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

function fmtPct(v: string | null): string { return v ? v + "%" : "—"; }

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
    <span className="text-xs font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1">
      <Save className="h-3 w-3 animate-pulse" /> Guardando…
    </span>
  );
  if (savedAt) return (
    <span className="text-xs font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1">
      <Check className="h-3 w-3" /> Guardado
    </span>
  );
  return null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{children}</div>
  );
}

function InlineTextarea({
  label, value, onChange, placeholder, rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <SectionLabel>{label}</SectionLabel>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? `${label}…`}
        rows={rows}
        className="text-sm resize-none bg-muted/20 border-border focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground"
      />
    </div>
  );
}

function StatInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="bg-muted/30 border border-border rounded-lg p-2 text-center transition-colors focus-within:border-primary/50 focus-within:bg-muted/50">
      <Input
        type="number" min="0" max="100" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-center text-sm font-bold border-0 bg-transparent focus-visible:ring-0 p-0 shadow-none text-foreground"
        placeholder="—"
      />
      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
        {label}
      </div>
    </div>
  );
}

function CircularGauge({ value }: { value: string | number }) {
  const v = parseNum(value) ?? 0;
  const pct = Math.min(100, Math.max(0, v));
  const color = pct >= 80 ? "#f59e0b" : pct >= 65 ? "#eab308" : "#94a3b8";
  const label = pct >= 80 ? "Jugador Importante" : pct >= 65 ? "Promesa" : "En Desarrollo";
  
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-28 w-28 mb-4">
        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 42}`}
            strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-black text-4xl text-foreground">
          {v || "—"}
        </span>
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valoración Global</div>
      <div className="text-xs font-black uppercase tracking-wider mt-1" style={{ color }}>{label}</div>
    </div>
  );
}

function InfoPair({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-muted/40 flex items-center justify-center shrink-0 border border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{label}</span>
        <span className="text-sm font-semibold text-foreground truncate">{value}</span>
      </div>
    </div>
  );
}

function CompareBar({ labelA, labelB, valA, valB, unit = "" }: {
  labelA: string; labelB: string; valA: number | null; valB: number | null; unit?: string;
}) {
  const max = Math.max(valA ?? 0, valB ?? 0, 1);
  const pA = valA !== null ? (valA / max) * 100 : 0;
  const pB = valB !== null ? (valB / max) * 100 : 0;
  const colorA = (valA ?? 0) >= (valB ?? 0) ? "bg-primary" : "bg-muted-foreground/40";
  const colorB = (valB ?? 0) > (valA ?? 0) ? "bg-primary" : "bg-muted-foreground/40";
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex flex-col items-end gap-1.5 min-w-0">
        <span className="text-sm font-bold text-foreground">{valA !== null ? `${valA.toFixed(1)}${unit}` : "—"}</span>
        <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden flex justify-end">
          <div className={`h-full rounded-full transition-all ${colorA}`} style={{ width: `${pA}%` }} />
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-widest text-center whitespace-nowrap px-3 font-bold">{labelA}</span>
      <div className="flex flex-col items-start gap-1.5 min-w-0">
        <span className="text-sm font-bold text-foreground">{valB !== null ? `${valB.toFixed(1)}${unit}` : "—"}</span>
        <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${colorB}`} style={{ width: `${pB}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab: General ────────────────────────────────────────────────────────────

function TabGeneral({ player, profile, onUpdate, setActiveTab }: {
  player: any;
  profile: ReturnType<typeof usePlayerProfile>["profile"];
  onUpdate: (p: Partial<typeof profile>) => void;
  setActiveTab: (id: string) => void;
}) {
  const s = profile.seasonStats;
  const games = parseNum(s.gamesPlayed) ?? 0;
  const totReb = (parseNum(s.offReb) ?? 0) + (parseNum(s.defReb) ?? 0);
  
  const fmtTotal = (g: number, avg: string | undefined | null) => {
    const a = parseNum(avg);
    if (g > 0 && a !== null) return Math.round(g * a);
    return "-";
  };

  const fgPct = parseNum(s.fgMade) !== null && parseNum(s.fgAtt) && parseNum(s.fgAtt)! > 0
    ? ((parseNum(s.fgMade)! / parseNum(s.fgAtt)!) * 100).toFixed(1) + "%" : "—";
  const t3Pct = parseNum(s.t3Made) !== null && parseNum(s.t3Att) && parseNum(s.t3Att)! > 0
    ? ((parseNum(s.t3Made)! / parseNum(s.t3Att)!) * 100).toFixed(1) + "%" : "—";
  const ftPct = parseNum(s.ftMade) !== null && parseNum(s.ftAtt) && parseNum(s.ftAtt)! > 0
    ? ((parseNum(s.ftMade)! / parseNum(s.ftAtt)!) * 100).toFixed(1) + "%" : "—";

  // Compute Radar Data
  const rPts = Math.min(100, Math.round(((parseNum(s.points) ?? 0) / 25) * 100));
  const rReb = Math.min(100, Math.round((totReb / 12) * 100));
  const rAst = Math.min(100, Math.round(((parseNum(s.assists) ?? 0) / 8) * 100));
  const rDef = parseNum(profile.defensiveRating) ?? 50;
  const rFis = parseNum(profile.athleticism) ?? 50;
  const rVis = parseNum(profile.bbIQ) ?? 50;

  const radarData = [
    { subject: 'Anotación', A: rPts },
    { subject: 'Rebote', A: rReb },
    { subject: 'Pase', A: rAst },
    { subject: 'Defensa', A: rDef },
    { subject: 'Físico', A: rFis },
    { subject: 'Visión', A: rVis },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
      
      {/* Left: Role Panel */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-widest">Perfil & Rol</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <InlineTextarea label="Rol en el equipo" value={profile.role} onChange={v => onUpdate({role: v})} placeholder="Ej: Especialista defensivo" rows={1} />
            <InlineTextarea label="Estilo de juego" value={profile.playStyle} onChange={v => onUpdate({playStyle: v})} placeholder="Ej: 3&D" rows={1} />
          </div>

          <div className="space-y-2 mt-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
               <Check className="h-3 w-3 text-emerald-500" /> Fortalezas
            </div>
            <Textarea 
              value={profile.strengths || ''} 
              onChange={e => onUpdate({strengths: e.target.value})} 
              className="bg-muted/20 border-border text-sm resize-none focus-visible:ring-1 focus-visible:ring-emerald-500/50" 
              rows={3} 
              placeholder="Añade fortalezas (una por línea)..."
            />
          </div>

          <div className="space-y-2 mt-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
               <X className="h-3 w-3 text-red-500" /> Debilidades
            </div>
            <Textarea 
              value={profile.weaknesses || ''} 
              onChange={e => onUpdate({weaknesses: e.target.value})} 
              className="bg-muted/20 border-border text-sm resize-none focus-visible:ring-1 focus-visible:ring-red-500/50" 
              rows={3} 
              placeholder="Añade debilidades (una por línea)..."
            />
          </div>

          <div className="space-y-2 mt-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
               <Brain className="h-3 w-3 text-purple-500" /> Notas del entrenador
            </div>
            <Textarea 
              value={profile.technicalNotes || ''} 
              onChange={e => onUpdate({technicalNotes: e.target.value})} 
              className="bg-muted/20 border-border text-sm resize-none focus-visible:ring-1 focus-visible:ring-purple-500/50" 
              rows={3} 
              placeholder="Observaciones adicionales..."
            />
          </div>
        </div>
      </div>
      
      {/* Center: Radar Chart */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col h-full shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3 mb-4 shrink-0">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-widest">Scouting Radar</h3>
          </div>
          
          <div className="flex-1 min-h-[320px] flex items-center justify-center -mx-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11, fontWeight: "bold" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Atributos"
                  dataKey="A"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-4 border-t border-border shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex justify-between items-center">
               <span>Editar Atributos (0-100)</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <StatInput label="Global" value={profile.overallRating} onChange={v => onUpdate({overallRating: v})} />
              <StatInput label="Defensa" value={profile.defensiveRating} onChange={v => onUpdate({defensiveRating: v})} />
              <StatInput label="Físico" value={profile.athleticism} onChange={v => onUpdate({athleticism: v})} />
              <StatInput label="Visión" value={profile.bbIQ} onChange={v => onUpdate({bbIQ: v})} />
              <StatInput label="Potencial" value={profile.potential} onChange={v => onUpdate({potential: v})} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Right: Season Stats Table */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-card border border-border rounded-xl p-5 h-full shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Estadísticas Temporada</h3>
            </div>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground" onClick={() => setActiveTab('stats')}>
              Editar →
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase tracking-widest">
                  <th className="pb-2.5 font-bold">Métrica</th>
                  <th className="pb-2.5 text-center font-bold">Total</th>
                  <th className="pb-2.5 text-right font-bold">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {[
                  ['Partidos', games, '-'],
                  ['Minutos', fmtTotal(games, s.minutes), s.minutes],
                  ['Puntos', fmtTotal(games, s.points), s.points],
                  ['Rebotes', games > 0 && totReb > 0 ? (games * totReb).toFixed(0) : '-', totReb > 0 ? totReb.toFixed(1) : '-'],
                  ['Asistencias', fmtTotal(games, s.assists), s.assists],
                  ['Robos', fmtTotal(games, s.steals), s.steals],
                  ['Tapones', fmtTotal(games, s.blocks), s.blocks],
                  ['Pérdidas', fmtTotal(games, s.turnovers), s.turnovers],
                  ['Faltas', fmtTotal(games, s.fouls), s.fouls],
                  ['FG%', '-', fgPct],
                  ['3P%', '-', t3Pct],
                  ['FT%', '-', ftPct],
                ].map(([label, total, avg]) => (
                  <tr key={label} className="hover:bg-muted/30 transition-colors">
                     <td className="py-2.5 text-muted-foreground font-semibold">{label}</td>
                     <td className="py-2.5 text-center font-mono font-medium text-foreground/80">{total === 'NaN' || total === 0 ? '-' : total || '-'}</td>
                     <td className="py-2.5 text-right font-mono font-bold text-foreground text-sm">{avg || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
  const manual = profile.advancedStats;

  return (
    <div className="space-y-6 mt-6">
      {seasonRows && seasonRows.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-widest">Estadísticas por temporada (FEB)</h3>
          </div>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase tracking-widest">
                  <th className="text-left px-3 pb-2 font-bold">Temporada</th>
                  <th className="text-left px-2 pb-2 font-bold">Liga</th>
                  <th className="text-left px-2 pb-2 font-bold hidden sm:table-cell">Equipo</th>
                  <th className="text-center px-2 pb-2 font-bold">PJ</th>
                  <th className="text-center px-2 pb-2 font-bold text-primary">PTS</th>
                  <th className="text-center px-2 pb-2 font-bold">REB</th>
                  <th className="text-center px-2 pb-2 font-bold">AST</th>
                  <th className="text-center px-2 pb-2 font-bold hidden sm:table-cell">ROB</th>
                  <th className="text-center px-2 pb-2 font-bold hidden sm:table-cell">TAP</th>
                  <th className="text-center px-2 pb-2 font-bold hidden sm:table-cell">MIN</th>
                  <th className="text-center px-2 pb-2 font-bold hidden md:table-cell">TC%</th>
                  <th className="text-center px-2 pb-2 font-bold hidden md:table-cell">T3%</th>
                  <th className="text-center px-2 pb-2 font-bold hidden md:table-cell">TL%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {seasonRows.map((row, i) => (
                  <tr key={row.startYear} className={`hover:bg-muted/30 transition-colors ${i === 0 ? "font-bold" : "font-medium"}`}>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {row.seasonName}
                      {i === 0 && <Badge variant="secondary" className="ml-2 text-[9px] py-0 h-4 uppercase bg-primary/20 text-primary border-0">Actual</Badge>}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">{row.leagueShortName?.toUpperCase()}</td>
                    <td className="px-2 py-3 hidden sm:table-cell text-muted-foreground truncate max-w-[140px]">{row.teamName}</td>
                    <td className="px-2 py-3 text-center tabular-nums">{row.gamesPlayed}</td>
                    <td className="px-2 py-3 text-center tabular-nums text-primary font-bold text-sm">{row.pts.toFixed(1)}</td>
                    <td className="px-2 py-3 text-center tabular-nums">{row.reb.toFixed(1)}</td>
                    <td className="px-2 py-3 text-center tabular-nums">{row.ast.toFixed(1)}</td>
                    <td className="px-2 py-3 text-center tabular-nums hidden sm:table-cell">{row.stl.toFixed(1)}</td>
                    <td className="px-2 py-3 text-center tabular-nums hidden sm:table-cell">{row.blk.toFixed(1)}</td>
                    <td className="px-2 py-3 text-center tabular-nums hidden sm:table-cell">{row.min.toFixed(1)}</td>
                    <td className="px-2 py-3 text-center tabular-nums hidden md:table-cell">{row.fgPct != null ? `${(row.fgPct * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-2 py-3 text-center tabular-nums hidden md:table-cell">{row.fg3Pct != null ? `${(row.fg3Pct * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-2 py-3 text-center tabular-nums hidden md:table-cell">{row.ftPct != null ? `${(row.ftPct * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Estadísticas básicas <span className="text-muted-foreground font-normal ml-2 lowercase tracking-normal">(entrada manual)</span></h3>
        </div>
        
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mb-4">
          <StatInput label="Partidos" value={s.gamesPlayed} onChange={(v) => updateStats({ gamesPlayed: v })} />
          <StatInput label="Minutos" value={s.minutes} onChange={(v) => updateStats({ minutes: v })} />
          <StatInput label="Puntos" value={s.points} onChange={(v) => updateStats({ points: v })} />
          <StatInput label="Reb Of." value={s.offReb} onChange={(v) => updateStats({ offReb: v })} />
          <StatInput label="Reb Def." value={s.defReb} onChange={(v) => updateStats({ defReb: v })} />
          <StatInput label="Asist." value={s.assists} onChange={(v) => updateStats({ assists: v })} />
          <StatInput label="Robos" value={s.steals} onChange={(v) => updateStats({ steals: v })} />
          <StatInput label="Tapones" value={s.blocks} onChange={(v) => updateStats({ blocks: v })} />
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          <StatInput label="Pérdidas" value={s.turnovers} onChange={(v) => updateStats({ turnovers: v })} />
          <StatInput label="Faltas" value={s.fouls} onChange={(v) => updateStats({ fouls: v })} />
          <StatInput label="TC Met." value={s.fgMade} onChange={(v) => updateStats({ fgMade: v })} />
          <StatInput label="TC Int." value={s.fgAtt} onChange={(v) => updateStats({ fgAtt: v })} />
          <StatInput label="T3 Met." value={s.t3Made} onChange={(v) => updateStats({ t3Made: v })} />
          <StatInput label="T3 Int." value={s.t3Att} onChange={(v) => updateStats({ t3Att: v })} />
          <StatInput label="TL Met." value={s.ftMade} onChange={(v) => updateStats({ ftMade: v })} />
          <StatInput label="TL Int." value={s.ftAtt} onChange={(v) => updateStats({ ftAtt: v })} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Estadísticas avanzadas <span className="text-muted-foreground font-normal ml-2 lowercase tracking-normal">(entrada manual)</span></h3>
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {([
            ["per", "PER"],
            ["ortg", "ORtg"],
            ["drtg", "DRtg"],
            ["netRtg", "Net Rtg"],
            ["usagePct", "Usage%"],
            ["pace", "Pace"],
          ] as const).map(([key, label]) => (
            <StatInput key={key} label={label} value={manual[key]} onChange={(v) => updateAdvanced({ [key]: v })} />
          ))}
        </div>
      </div>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {fields.map(([label, key, placeholder]) => (
        <div key={key} className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
            {key.includes("offensive") ? <Activity className="h-4 w-4 text-orange-500" /> :
             key.includes("defensive") ? <Shield className="h-4 w-4 text-blue-500" /> :
             key.includes("decision") ? <Brain className="h-4 w-4 text-purple-500" /> :
             key.includes("tactical") ? <Target className="h-4 w-4 text-emerald-500" /> :
             <Zap className="h-4 w-4 text-amber-500" />}
            <h3 className="text-xs font-bold uppercase tracking-widest">{label}</h3>
          </div>
          <Textarea
            value={profile[key] as string}
            onChange={(e) => onUpdate({ [key]: e.target.value })}
            placeholder={placeholder}
            rows={4}
            className="text-sm resize-none bg-muted/20 border-border focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground"
          />
        </div>
      ))}
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
    <div className="space-y-6 mt-6">
      {!open ? (
        <Button onClick={() => setOpen(true)} className="font-display uppercase tracking-wide">
          <Plus className="h-4 w-4 mr-2" /> Añadir vídeo
        </Button>
      ) : (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm max-w-2xl">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Nuevo vídeo</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-6 w-6"><X className="h-4 w-4" /></Button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <SectionLabel>URL (YouTube / Vimeo)</SectionLabel>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://youtube.com/watch?v=…" className="bg-muted/20 border-border text-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <SectionLabel>Título</SectionLabel>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Descripción del clip" className="bg-muted/20 border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <SectionLabel>Fecha</SectionLabel>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-muted/20 border-border text-foreground" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <SectionLabel>Categoría</SectionLabel>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-9 text-sm border border-border rounded-md px-3 bg-muted/20 text-foreground"
                >
                  <option value="" className="bg-background text-foreground">Seleccionar…</option>
                  {categories.map((c) => <option key={c} value={c} className="bg-background text-foreground">{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <SectionLabel>Etiquetas</SectionLabel>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tiro, 1vs1, transición…" className="bg-muted/20 border-border text-foreground" />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={!form.url || !form.title} className="w-full font-display uppercase tracking-wide mt-2">
              <Check className="h-4 w-4 mr-2" /> Guardar vídeo
            </Button>
          </div>
        </div>
      )}

      {profile.videos.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-xl bg-card/50">
          <Video className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-semibold">Sin vídeos asociados todavía.</p>
          <p className="text-xs mt-1">Añade clips de YouTube o Vimeo para este jugador.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {profile.videos.map((v) => {
            const thumb = getYtThumbnail(v.url);
            const embed = getEmbedUrl(v.url);
            return (
              <div key={v.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
                {playing === v.id && embed ? (
                  <div className="aspect-video bg-black">
                    <iframe src={embed} className="w-full h-full" allowFullScreen title={v.title} />
                  </div>
                ) : (
                  <button
                    className="relative w-full aspect-video bg-muted/30 flex items-center justify-center group overflow-hidden"
                    onClick={() => embed && setPlaying(v.id)}
                  >
                    {thumb ? (
                      <img src={thumb} alt={v.title} className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105" />
                    ) : null}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                      {embed ? (
                        <div className="h-14 w-14 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-sm shadow-lg group-hover:scale-110 transition-transform">
                          <Video className="h-6 w-6 text-white ml-0.5" />
                        </div>
                      ) : (
                        <ExternalLink className="h-8 w-8 text-white/80 group-hover:text-white" />
                      )}
                    </div>
                  </button>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate text-foreground">{v.title}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{v.date}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => { if (playing === v.id) setPlaying(null); removeVideo(v.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex gap-1.5 flex-wrap mt-auto pt-2">
                    {v.category && <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-0 text-[9px] uppercase tracking-wider px-1.5 py-0 h-5">{v.category}</Badge>}
                    {v.tags && v.tags.split(",").map((t) => (
                      <Badge key={t} variant="outline" className="border-border text-muted-foreground text-[9px] uppercase tracking-wider px-1.5 py-0 h-5">{t.trim()}</Badge>
                    ))}
                  </div>
                  
                  {!embed && (
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="mt-3 text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 hover:text-primary/80 transition-colors">
                      <ExternalLink className="h-3 w-3" /> Ver enlace
                    </a>
                  )}
                </div>
              </div>
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
  playerA: any;
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
    <div className="space-y-6 mt-6">
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm max-w-2xl">
        <div className="flex items-center gap-3">
          <GitCompare className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <SectionLabel>Seleccionar jugador para comparar</SectionLabel>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-10 text-sm border border-border rounded-md px-3 bg-muted/20 text-foreground font-semibold"
            >
              <option value="" className="bg-background text-foreground">— Seleccionar jugador —</option>
              {others.map((p) => (
                <option key={p.id} value={p.id} className="bg-background text-foreground">
                  {p.name} {p.position ? `(${p.position})` : ""} {p.teamName ? `— ${p.teamName}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!playerB ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-xl bg-card/50">
          <GitCompare className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-semibold">Selecciona un jugador para comparar.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Headers */}
          <div className="grid grid-cols-3 items-center gap-6">
            <div className="text-center bg-card border border-border rounded-xl p-5">
              <div className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground truncate mb-2">{playerA.name}</div>
              <Badge className="bg-primary text-primary-foreground font-display uppercase tracking-wider text-sm">{playerA.position}</Badge>
            </div>
            <div className="text-center text-sm text-muted-foreground font-black uppercase tracking-widest bg-muted/20 py-2 rounded-full w-12 mx-auto">VS</div>
            <div className="text-center bg-card border border-border rounded-xl p-5">
              <div className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground truncate mb-2">{playerB.name}</div>
              <Badge variant="outline" className="border-border text-muted-foreground font-display uppercase tracking-wider text-sm">{playerB.position}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Physical */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
                <User className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Físico</h3>
              </div>
              <div className="space-y-1">
                {([["Edad", playerA.age, playerB.age, " años"], ["Peso", playerA.weight, playerB.weight, " kg"]] as [string, number | null | undefined, number | null | undefined, string][]).map(([label, a, b, unit]) => (
                  <CompareBar key={label} labelA={label} labelB={label} valA={a ?? null} valB={b ?? null} unit={unit} />
                ))}
                <div className="grid grid-cols-3 items-center py-2.5 border-b border-border last:border-0 gap-3">
                  <span className="text-right font-bold text-foreground">{playerA.height || "—"}</span>
                  <span className="text-[10px] text-muted-foreground uppercase text-center font-bold tracking-widest">Altura</span>
                  <span className="font-bold text-foreground">{playerB.height || "—"}</span>
                </div>
                <div className="grid grid-cols-3 items-center py-2.5 gap-3">
                  <span className="text-right font-bold text-foreground">{playerA.handedness || "—"}</span>
                  <span className="text-[10px] text-muted-foreground uppercase text-center font-bold tracking-widest">Mano</span>
                  <span className="font-bold text-foreground">{playerB.handedness || "—"}</span>
                </div>
              </div>
            </div>

            {/* Ratings */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
                <Star className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Valoraciones (0–100)</h3>
              </div>
              <div className="space-y-1">
                {([["Global", "overallRating"], ["Potencial", "potential"], ["Nivel actual", "currentLevel"]] as const).map(([label, key]) => (
                  <CompareBar key={label} labelA={label} labelB={label}
                    valA={parseNum(profileA[key])} valB={parseNum(profileB![key])} />
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Estadísticas</h3>
            </div>
            <div className="space-y-1">
              {statRows.map(([label, keyA, keyB, unit]) => (
                <CompareBar key={label} labelA={label} labelB={label}
                  valA={parseNum(sA[keyA])} valB={sB ? parseNum(sB[keyB]) : null} unit={unit} />
              ))}
            </div>
          </div>

          {/* AI Summary */}
          {aiResult && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-primary/20 pb-3 mb-5">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Resumen IA de scouting</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-background/50 border border-border rounded-lg p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-3 flex items-center gap-1.5">
                    <Check className="h-3 w-3" /> Ventajas de {playerA.name}
                  </div>
                  {aiResult.advantagesA.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sin ventajas estadísticas claras.</p>
                  ) : (
                    <ul className="space-y-2">
                      {aiResult.advantagesA.map((a, i) => (
                        <li key={i} className="text-xs font-medium flex items-start gap-2 text-foreground/90">
                          <ChevronRight className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-3 flex items-center gap-1.5">
                    <Check className="h-3 w-3" /> Ventajas de {playerB.name}
                  </div>
                  {aiResult.advantagesB.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sin ventajas estadísticas claras.</p>
                  ) : (
                    <ul className="space-y-2">
                      {aiResult.advantagesB.map((a, i) => (
                        <li key={i} className="text-xs font-medium flex items-start gap-2 text-foreground/90">
                          <ChevronRight className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              
              <div className="bg-background/80 border border-primary/20 rounded-lg p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Recomendación de scouting</div>
                <p className="text-sm leading-relaxed font-medium text-foreground">{aiResult.recommendation}</p>
              </div>
            </div>
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
    <div className="space-y-6 mt-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="text-4xl font-black text-primary">{reports.length}</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Informes registrados</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="text-4xl font-black text-primary">
            {reports.length > 0
              ? (reports.reduce((acc, r) => acc + r.rating, 0) / reports.length).toFixed(1)
              : "—"}
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Rating medio</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="text-2xl font-black text-primary truncate w-full px-2">
            {reports.length > 0 ? reports[reports.length - 1].date : "—"}
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Primer informe</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3 mb-6">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Línea de tiempo de informes</h3>
        </div>
        
        {reports.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-xl bg-background/50">
            Sin informes. Los informes son opcionales — el perfil funciona independientemente.
          </div>
        ) : (
          <div className="relative pl-6 border-l-2 border-border space-y-6 ml-2">
            {[...reports].reverse().map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`}>
                <div className="relative group cursor-pointer">
                  <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-card group-hover:scale-125 transition-transform" />
                  <div className="bg-background border border-border rounded-lg p-4 hover:border-primary/50 transition-colors shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                          {r.date} <span className="text-muted-foreground text-xs font-medium">— {r.scoutName}</span>
                        </div>
                        {r.gameName && <div className="text-xs font-semibold text-muted-foreground mt-1">{r.gameName}</div>}
                        {(r.summary || r.strengths) && (
                          <div className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                            {r.summary || r.strengths}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-2xl font-black text-primary px-3 py-1 bg-primary/10 rounded-md">
                          {r.rating}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center pt-2">
        Los informes son opcionales. La ficha se guarda automáticamente.
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
  { id: "comparador", label: "Comparar", icon: GitCompare },
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
    <div className="dark bg-[#0a0f1a] text-slate-50 min-h-[calc(100vh-4rem)] -m-4 sm:-m-8 p-4 sm:p-8 font-sans">
      <div className="space-y-6">
        <Skeleton className="h-56 rounded-2xl bg-white/5" />
        <div className="grid grid-cols-6 gap-2"><Skeleton className="h-24 rounded-xl bg-white/5 col-span-6" /></div>
        <Skeleton className="h-96 rounded-2xl bg-white/5" />
      </div>
    </div>
  );

  if (!player) return (
    <div className="dark bg-[#0a0f1a] text-slate-50 min-h-[calc(100vh-4rem)] -m-4 sm:-m-8 p-4 sm:p-8 flex items-center justify-center">
      <div className="text-muted-foreground font-display text-2xl uppercase tracking-widest">Jugador no encontrado</div>
    </div>
  );

  const initials = player.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

  // Compute stat bar values
  const s = profile.seasonStats;
  const totReb = (parseNum(s.offReb) ?? 0) + (parseNum(s.defReb) ?? 0);
  const fgPct = parseNum(s.fgMade) !== null && parseNum(s.fgAtt) && parseNum(s.fgAtt)! > 0
    ? ((parseNum(s.fgMade)! / parseNum(s.fgAtt)!) * 100).toFixed(1)
    : "—";
  const t3Pct = parseNum(s.t3Made) !== null && parseNum(s.t3Att) && parseNum(s.t3Att)! > 0
    ? ((parseNum(s.t3Made)! / parseNum(s.t3Att)!) * 100).toFixed(1)
    : "—";
  const ftPct = parseNum(s.ftMade) !== null && parseNum(s.ftAtt) && parseNum(s.ftAtt)! > 0
    ? ((parseNum(s.ftMade)! / parseNum(s.ftAtt)!) * 100).toFixed(1)
    : "—";

  const statBarItems = [
    { label: "PPG", value: s.points, highlight: true },
    { label: "RPG", value: totReb > 0 ? totReb.toFixed(1) : "—", highlight: false },
    { label: "APG", value: s.assists, highlight: false },
    { label: "FG%", value: fgPct !== "—" ? `${fgPct}%` : "—", highlight: false },
    { label: "3P%", value: t3Pct !== "—" ? `${t3Pct}%` : "—", highlight: false },
    { label: "FT%", value: ftPct !== "—" ? `${ftPct}%` : "—", highlight: false },
  ];

  return (
    <div className="dark flex flex-col font-sans -m-4 sm:-m-8 p-4 sm:p-8 bg-[#0a0f1a] text-slate-200 min-h-[calc(100vh-4rem)]">
      
      {/* ── Hero Section ── */}
      <div className="flex flex-col md:flex-row gap-6 bg-card border border-border rounded-2xl p-6 mb-6 shadow-lg relative">
        {/* Back Button (Absolute if we want it out of the flow, but let's put it on top) */}
        <Link href="/jugadores" className="absolute top-4 left-4 z-10 md:hidden">
          <Button variant="ghost" size="icon" className="text-white/70 hover:text-white bg-black/20 backdrop-blur">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        {/* Left: Photo */}
        <div className="w-full md:w-56 shrink-0 relative rounded-xl overflow-hidden bg-background border border-border aspect-[3/4]">
          {player.photoUrl ? (
            <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-7xl font-black text-muted-foreground/20">{initials}</span>
              {player.jerseyNumber != null && (
                <span className="absolute bottom-3 right-3 text-5xl font-display text-primary/80 leading-none">
                  #{player.jerseyNumber}
                </span>
              )}
            </div>
          )}
          <div className="absolute top-2 right-2 z-10 opacity-70 hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-sm rounded-full">
            <PhotoUpload value={player.photoUrl} onChange={handlePhotoChange} shape="circle" size="sm" />
          </div>
        </div>

        {/* Center: Info */}
        <div className="flex-1 flex flex-col justify-between py-2 min-w-0">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase text-foreground truncate">{player.name}</h1>
              <Badge className="bg-primary text-primary-foreground font-display text-lg uppercase tracking-wider px-3 py-1">
                {player.position}
              </Badge>
              {profile.secondaryPosition && (
                <Badge variant="outline" className="border-border text-muted-foreground uppercase text-xs font-bold tracking-widest px-2 py-1">
                  {profile.secondaryPosition}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4 mt-8">
              <InfoPair icon={User} label="Edad" value={player.age ? `${player.age} años` : "—"} />
              <InfoPair icon={Globe} label="Nacionalidad" value={player.nationality || "—"} />
              <InfoPair icon={Ruler} label="Altura" value={player.height || "—"} />
              <InfoPair icon={Scale} label="Peso" value={player.weight ? `${player.weight} kg` : "—"} />
              <InfoPair icon={Hand} label="Mano" value={player.handedness || "—"} />
              <InfoPair icon={Shield} label="Equipo" value={player.teamName || "Agente libre"} />
              <InfoPair icon={Hash} label="Dorsal" value={player.jerseyNumber ? `#${player.jerseyNumber}` : "—"} />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border flex-wrap">
            <Button variant="outline" className="border-border text-foreground hover:bg-muted font-display uppercase tracking-wide" onClick={() => setActiveTab('comparador')}>
              <GitCompare className="h-4 w-4 mr-2" /> Comparar jugador
            </Button>
            <Button className="font-display uppercase tracking-wide text-primary-foreground" asChild>
              <Link href={`/reports/new?playerId=${playerId}`}>
                <Plus className="h-4 w-4 mr-2" /> Generar informe
              </Link>
            </Button>
            <div className="ml-auto flex items-center gap-4">
              <SaveBadge saving={saving} savedAt={savedAt} />
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/20 h-10 w-10 shrink-0" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Gauge */}
        <div className="w-full md:w-56 shrink-0 flex flex-col items-center justify-center bg-background border border-border rounded-xl p-6">
          <CircularGauge value={profile.overallRating} />
        </div>
      </div>

      {/* ── Key Stats Bar ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 border border-border bg-card rounded-2xl overflow-hidden mb-6 shadow-sm">
        {statBarItems.map((item, i) => (
          <div key={i} className={`flex flex-col items-center justify-center py-5 px-2 hover:bg-muted/30 transition-colors ${i > 0 ? 'border-l border-border' : ''}`}>
            <span className={`text-3xl lg:text-4xl font-black ${item.highlight ? 'text-primary' : 'text-foreground'}`}>
              {item.value || "—"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-border overflow-x-auto mb-2 no-scrollbar bg-card rounded-t-xl px-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all flex-shrink-0 relative ${
              activeTab === id
                ? "text-primary bg-muted/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {activeTab === id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="pb-10 flex-1">
        {activeTab === "general" && (
          <TabGeneral player={player} profile={profile} onUpdate={update} setActiveTab={setActiveTab} />
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
