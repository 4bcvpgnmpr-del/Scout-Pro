import { useState, useCallback, useMemo } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetGame, useListTeams, useListPlayers, useListGames,
  useUpdatePlayer, useGetPlayerStats,
  getGetGameQueryKey, getListTeamsQueryKey, getListPlayersQueryKey,
  getListGamesQueryKey, getGetPlayerStatsQueryKey, getGetPlayerQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Calendar, MapPin, Star, CheckCircle2, Circle,
  Download, Loader2, Users, Video, Swords, BarChart2, Target,
  Shield, TrendingUp, Plus, Trash2, FileText, MessageSquare,
  Activity, Pencil, Trophy, Zap, BookOpen, ChevronRight, Camera,
  Search, Library, Hash, SlidersHorizontal, CheckCheck,
} from "lucide-react";
import { useExportPdf } from "@/hooks/use-export-pdf";
import { useToast } from "@/hooks/use-toast";
import { GameReportExportButton } from "@/components/pdf/game-report-pdf";
import { uploadPhotoFile } from "@/components/photo-upload";
import { DIFFICULTY_LABEL } from "@/lib/difficulty";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "resumen" | "scouting" | "plantilla" | "videos" | "playbook" | "estadisticas" | "informe" | "tareas";

type ScoutingData = {
  clavesPartido: string; jugadorasDestacadas: string;
  sistemas: string; ritmo: string; generadoras: string; ataqueObs: string;
  tipoDefensa: string; presion: string; pickRoll: string; zona: string; defensaObs: string;
  contraataque: string; balance: string; transicionObs: string;
  fortalezas: string[]; debilidades: string[];
  objetivos: string; notasEntrenador: string;
};
const DEFAULT_SCOUTING: ScoutingData = {
  clavesPartido: "", jugadorasDestacadas: "",
  sistemas: "", ritmo: "", generadoras: "", ataqueObs: "",
  tipoDefensa: "", presion: "", pickRoll: "", zona: "", defensaObs: "",
  contraataque: "", balance: "", transicionObs: "",
  fortalezas: [], debilidades: [],
  objetivos: "", notasEntrenador: "",
};
type Checklist = { scouting: boolean; videos: boolean; informe: boolean; charla: boolean };
const DEFAULT_CHECKLIST: Checklist = { scouting: false, videos: false, informe: false, charla: false };

// ── Local storage helpers ─────────────────────────────────────────────────────
function loadScouting(id: number): ScoutingData {
  try { return { ...DEFAULT_SCOUTING, ...JSON.parse(localStorage.getItem(`sf-scouting-${id}`) ?? "{}") }; }
  catch { return DEFAULT_SCOUTING; }
}
function saveScouting(id: number, d: ScoutingData) {
  localStorage.setItem(`sf-scouting-${id}`, JSON.stringify(d));
}
function loadChecklist(id: number): Checklist {
  try { return { ...DEFAULT_CHECKLIST, ...JSON.parse(localStorage.getItem(`sf-checklist-${id}`) ?? "{}") }; }
  catch { return DEFAULT_CHECKLIST; }
}
function saveChecklist(id: number, c: Checklist) {
  localStorage.setItem(`sf-checklist-${id}`, JSON.stringify(c));
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function SLabel({ icon: Icon, label, color = "text-primary" }: { icon: React.ElementType; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      <span className={`text-[11px] font-black uppercase tracking-widest ${color}`}>{label}</span>
    </div>
  );
}

function MCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-[#111827] p-5 ${className}`}>
      {children}
    </div>
  );
}

function ScoutField({
  label, value, onChange, placeholder = "Escribe aquí...", rows = 3,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-white/40 uppercase tracking-widest font-black">{label}</label>
      <textarea
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-primary/50 transition"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}

function DiffBadge({ diff }: { diff: string | null | undefined }) {
  if (!diff) return null;
  const cfg: Record<string, string> = {
    facil: "bg-green-500/15 text-green-400 border-green-500/25",
    medio: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    importante: "bg-red-500/15 text-red-400 border-red-500/25",
  };
  return (
    <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${cfg[diff] ?? "bg-white/5 text-white/40 border-white/10"}`}>
      {DIFFICULTY_LABEL[diff] ?? diff}
    </span>
  );
}

function CircleRing({ percent }: { percent: number }) {
  const r = 28; const circ = 2 * Math.PI * r;
  const color = percent >= 75 ? "#22c55e" : percent >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${(percent / 100) * circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <span className="text-sm font-black text-white leading-none">{percent}%</span>
      </div>
    </div>
  );
}

// ── Team initials badge ───────────────────────────────────────────────────────
function TeamAvatar({ name, logoUrl, size = "lg" }: { name: string; logoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const sz = size === "lg" ? "h-20 w-20 text-xl" : size === "md" ? "h-14 w-14 text-base" : "h-9 w-9 text-xs";
  return (
    <div className={`${sz} rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0`}>
      {logoUrl
        ? <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
        : <span className="font-black text-primary">{initials}</span>}
    </div>
  );
}

// ── Editable list (fortalezas / debilidades) ─────────────────────────────────
function EditableList({ items, onChange, placeholder }: {
  items: string[]; onChange: (items: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
          <ChevronRight className="h-3.5 w-3.5 text-primary/60 shrink-0 mt-0.5" />
          <span className="text-sm text-white/80 flex-1 leading-snug">{item}</span>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-white/20 hover:text-red-400 transition shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-primary/50 transition"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <button
          onClick={add}
          className="h-9 w-9 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "resumen", label: "Resumen", icon: BookOpen },
  { id: "scouting", label: "Scouting", icon: Target },
  { id: "plantilla", label: "Plantilla", icon: Users },
  { id: "videos", label: "Vídeos", icon: Video },
  { id: "playbook", label: "Playbook", icon: Library },
  { id: "estadisticas", label: "Estadísticas", icon: BarChart2 },
  { id: "informe", label: "Informe", icon: FileText },
  { id: "tareas", label: "Tareas", icon: CheckCircle2 },
];

// ── Tab: Resumen ──────────────────────────────────────────────────────────────
function TabResumen({ scout, onChange, checklist }: {
  scout: ScoutingData; onChange: (s: ScoutingData) => void; checklist: Checklist;
}) {
  const prepPct = Math.round((Object.values(checklist).filter(Boolean).length / 4) * 100);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <MCard>
          <SLabel icon={BookOpen} label="Claves del Partido" />
          <ScoutField label="" value={scout.clavesPartido} onChange={v => onChange({ ...scout, clavesPartido: v })}
            placeholder="Aspectos clave a tener en cuenta para este partido..." rows={4} />
        </MCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MCard>
            <SLabel icon={TrendingUp} label="Fortalezas del Rival" color="text-red-400" />
            {scout.fortalezas.length === 0
              ? <p className="text-xs text-white/30">Sin fortalezas registradas aún. Ve a la pestaña Scouting.</p>
              : scout.fortalezas.map((f, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5">
                  <ChevronRight className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-white/75">{f}</span>
                </div>
              ))}
          </MCard>
          <MCard>
            <SLabel icon={Shield} label="Debilidades del Rival" color="text-green-400" />
            {scout.debilidades.length === 0
              ? <p className="text-xs text-white/30">Sin debilidades registradas aún. Ve a la pestaña Scouting.</p>
              : scout.debilidades.map((d, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5">
                  <ChevronRight className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-white/75">{d}</span>
                </div>
              ))}
          </MCard>
        </div>
        <MCard>
          <SLabel icon={Star} label="Jugadoras Destacadas" color="text-amber-400" />
          <ScoutField label="" value={scout.jugadorasDestacadas} onChange={v => onChange({ ...scout, jugadorasDestacadas: v })}
            placeholder="Jugadoras a vigilar especialmente..." rows={3} />
        </MCard>
        <MCard>
          <SLabel icon={MessageSquare} label="Notas del Entrenador" />
          <ScoutField label="" value={scout.notasEntrenador} onChange={v => onChange({ ...scout, notasEntrenador: v })}
            placeholder="Observaciones personales del entrenador..." rows={4} />
        </MCard>
      </div>
      <div className="space-y-4">
        <MCard>
          <SLabel icon={CheckCircle2} label="Preparación" color="text-green-400" />
          <div className="flex flex-col items-center gap-3 py-2">
            <CircleRing percent={prepPct} />
            <div className="space-y-1 w-full">
              {(["scouting", "videos", "informe", "charla"] as const).map(k => {
                const labels = { scouting: "Scouting completado", videos: "Vídeos revisados", informe: "Informe generado", charla: "Charla preparada" };
                return (
                  <div key={k} className="flex items-center gap-2 px-2 py-1.5">
                    {checklist[k] ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" /> : <Circle className="h-4 w-4 text-white/20 shrink-0" />}
                    <span className={`text-sm ${checklist[k] ? "text-white/30 line-through" : "text-white/70"}`}>{labels[k]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </MCard>
        <MCard>
          <SLabel icon={Target} label="Objetivos del Partido" color="text-blue-400" />
          <ScoutField label="" value={scout.objetivos} onChange={v => onChange({ ...scout, objetivos: v })}
            placeholder="¿Qué queremos conseguir en este partido?" rows={5} />
        </MCard>
      </div>
    </div>
  );
}

// ── Tab: Scouting ─────────────────────────────────────────────────────────────
function TabScouting({ scout, onChange }: { scout: ScoutingData; onChange: (s: ScoutingData) => void }) {
  const set = (k: keyof ScoutingData) => (v: string) => onChange({ ...scout, [k]: v });
  return (
    <div className="space-y-4">
      {/* Ataque */}
      <MCard>
        <SLabel icon={Zap} label="Ataque" color="text-orange-400" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ScoutField label="Sistemas Principales" value={scout.sistemas} onChange={set("sistemas")} placeholder="Pick & Roll, 5 out, triángulo..." />
          <ScoutField label="Ritmo de Juego" value={scout.ritmo} onChange={set("ritmo")} placeholder="Rápido, pausado, transición..." />
          <ScoutField label="Jugadoras Generadoras" value={scout.generadoras} onChange={set("generadoras")} placeholder="Nombres de jugadoras clave en el ataque..." />
          <ScoutField label="Observaciones" value={scout.ataqueObs} onChange={set("ataqueObs")} placeholder="Patrones de juego, tendencias..." />
        </div>
      </MCard>

      {/* Defensa */}
      <MCard>
        <SLabel icon={Shield} label="Defensa" color="text-blue-400" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ScoutField label="Tipo de Defensa" value={scout.tipoDefensa} onChange={set("tipoDefensa")} placeholder="Individual, zona, mixta..." />
          <ScoutField label="Presión" value={scout.presion} onChange={set("presion")} placeholder="Full-court, half-court, sin presión..." />
          <ScoutField label="Pick & Roll Defensivo" value={scout.pickRoll} onChange={set("pickRoll")} placeholder="Cómo defienden el P&R..." />
          <ScoutField label="Defensa en Zona" value={scout.zona} onChange={set("zona")} placeholder="Tipo de zona, vulnerabilidades..." />
        </div>
        <div className="mt-4">
          <ScoutField label="Observaciones" value={scout.defensaObs} onChange={set("defensaObs")} placeholder="Tendencias defensivas generales..." />
        </div>
      </MCard>

      {/* Transición */}
      <MCard>
        <SLabel icon={Activity} label="Transición" color="text-purple-400" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ScoutField label="Contraataque" value={scout.contraataque} onChange={set("contraataque")} placeholder="Velocidad, jugadoras, patrones..." />
          <ScoutField label="Balance Defensivo" value={scout.balance} onChange={set("balance")} placeholder="Quién vuelve, organización..." />
        </div>
        <div className="mt-4">
          <ScoutField label="Observaciones" value={scout.transicionObs} onChange={set("transicionObs")} placeholder="Tendencias en la transición..." />
        </div>
      </MCard>

      {/* Fortalezas / Debilidades */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MCard>
          <SLabel icon={TrendingUp} label="Fortalezas" color="text-red-400" />
          <EditableList items={scout.fortalezas}
            onChange={v => onChange({ ...scout, fortalezas: v })}
            placeholder="Añadir fortaleza..." />
        </MCard>
        <MCard>
          <SLabel icon={Shield} label="Debilidades" color="text-green-400" />
          <EditableList items={scout.debilidades}
            onChange={v => onChange({ ...scout, debilidades: v })}
            placeholder="Añadir debilidad..." />
        </MCard>
      </div>

      {/* Objetivos + Notas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MCard>
          <SLabel icon={Target} label="Objetivos del Partido" color="text-blue-400" />
          <ScoutField label="" value={scout.objetivos} onChange={set("objetivos")}
            placeholder="¿Qué queremos conseguir en este partido?" rows={5} />
        </MCard>
        <MCard>
          <SLabel icon={MessageSquare} label="Notas del Entrenador" />
          <ScoutField label="" value={scout.notasEntrenador} onChange={set("notasEntrenador")}
            placeholder="Observaciones personales..." rows={5} />
        </MCard>
      </div>

      <div className="flex items-center gap-2 text-xs text-white/25 justify-end">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500/40" />
        Guardado automáticamente
      </div>
    </div>
  );
}

const POSITIONS: Record<string, string> = { PG: "Base", SG: "Escolta", SF: "Alero", PF: "Ala-Pívot", C: "Pívot" };
const POS_ORDER = ["PG", "SG", "SF", "PF", "C"];

// ── Player card with photo upload ─────────────────────────────────────────────

function PlayerPhotoCard({ player }: { player: { id: number; name: string; position: string; jerseyNumber?: number | null; age?: number | null; height?: string | null; nationality?: string | null; photoUrl?: string | null } }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updatePlayer = useUpdatePlayer();
  const [uploading, setUploading] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);

  const photo = localPhoto ?? player.photoUrl ?? null;
  const initials = player.name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Solo imágenes", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const url = await uploadPhotoFile(file);
      setLocalPhoto(url);
      updatePlayer.mutate({ id: player.id, data: { photoUrl: url } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(player.id) });
          toast({ title: "Foto guardada" });
        },
        onError: () => toast({ title: "Error guardando foto", variant: "destructive" }),
      });
    } catch {
      toast({ title: "Error al subir foto", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex flex-col items-center gap-3 hover:border-white/[0.12] transition group">
      {/* Photo */}
      <div className="relative">
        <label className="cursor-pointer block">
          <div className="h-20 w-20 rounded-2xl overflow-hidden bg-white/[0.06] border border-white/10 flex items-center justify-center relative">
            {photo
              ? <img src={photo} alt={player.name} className="h-full w-full object-cover" />
              : <span className="font-black text-primary text-xl">{initials}</span>}
            <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              {uploading
                ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                : <Camera className="h-5 w-5 text-white" />}
            </div>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {player.jerseyNumber != null && (
          <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
            {player.jerseyNumber}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-center min-w-0 w-full">
        <Link href={`/players/${player.id}`}>
          <p className="font-black text-white/90 text-sm leading-tight hover:text-primary transition cursor-pointer truncate">{player.name}</p>
        </Link>
        <p className="text-[11px] text-primary/70 font-bold mt-0.5">{POSITIONS[player.position ?? ""] ?? player.position ?? "—"}</p>
        <div className="flex items-center justify-center gap-2 mt-1.5 text-[10px] text-white/30">
          {player.age && <span>{player.age}a</span>}
          {player.height && <span>{player.height}</span>}
          {player.nationality && <span>{player.nationality}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Plantilla (FastScout style) ─────────────────────────────────────────
function TabPlantilla({ rivalTeamId, rivalName, allGamesList }: {
  rivalTeamId: number | null; rivalName: string;
  allGamesList: { homeTeam: string; awayTeam: string; homeScore?: number | null; awayScore?: number | null; date: string }[];
}) {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string>("Todos");
  const [sortBy, setSortBy] = useState<"numero" | "posicion">("numero");

  const { data: players, isLoading } = useListPlayers(
    rivalTeamId ? { teamId: rivalTeamId } : undefined,
    { query: { enabled: !!rivalTeamId, queryKey: getListPlayersQueryKey(rivalTeamId ? { teamId: rivalTeamId } : undefined) } },
  );

  // ── Compute team record from existing games ───────────────────────────────
  const record = useMemo(() => {
    if (!rivalName) return null;
    const nameL = rivalName.toLowerCase();
    const played = allGamesList.filter(g =>
      g.homeScore != null && g.awayScore != null &&
      (g.homeTeam.toLowerCase() === nameL || g.awayTeam.toLowerCase() === nameL)
    );
    const wins = played.filter(g =>
      (g.homeTeam.toLowerCase() === nameL && g.homeScore! > g.awayScore!) ||
      (g.awayTeam.toLowerCase() === nameL && g.awayScore! > g.homeScore!)
    ).length;
    const losses = played.length - wins;
    const pct = played.length > 0 ? Math.round((wins / played.length) * 100) : null;
    return { wins, losses, played: played.length, pct };
  }, [rivalName, allGamesList]);

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = players ?? [];
    if (posFilter !== "Todos") list = list.filter(p => p.position === posFilter);
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (sortBy === "numero") list = [...list].sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99));
    else list = [...list].sort((a, b) => (POS_ORDER.indexOf(a.position ?? "") - POS_ORDER.indexOf(b.position ?? "")));
    return list;
  }, [players, posFilter, search, sortBy]);

  const posFilters = ["Todos", ...POS_ORDER];

  return (
    <div className="space-y-4">
      {/* Header with record */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">{rivalName}</h2>
          {record && record.played > 0 && (
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-white/50 font-medium">
                <span className="text-green-400 font-black">{record.wins}V</span>
                {" "}<span className="text-white/30">·</span>{" "}
                <span className="text-red-400 font-black">{record.losses}D</span>
                {" "}<span className="text-white/30">·</span>{" "}
                <span className="text-white/50">{record.played} jugados</span>
              </span>
              {record.pct != null && (
                <span className="text-[10px] font-black text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                  {record.pct}% victorias
                </span>
              )}
            </div>
          )}
        </div>
        {rivalTeamId && (
          <Link href={`/teams/${rivalTeamId}`}>
            <button className="text-xs text-white/40 hover:text-primary transition flex items-center gap-1 mt-1 shrink-0">
              Ver equipo <ChevronRight className="h-3 w-3" />
            </button>
          </Link>
        )}
      </div>

      {!rivalTeamId ? (
        <MCard>
          <div className="py-10 text-center">
            <Users className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">El equipo rival no está registrado en ScoutFlow</p>
            <Link href="/equipos">
              <button className="mt-3 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl transition">
                Ir a Equipos
              </button>
            </Link>
          </div>
        </MCard>
      ) : (
        <>
          {/* Controls */}
          <MCard className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar jugadora..."
                  className="w-full pl-8 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-primary/40 transition"
                />
              </div>
              {/* Sort */}
              <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
                <button onClick={() => setSortBy("numero")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition ${sortBy === "numero" ? "bg-primary text-primary-foreground" : "text-white/40 hover:text-white/60"}`}>
                  <Hash className="h-3 w-3" /> Dorsal
                </button>
                <button onClick={() => setSortBy("posicion")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition ${sortBy === "posicion" ? "bg-primary text-primary-foreground" : "text-white/40 hover:text-white/60"}`}>
                  <SlidersHorizontal className="h-3 w-3" /> Posición
                </button>
              </div>
            </div>
            {/* Position pills */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {posFilters.map(p => (
                <button key={p} onClick={() => setPosFilter(p)}
                  className={`text-[11px] font-black px-3 py-1 rounded-full border transition ${posFilter === p
                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                    : "bg-white/[0.04] text-white/40 border-white/[0.08] hover:border-white/20 hover:text-white/60"}`}>
                  {p === "Todos" ? "Todas" : `${p} · ${POSITIONS[p]}`}
                </button>
              ))}
            </div>
          </MCard>

          {/* Player list */}
          {isLoading ? (
            <MCard>
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />)}
              </div>
            </MCard>
          ) : !players || players.length === 0 ? (
            <MCard>
              <div className="py-10 text-center">
                <Users className="h-10 w-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/40">No hay jugadoras registradas</p>
                <Link href={`/teams/${rivalTeamId}`}>
                  <button className="mt-3 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl transition flex items-center gap-1 mx-auto">
                    <Plus className="h-3.5 w-3.5" /> Añadir jugadoras
                  </button>
                </Link>
              </div>
            </MCard>
          ) : filtered.length === 0 ? (
            <MCard>
              <p className="text-center py-8 text-sm text-white/30">Sin resultados para "{posFilter !== "Todos" ? posFilter : search}"</p>
            </MCard>
          ) : (
            <MCard className="p-0 overflow-hidden">
              {/* Table header */}
              <div className="grid gap-0 border-b border-white/[0.06]" style={{ gridTemplateColumns: "44px 44px 1fr 80px 44px 56px 72px 36px" }}>
                {["#", "·", "Nombre", "Posición", "Edad", "Alt.", "Nac.", ""].map((h, i) => (
                  <div key={i} className={`px-2 py-3 text-[10px] font-black text-white/25 uppercase tracking-widest ${i === 2 ? "pl-3" : "text-center"}`}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              {filtered.map((p, idx) => {
                const initials = p.name.split(" ").map((w: string) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
                const isEven = idx % 2 === 0;
                return (
                  <div key={p.id}
                    className={`grid items-center gap-0 border-b border-white/[0.04] hover:bg-primary/[0.04] transition group ${isEven ? "bg-white/[0.01]" : ""}`}
                    style={{ gridTemplateColumns: "44px 44px 1fr 80px 44px 56px 72px 36px" }}>
                    {/* Dorsal */}
                    <div className="py-3 px-2 text-center font-black text-sm text-primary/70 font-mono">{p.jerseyNumber ?? "—"}</div>
                    {/* Photo */}
                    <div className="py-3 px-1 flex justify-center">
                      <label className="cursor-pointer relative group/photo">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-white/[0.06] border border-white/10 flex items-center justify-center">
                          {p.photoUrl
                            ? <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                            : <span className="text-[9px] font-black text-primary">{initials}</span>}
                          <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover/photo:opacity-100 transition flex items-center justify-center">
                            <Camera className="h-3 w-3 text-white" />
                          </div>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          try { const url = await uploadPhotoFile(file); } catch {}
                          e.target.value = "";
                        }} />
                      </label>
                    </div>
                    {/* Name */}
                    <div className="py-3 pl-3 pr-2 min-w-0">
                      <Link href={`/players/${p.id}`}>
                        <p className="font-bold text-sm text-white/85 truncate hover:text-primary transition cursor-pointer leading-tight">{p.name}</p>
                      </Link>
                    </div>
                    {/* Position */}
                    <div className="py-3 px-2 text-center">
                      <span className="text-[10px] font-black text-primary/70 bg-primary/10 border border-primary/15 px-1.5 py-0.5 rounded-md">{p.position ?? "—"}</span>
                    </div>
                    {/* Age */}
                    <div className="py-3 px-2 text-center text-sm text-white/45">{p.age ?? "—"}</div>
                    {/* Height */}
                    <div className="py-3 px-2 text-center text-sm text-white/45">{p.height ?? "—"}</div>
                    {/* Nationality */}
                    <div className="py-3 px-2 text-center text-xs text-white/35 truncate">{p.nationality ?? "—"}</div>
                    {/* Link */}
                    <div className="py-3 pr-3 flex justify-center">
                      <Link href={`/players/${p.id}`}>
                        <ChevronRight className="h-4 w-4 text-white/15 group-hover:text-primary/60 transition" />
                      </Link>
                    </div>
                  </div>
                );
              })}
              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-white/25">{filtered.length} de {players.length} jugadoras</span>
                {rivalTeamId && <Link href={`/teams/${rivalTeamId}`}><button className="text-[11px] text-primary/60 hover:text-primary transition flex items-center gap-1"><Plus className="h-3 w-3" /> Añadir jugadoras</button></Link>}
              </div>
            </MCard>
          )}

          <p className="text-[11px] text-white/20 text-center">
            Haz clic en la foto para actualizarla · Los datos se conectarán con la FEB en futuras versiones.
          </p>
        </>
      )}
    </div>
  );
}

// ── Tab: Vídeos ───────────────────────────────────────────────────────────────
function TabVideos({ rivalName }: { rivalName: string }) {
  const filters = ["Todos", "Ataque", "Defensa", "Transición"];
  const [filter, setFilter] = useState("Todos");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${filter === f
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-white/5 text-white/50 border-white/10 hover:border-white/20"}`}>
            {f}
          </button>
        ))}
      </div>
      <MCard>
        <SLabel icon={Video} label={`Vídeos · ${rivalName}`} color="text-purple-400" />
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <Video className="h-8 w-8 text-purple-400/50" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/60">Gestiona los vídeos del rival en la biblioteca</p>
            <p className="text-xs text-white/30 mt-1">Los vídeos se asocian a equipos en la sección Vídeos</p>
          </div>
          <Link href="/videos">
            <button className="text-sm bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 px-5 py-2.5 rounded-xl transition font-bold flex items-center gap-2">
              <Video className="h-4 w-4" /> Ir a Vídeos
            </button>
          </Link>
        </div>
      </MCard>
    </div>
  );
}

// ── Tab: Playbook ─────────────────────────────────────────────────────────────
function TabPlaybook({ gameId, rivalName }: { gameId: number; rivalName: string }) {
  const [localPlays, setLocalPlays] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`sf-playbook-${gameId}`) ?? "[]"); } catch { return []; }
  });
  const [draft, setDraft] = useState("");

  const savePlays = (plays: string[]) => {
    setLocalPlays(plays);
    localStorage.setItem(`sf-playbook-${gameId}`, JSON.stringify(plays));
  };

  const add = () => {
    const v = draft.trim(); if (!v) return;
    savePlays([...localPlays, v]);
    setDraft("");
  };

  const remove = (i: number) => savePlays(localPlays.filter((_, j) => j !== i));

  const CATEGORIES = [
    { key: "ataque", label: "Ataque", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { key: "defensa", label: "Defensa", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { key: "ultimo", label: "Último segundo", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" /> Playbook
          </h2>
          <p className="text-xs text-white/40 mt-0.5">Jugadas y sistemas para {rivalName}</p>
        </div>
        <Link href="/jugadas">
          <button className="text-xs text-primary/70 hover:text-primary border border-primary/20 hover:border-primary/40 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5">
            <Library className="h-3.5 w-3.5" /> Biblioteca
          </button>
        </Link>
      </div>

      {/* Type chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <span key={c.key} className={`text-[11px] font-black px-3 py-1 rounded-full border ${c.bg} ${c.color}`}>
            {c.label}
          </span>
        ))}
      </div>

      {/* Add play */}
      <MCard className="p-4">
        <SLabel icon={Plus} label="Añadir Jugada / Sistema" color="text-primary" />
        <div className="flex gap-2">
          <input
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-primary/40 transition"
            value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Ej: P&R alto con #7, Zona 2-3 en último cuarto..."
          />
          <button onClick={add} disabled={!draft.trim()}
            className="bg-primary text-primary-foreground font-black px-4 py-2.5 rounded-xl text-sm hover:bg-primary/90 transition disabled:opacity-40 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </div>
      </MCard>

      {/* Play list */}
      {localPlays.length === 0 ? (
        <MCard>
          <div className="py-10 flex flex-col items-center gap-3 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Library className="h-8 w-8 text-primary/30" />
            </div>
            <p className="text-sm font-semibold text-white/50">Sin jugadas anotadas aún</p>
            <p className="text-xs text-white/25">Añade jugadas clave para el partido</p>
          </div>
        </MCard>
      ) : (
        <MCard className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">
              {localPlays.length} jugada{localPlays.length !== 1 ? "s" : ""}
            </span>
            <CheckCheck className="h-3.5 w-3.5 text-primary/40" />
          </div>
          <div>
            {localPlays.map((play, i) => (
              <div key={i} className={`flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition group ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                <span className="text-[11px] font-black text-primary/40 font-mono w-5 shrink-0 text-center">{i + 1}</span>
                <Swords className="h-3.5 w-3.5 text-white/15 shrink-0" />
                <span className="flex-1 text-sm text-white/75 leading-snug">{play}</span>
                <button onClick={() => remove(i)} className="opacity-0 group-hover:opacity-100 transition text-white/20 hover:text-red-400 p-1 rounded shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </MCard>
      )}

      <p className="text-[11px] text-white/20 text-center">
        Las jugadas se guardan automáticamente para este partido
      </p>
    </div>
  );
}

// ── PlayerStatsRow (one hook call per player, avoids hooks-in-loop) ───────────
function PlayerStatsRow({ player }: { player: { id: number; name: string; position?: string | null; jerseyNumber?: number | null; photoUrl?: string | null } }) {
  const { data: stats } = useGetPlayerStats(player.id, { query: { queryKey: getGetPlayerStatsQueryKey(player.id) } });
  const initials = player.name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const fmt = (v: number | string | null | undefined, dec = 1) => { const n = Number(v); return v != null && !isNaN(n) ? n.toFixed(dec) : "—"; };
  const fmtPct = (v: number | string | null | undefined) => { const n = Number(v); return v != null && !isNaN(n) ? `${(n * 100).toFixed(0)}%` : "—"; };
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition group">
      <td className="py-3 pl-0 pr-3 text-sm text-white/30 font-mono text-center w-8">{player.jerseyNumber ?? "—"}</td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full overflow-hidden bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
            {player.photoUrl
              ? <img src={player.photoUrl} alt={player.name} className="h-full w-full object-cover" />
              : <span className="text-[10px] font-black text-primary">{initials}</span>}
          </div>
          <div>
            <Link href={`/players/${player.id}`}>
              <p className="font-semibold text-white/85 text-sm leading-tight hover:text-primary transition cursor-pointer">{player.name}</p>
            </Link>
            <p className="text-[10px] text-white/35">{POSITIONS[player.position ?? ""] ?? player.position ?? ""}</p>
          </div>
        </div>
      </td>
      {stats ? (
        <>
          <td className="py-3 px-2 text-sm font-black text-primary text-center">{fmt(stats.avgPoints)}</td>
          <td className="py-3 px-2 text-sm text-white/60 text-center">{fmt(stats.avgRebounds)}</td>
          <td className="py-3 px-2 text-sm text-white/60 text-center">{fmt(stats.avgAssists)}</td>
          <td className="py-3 px-2 text-sm text-white/60 text-center">{fmt(stats.avgSteals)}</td>
          <td className="py-3 px-2 text-sm text-white/60 text-center">{fmt(stats.avgBlocks)}</td>
          <td className="py-3 px-2 text-sm font-bold text-amber-400 text-center">{stats.avgValuation != null ? fmt(stats.avgValuation) : "—"}</td>
          <td className="py-3 px-2 text-sm text-white/50 text-center">{fmt(stats.avgMinutes, 0)}'</td>
          <td className="py-3 px-2 text-sm text-white/50 text-center">{fmtPct(stats.avgFieldGoalPct)}</td>
          <td className="py-3 px-2 text-sm text-white/50 text-center">{fmtPct(stats.avgThreePointPct)}</td>
          <td className="py-3 pr-0 text-sm text-white/50 text-center">{fmtPct(stats.avgFreeThrowPct)}</td>
        </>
      ) : (
        <td colSpan={10} className="py-3 px-3 text-xs text-white/20 italic">Sin estadísticas registradas</td>
      )}
    </tr>
  );
}

// ── Tab: Estadísticas ─────────────────────────────────────────────────────────
function TabEstadisticas({ homeTeam, awayTeam, homeScore, awayScore, h2hResults, rivalTeamId }: {
  homeTeam: string; awayTeam: string;
  homeScore?: number | null; awayScore?: number | null;
  h2hResults: { date: string; home: string; away: string; hs: number; as: number }[];
  rivalTeamId: number | null;
}) {
  const { data: players } = useListPlayers(
    rivalTeamId ? { teamId: rivalTeamId } : undefined,
    { query: { enabled: !!rivalTeamId, queryKey: getListPlayersQueryKey(rivalTeamId ? { teamId: rivalTeamId } : undefined) } },
  );

  const statsHeaders = ["Pts", "Reb", "Ast", "Rob", "Tap", "Val", "Min", "%TC", "%3P", "%TL"];

  return (
    <div className="space-y-4">
      {homeScore != null && awayScore != null && (
        <MCard>
          <SLabel icon={Trophy} label="Resultado del Partido" color="text-primary" />
          <div className="flex items-center justify-center gap-8 py-4">
            <div className="text-center">
              <p className="text-sm text-white/50 uppercase tracking-widest font-black mb-1">{homeTeam.split(" ")[0]}</p>
              <p className="text-5xl font-black text-white">{homeScore}</p>
            </div>
            <span className="text-2xl font-black text-white/20">-</span>
            <div className="text-center">
              <p className="text-sm text-white/50 uppercase tracking-widest font-black mb-1">{awayTeam.split(" ")[0]}</p>
              <p className="text-5xl font-black text-white">{awayScore}</p>
            </div>
          </div>
          <p className={`text-center text-sm font-black uppercase tracking-widest ${homeScore > awayScore ? "text-green-400" : "text-red-400"}`}>
            {homeScore > awayScore ? `Gana ${homeTeam}` : `Gana ${awayTeam}`}
          </p>
        </MCard>
      )}

      {rivalTeamId && (
        <MCard>
          <div className="flex items-center justify-between mb-4">
            <SLabel icon={Activity} label="Estadísticas Medias Rival" color="text-amber-400" />
            {players && players.length > 0 && (
              <span className="text-[10px] text-white/30">{players.length} jugadoras</span>
            )}
          </div>
          {!players || players.length === 0 ? (
            <div className="py-8 text-center">
              <Activity className="h-10 w-10 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/40">No hay jugadoras registradas para este equipo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-[10px] text-white/25 uppercase tracking-widest font-black py-2 pr-3 pl-0 w-8">#</th>
                    <th className="text-left text-[10px] text-white/25 uppercase tracking-widest font-black py-2 px-3">Jugadora</th>
                    {statsHeaders.map(h => (
                      <th key={h} className="text-center text-[10px] text-white/25 uppercase tracking-widest font-black py-2 px-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => <PlayerStatsRow key={p.id} player={p} />)}
                </tbody>
              </table>
            </div>
          )}
        </MCard>
      )}

      <MCard>
        <SLabel icon={BarChart2} label="Historial H2H" color="text-blue-400" />
        {h2hResults.length === 0 ? (
          <div className="py-8 text-center">
            <BarChart2 className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">No hay historial de enfrentamientos directos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {h2hResults.map((r, i) => {
              const homeWins = r.hs > r.as;
              return (
                <div key={i} className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3">
                  <span className="text-xs text-white/30 w-20 shrink-0">{new Date(r.date + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}</span>
                  <span className="text-sm text-white/70 flex-1 truncate">{r.home} vs {r.away}</span>
                  <span className="font-black text-sm text-white">{r.hs} – {r.as}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${homeWins ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                    {homeWins ? r.home.split(" ")[0] : r.away.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </MCard>
    </div>
  );
}

// ── Informe section header ────────────────────────────────────────────────────
function InformeSection({ num, title, icon: Icon, color = "text-primary" }: {
  num: number; title: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className={`flex items-center gap-3 py-3 border-b-2 mb-4 ${color === "text-primary" ? "border-primary/30" : color === "text-orange-400" ? "border-orange-400/30" : color === "text-blue-400" ? "border-blue-400/30" : color === "text-green-400" ? "border-green-400/30" : color === "text-amber-400" ? "border-amber-400/30" : color === "text-cyan-400" ? "border-cyan-400/30" : "border-white/10"}`}>
      <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white ${color === "text-primary" ? "bg-primary" : color === "text-orange-400" ? "bg-orange-500" : color === "text-blue-400" ? "bg-blue-500" : color === "text-green-400" ? "bg-green-500" : color === "text-amber-400" ? "bg-amber-500" : color === "text-cyan-400" ? "bg-cyan-500" : "bg-white/10"}`}>
        {num}
      </div>
      <Icon className={`h-4 w-4 ${color}`} />
      <h3 className={`text-sm font-black uppercase tracking-widest ${color}`}>{title}</h3>
    </div>
  );
}

// ── Tab: Informe ──────────────────────────────────────────────────────────────
function TabInforme({ game, scout, checklist, homeTeamLogo, awayTeamLogo, gameId, rivalTeamId, rivalName, rivalTeamLogo }: {
  game: { homeTeam: string; awayTeam: string; date: string; location?: string | null; difficulty?: string | null; homeScore?: number | null; awayScore?: number | null };
  scout: ScoutingData; checklist: Checklist;
  homeTeamLogo?: string | null; awayTeamLogo?: string | null; rivalTeamLogo?: string | null;
  gameId: number; rivalTeamId: number | null; rivalName: string;
}) {
  const { contentRef, exportPdf, exporting } = useExportPdf(`informe-${game.homeTeam}-vs-${game.awayTeam}-${game.date}`);
  const prepPct = Math.round((Object.values(checklist).filter(Boolean).length / 4) * 100);

  const { data: players } = useListPlayers(
    rivalTeamId ? { teamId: rivalTeamId } : undefined,
    { query: { enabled: !!rivalTeamId, queryKey: getListPlayersQueryKey(rivalTeamId ? { teamId: rivalTeamId } : undefined) } },
  );

  const localPlays: string[] = (() => {
    try { return JSON.parse(localStorage.getItem(`sf-playbook-${gameId}`) ?? "[]"); } catch { return []; }
  })();

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fmtShort = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  const statsHeaders = ["Pts", "Reb", "Ast", "Rob", "Tap", "Val", "Min", "%TC", "%3P", "%TL"];
  const hasScouting = !!(scout.clavesPartido || scout.sistemas || scout.ritmo || scout.tipoDefensa || scout.presion || scout.fortalezas.length || scout.debilidades.length || scout.jugadorasDestacadas || scout.objetivos || scout.notasEntrenador);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-white text-lg">Informe de Scouting</h3>
          <p className="text-xs text-white/40 mt-0.5">{game.homeTeam} vs {game.awayTeam} · {fmtShort(game.date)}</p>
        </div>
        <button onClick={exportPdf} disabled={exporting}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black px-5 py-2.5 rounded-xl transition text-sm shadow-lg shadow-primary/20 disabled:opacity-60">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generar PDF
        </button>
      </div>

      {/* ── PRINTABLE CONTENT ───────────────────────────────────────────────── */}
      <div ref={contentRef} className="space-y-4 bg-[#0a0f1a] p-3 rounded-2xl">

        {/* ═══ PORTADA ═══════════════════════════════════════════════════════ */}
        <div className="rounded-2xl overflow-hidden border border-white/[0.07]" style={{ background: "linear-gradient(135deg, #0f172a 0%, #111827 50%, #0a0f1a 100%)" }}>
          {/* Top stripe */}
          <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #f97316 0%, #fb923c 100%)" }} />
          <div className="px-8 py-10">
            {/* Logos + VS */}
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="flex flex-col items-center gap-3">
                <TeamAvatar name={game.homeTeam} logoUrl={homeTeamLogo} size="lg" />
                <div className="text-center">
                  <p className="font-black text-white text-sm uppercase tracking-wider leading-tight">{game.homeTeam}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">Local</p>
                </div>
              </div>
              <div className="text-center px-6">
                {game.homeScore != null && game.awayScore != null ? (
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-5xl font-black text-white">{game.homeScore}</span>
                      <span className="text-2xl font-black text-white/20">–</span>
                      <span className="text-5xl font-black text-white">{game.awayScore}</span>
                    </div>
                    <p className={`text-xs font-black uppercase tracking-widest mt-2 ${game.homeScore > game.awayScore ? "text-green-400" : "text-red-400"}`}>
                      Gana {game.homeScore > game.awayScore ? game.homeTeam.split(" ")[0] : game.awayTeam.split(" ")[0]}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl font-black text-white/15 tracking-widest">VS</p>
                    <div className="mt-3 h-px w-24 mx-auto" style={{ background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.4), transparent)" }} />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-3">
                <TeamAvatar name={game.awayTeam} logoUrl={awayTeamLogo} size="lg" />
                <div className="text-center">
                  <p className="font-black text-white text-sm uppercase tracking-wider leading-tight">{game.awayTeam}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">Visitante</p>
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="flex items-center justify-center gap-6 text-xs text-white/40 mb-6">
              <span className="flex items-center gap-1.5 capitalize"><Calendar className="h-3 w-3 text-primary/60" />{fmtDate(game.date)}</span>
              {game.location && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-primary/60" />{game.location}</span>}
              {game.difficulty && <DiffBadge diff={game.difficulty} />}
            </div>

            {/* Prep pills */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-black ${prepPct === 100 ? "bg-green-500/15 border-green-500/30 text-green-400" : prepPct >= 50 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                <CheckCheck className="h-3.5 w-3.5" /> {prepPct}% Preparado
              </div>
              {Object.entries({ scouting: "Scouting", videos: "Vídeos", informe: "Informe", charla: "Charla" } as Record<keyof Checklist, string>).map(([k, label]) => (
                <div key={k} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${checklist[k as keyof Checklist] ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-white/[0.03] border-white/10 text-white/25"}`}>
                  {checklist[k as keyof Checklist] ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />} {label}
                </div>
              ))}
            </div>

            {/* ScoutFlow stamp */}
            <div className="flex items-center justify-center gap-2 mt-8 pt-4 border-t border-white/[0.04]">
              <span className="text-[10px] font-black text-white/15 uppercase tracking-[0.25em]">Generado con</span>
              <span className="text-[11px] font-black tracking-tight text-white/20"><span className="text-white/30">Scout</span><span className="text-primary/40">Flow</span></span>
              <span className="text-[10px] text-white/10">· {new Date().toLocaleDateString("es-ES")}</span>
            </div>
          </div>
        </div>

        {/* ═══ 1 · RESUMEN ═══════════════════════════════════════════════════ */}
        {(scout.clavesPartido || scout.objetivos || scout.jugadorasDestacadas || scout.notasEntrenador) && (
          <MCard>
            <InformeSection num={1} title="Resumen" icon={BookOpen} />
            <div className="space-y-4">
              {scout.clavesPartido && (
                <div>
                  <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1.5">Claves del Partido</p>
                  <p className="text-sm text-white/75 whitespace-pre-wrap leading-relaxed">{scout.clavesPartido}</p>
                </div>
              )}
              {(scout.jugadorasDestacadas || scout.objetivos) && (
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {scout.jugadorasDestacadas && (
                    <div>
                      <p className="text-[10px] text-amber-400/70 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1"><Star className="h-3 w-3" /> Jugadoras a vigilar</p>
                      <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{scout.jugadorasDestacadas}</p>
                    </div>
                  )}
                  {scout.objetivos && (
                    <div>
                      <p className="text-[10px] text-blue-400/70 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1"><Target className="h-3 w-3" /> Objetivos del Partido</p>
                      <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{scout.objetivos}</p>
                    </div>
                  )}
                </div>
              )}
              {scout.notasEntrenador && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 mt-2">
                  <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Notas del Entrenador</p>
                  <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed italic">{scout.notasEntrenador}</p>
                </div>
              )}
            </div>
          </MCard>
        )}

        {/* ═══ 2 · SCOUTING ══════════════════════════════════════════════════ */}
        {hasScouting && (
          <MCard>
            <InformeSection num={2} title="Análisis del Rival" icon={Target} color="text-orange-400" />
            {/* Fortalezas / Debilidades */}
            {(scout.fortalezas.length > 0 || scout.debilidades.length > 0) && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {scout.fortalezas.length > 0 && (
                  <div className="bg-red-500/[0.05] border border-red-500/15 rounded-xl p-3">
                    <p className="text-[10px] text-red-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5"><TrendingUp className="h-3 w-3" /> Fortalezas</p>
                    {scout.fortalezas.map((f, i) => <div key={i} className="flex items-start gap-2 py-1"><span className="text-red-400/60 text-xs shrink-0 mt-0.5">▸</span><span className="text-xs text-white/70 leading-snug">{f}</span></div>)}
                  </div>
                )}
                {scout.debilidades.length > 0 && (
                  <div className="bg-green-500/[0.05] border border-green-500/15 rounded-xl p-3">
                    <p className="text-[10px] text-green-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5"><Shield className="h-3 w-3" /> Debilidades</p>
                    {scout.debilidades.map((d, i) => <div key={i} className="flex items-start gap-2 py-1"><span className="text-green-400/60 text-xs shrink-0 mt-0.5">▸</span><span className="text-xs text-white/70 leading-snug">{d}</span></div>)}
                  </div>
                )}
              </div>
            )}
            {/* Ataque / Defensa / Transición */}
            <div className="grid grid-cols-3 gap-3">
              {(scout.sistemas || scout.ritmo || scout.generadoras) && (
                <div className="bg-orange-500/[0.05] border border-orange-500/15 rounded-xl p-3">
                  <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1"><Zap className="h-3 w-3" /> Ataque</p>
                  {scout.sistemas && <div className="mb-1.5"><p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Sistemas</p><p className="text-xs text-white/65">{scout.sistemas}</p></div>}
                  {scout.ritmo && <div className="mb-1.5"><p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Ritmo</p><p className="text-xs text-white/65">{scout.ritmo}</p></div>}
                  {scout.generadoras && <div><p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Generadoras</p><p className="text-xs text-white/65">{scout.generadoras}</p></div>}
                </div>
              )}
              {(scout.tipoDefensa || scout.presion || scout.pickRoll || scout.zona) && (
                <div className="bg-blue-500/[0.05] border border-blue-500/15 rounded-xl p-3">
                  <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1"><Shield className="h-3 w-3" /> Defensa</p>
                  {scout.tipoDefensa && <div className="mb-1.5"><p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Tipo</p><p className="text-xs text-white/65">{scout.tipoDefensa}</p></div>}
                  {scout.presion && <div className="mb-1.5"><p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Presión</p><p className="text-xs text-white/65">{scout.presion}</p></div>}
                  {scout.pickRoll && <div className="mb-1.5"><p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Pick & Roll</p><p className="text-xs text-white/65">{scout.pickRoll}</p></div>}
                  {scout.zona && <div><p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Zona</p><p className="text-xs text-white/65">{scout.zona}</p></div>}
                </div>
              )}
              {(scout.contraataque || scout.balance || scout.transicionObs) && (
                <div className="bg-purple-500/[0.05] border border-purple-500/15 rounded-xl p-3">
                  <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1"><Activity className="h-3 w-3" /> Transición</p>
                  {scout.contraataque && <div className="mb-1.5"><p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Contraataque</p><p className="text-xs text-white/65">{scout.contraataque}</p></div>}
                  {scout.balance && <div className="mb-1.5"><p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Balance</p><p className="text-xs text-white/65">{scout.balance}</p></div>}
                  {scout.transicionObs && <div><p className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Obs.</p><p className="text-xs text-white/65">{scout.transicionObs}</p></div>}
                </div>
              )}
            </div>
          </MCard>
        )}

        {/* ═══ 3 · PLANTILLA ═════════════════════════════════════════════════ */}
        {players && players.length > 0 && (
          <MCard>
            <InformeSection num={3} title={`Plantilla · ${rivalName}`} icon={Users} color="text-blue-400" />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["#", "Jugadora", "Pos", "Edad", "Alt.", "Nac.", "Notas"].map(h => (
                      <th key={h} className="text-left text-[9px] text-white/20 uppercase tracking-widest font-black py-2 px-2 first:pl-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...players].sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99)).map((p, idx) => {
                    const initials = p.name.split(" ").map((w: string) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
                    return (
                      <tr key={p.id} className={`border-b border-white/[0.04] ${idx % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                        <td className="py-2.5 pl-0 pr-2 text-sm font-black text-primary/70 font-mono w-8 text-center">{p.jerseyNumber ?? "—"}</td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full overflow-hidden bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                              {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" /> : <span className="text-[8px] font-black text-primary">{initials}</span>}
                            </div>
                            <span className="font-semibold text-white/85 text-xs">{p.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center"><span className="text-[9px] font-black text-primary/70 bg-primary/10 border border-primary/15 px-1.5 py-0.5 rounded">{p.position ?? "—"}</span></td>
                        <td className="py-2.5 px-2 text-xs text-white/45 text-center">{p.age ?? "—"}</td>
                        <td className="py-2.5 px-2 text-xs text-white/45 text-center">{p.height ?? "—"}</td>
                        <td className="py-2.5 px-2 text-xs text-white/35 text-center">{p.nationality ?? "—"}</td>
                        <td className="py-2.5 px-2 text-xs text-white/40 max-w-[120px] truncate">{p.notes ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </MCard>
        )}

        {/* ═══ 4 · ESTADÍSTICAS ══════════════════════════════════════════════ */}
        {players && players.length > 0 && (
          <MCard>
            <InformeSection num={4} title="Estadísticas Medias" icon={BarChart2} color="text-amber-400" />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-[9px] text-white/20 uppercase tracking-widest font-black py-2 pl-0 pr-2 w-8">#</th>
                    <th className="text-left text-[9px] text-white/20 uppercase tracking-widest font-black py-2 px-2">Jugadora</th>
                    {statsHeaders.map(h => <th key={h} className="text-center text-[9px] text-white/20 uppercase tracking-widest font-black py-2 px-1.5">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...players].sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99)).map(p => <PlayerStatsRow key={p.id} player={p} />)}
                </tbody>
              </table>
            </div>
          </MCard>
        )}

        {/* ═══ 5 · PLAYBOOK ══════════════════════════════════════════════════ */}
        <MCard>
          <InformeSection num={5} title="Playbook" icon={Library} color="text-cyan-400" />
          {localPlays.length === 0 ? (
            <p className="text-sm text-white/30 italic py-2">Sin jugadas registradas para este partido. Añádelas en la pestaña Playbook.</p>
          ) : (
            <div className="space-y-1">
              {localPlays.map((play, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                  <span className="text-[10px] font-black text-primary/40 font-mono w-5 text-center shrink-0">{i + 1}</span>
                  <Swords className="h-3 w-3 text-white/15 shrink-0" />
                  <span className="text-sm text-white/70">{play}</span>
                </div>
              ))}
            </div>
          )}
        </MCard>

        {/* Footer stamp */}
        <div className="text-center py-2">
          <p className="text-[10px] text-white/10 uppercase tracking-[0.3em]">
            ScoutFlow Professional · {new Date().toLocaleDateString("es-ES")} · Confidencial
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Tareas ───────────────────────────────────────────────────────────────
function TabTareas({ gameId, checklist, onChange }: {
  gameId: number; checklist: Checklist; onChange: (c: Checklist) => void;
}) {
  const prepPct = Math.round((Object.values(checklist).filter(Boolean).length / 4) * 100);
  const items: { key: keyof Checklist; label: string; desc: string; icon: React.ElementType; color: string }[] = [
    { key: "scouting", label: "Scouting completado", desc: "Análisis del rival finalizado", icon: Target, color: "text-orange-400" },
    { key: "videos", label: "Vídeos revisados", desc: "Material audiovisual analizado", icon: Video, color: "text-purple-400" },
    { key: "informe", label: "Informe generado", desc: "PDF de scouting exportado", icon: FileText, color: "text-blue-400" },
    { key: "charla", label: "Charla preparada", desc: "Presentación lista para el equipo", icon: MessageSquare, color: "text-green-400" },
  ];
  const toggle = (k: keyof Checklist) => {
    const next = { ...checklist, [k]: !checklist[k] };
    onChange(next);
    saveChecklist(gameId, next);
  };
  return (
    <div className="w-full space-y-4">
      <MCard className="text-center">
        <SLabel icon={CheckCircle2} label="Estado de Preparación" color="text-green-400" />
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="relative flex items-center justify-center">
            <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
              <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
              <circle cx="60" cy="60" r="46" fill="none"
                stroke={prepPct >= 75 ? "#22c55e" : prepPct >= 50 ? "#f59e0b" : "#ef4444"}
                strokeWidth="10"
                strokeDasharray={`${(prepPct / 100) * 2 * Math.PI * 46} ${2 * Math.PI * 46}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.6s ease" }}
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-3xl font-black text-white">{prepPct}%</span>
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Listo</p>
            </div>
          </div>
          <p className="text-sm text-white/50">
            {prepPct === 100 ? "¡Preparación completa! 🏀" : `Faltan ${4 - Object.values(checklist).filter(Boolean).length} tareas`}
          </p>
        </div>
      </MCard>
      <MCard>
        <SLabel icon={CheckCircle2} label="Lista de Tareas" />
        <div className="space-y-2">
          {items.map(({ key, label, desc, icon: Icon, color }) => (
            <button key={key} onClick={() => toggle(key)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition group text-left ${
                checklist[key]
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10"
              }`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${checklist[key] ? "bg-green-500/10" : "bg-white/5"}`}>
                {checklist[key]
                  ? <CheckCircle2 className="h-5 w-5 text-green-400" />
                  : <Icon className={`h-5 w-5 ${color} opacity-60`} />}
              </div>
              <div className="flex-1">
                <p className={`font-bold text-sm ${checklist[key] ? "line-through text-white/30" : "text-white/85"}`}>{label}</p>
                <p className="text-xs text-white/30 mt-0.5">{desc}</p>
              </div>
              {checklist[key] && <span className="text-[10px] font-black text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">HECHO</span>}
            </button>
          ))}
        </div>
      </MCard>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GameMatchCenter() {
  const [, params] = useRoute("/games/:id/match-center");
  const gameId = parseInt(params?.id || "0");

  const [activeTab, setActiveTab] = useState<Tab>("resumen");
  const [scout, setScoutRaw] = useState<ScoutingData>(() => loadScouting(gameId));
  const [checklist, setChecklist] = useState<Checklist>(() => loadChecklist(gameId));
  const [plays] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`sf-playbook-${gameId}`) ?? "[]"); } catch { return []; }
  });

  const setScout = useCallback((s: ScoutingData) => {
    setScoutRaw(s);
    saveScouting(gameId, s);
  }, [gameId]);

  const { data: game, isLoading: gameLoading } = useGetGame(gameId, {
    query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) },
  });
  const { data: teams } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });

  const teamMap = useMemo(() => {
    const m: Record<string, NonNullable<typeof teams>[0]> = {};
    (teams ?? []).forEach(t => { m[t.name.toLowerCase()] = t; });
    return m;
  }, [teams]);

  const ownTeam = useMemo(() => (teams ?? []).find(t => t.teamType === "own"), [teams]);
  const ownNameLower = ownTeam?.name.toLowerCase() ?? "";

  const homeTeamObj = useMemo(() => game ? teamMap[game.homeTeam.toLowerCase()] ?? null : null, [game, teamMap]);
  const awayTeamObj = useMemo(() => game ? teamMap[game.awayTeam.toLowerCase()] ?? null : null, [game, teamMap]);

  const rivalTeam = useMemo(() => {
    if (!game) return null;
    const homeL = game.homeTeam.toLowerCase();
    if (ownNameLower && homeL === ownNameLower) return awayTeamObj;
    return homeTeamObj ?? awayTeamObj;
  }, [game, ownNameLower, homeTeamObj, awayTeamObj]);

  const prepPct = Math.round((Object.values(checklist).filter(Boolean).length / 4) * 100);

  // H2H results from all games
  const { data: allGamesList } = useListGames({ query: { queryKey: getListGamesQueryKey() } });
  const h2hResults = useMemo(() => {
    if (!game || !allGamesList) return [];
    const homeL = game.homeTeam.toLowerCase();
    const awayL = game.awayTeam.toLowerCase();
    const todayKey = new Date().toISOString().slice(0, 10);
    return allGamesList
      .filter(g =>
        g.id !== gameId &&
        g.date < todayKey &&
        g.homeScore != null && g.awayScore != null &&
        ((g.homeTeam.toLowerCase() === homeL && g.awayTeam.toLowerCase() === awayL) ||
         (g.homeTeam.toLowerCase() === awayL && g.awayTeam.toLowerCase() === homeL))
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map(g => ({ date: g.date, home: g.homeTeam, away: g.awayTeam, hs: g.homeScore!, as: g.awayScore! }));
  }, [game, allGamesList, gameId]);

  // Difficulty helpers
  const diffStars: Record<string, number> = { facil: 2, medio: 3, importante: 5 };

  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  const daysLeft = (d: string) => Math.max(0, Math.floor((new Date(d + "T23:59:59").getTime() - Date.now()) / 86_400_000));

  if (gameLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Trophy className="h-12 w-12 text-white/10" />
        <p className="text-white/40">Partido no encontrado</p>
        <Link href="/games"><button className="text-sm text-primary hover:underline">← Volver a Partidos</button></Link>
      </div>
    );
  }

  const isUpcoming = game.date >= new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-0">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#111827] overflow-hidden mb-4">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <Link href="/games">
            <button className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition">
              <ArrowLeft className="h-3.5 w-3.5" /> Partidos
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <DiffBadge diff={game.difficulty} />
            {isUpcoming && (
              <span className="text-[11px] font-black text-primary/80 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                {daysLeft(game.date) === 0 ? "HOY" : `${daysLeft(game.date)}d`}
              </span>
            )}
            <Link href={`/scouting/reports/new?gameId=${gameId}`}>
              <button
                data-testid="button-create-scouting-report"
                className="text-[11px] font-black text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2.5 py-1 rounded-full transition"
              >
                Crear Informe Pro
              </button>
            </Link>
            <GameReportExportButton gameProps={{
              gameId,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              date: game.date,
              location: game.location,
              difficulty: game.difficulty,
              homeScore: game.homeScore,
              awayScore: game.awayScore,
              homeLogoUrl: homeTeamObj?.logoUrl,
              awayLogoUrl: awayTeamObj?.logoUrl,
              rivalTeamId: rivalTeam?.id ?? null,
              rivalName: rivalTeam?.name ?? (game.homeTeam === ownTeam?.name ? game.awayTeam : game.homeTeam),
              scout,
              plays,
            }} />
            <Link href={`/games/${gameId}/edit`}>
              <button className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 transition flex items-center justify-center text-white/40 hover:text-white/70">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </Link>
          </div>
        </div>

        {/* Match hero */}
        <div className="px-5 py-6">
          <div className="flex items-center justify-around gap-4">
            {/* Home team */}
            <div className="flex flex-col items-center gap-3 flex-1">
              <TeamAvatar name={game.homeTeam} logoUrl={homeTeamObj?.logoUrl ?? null} size="lg" />
              <div className="text-center">
                <p className="font-black text-white text-base uppercase leading-tight">{game.homeTeam}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest">Local</p>
                {homeTeamObj && (
                  <Link href={`/teams/${homeTeamObj.id}`}>
                    <span className="text-[10px] text-primary/60 hover:text-primary transition cursor-pointer">Ver equipo →</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Center */}
            <div className="text-center shrink-0 px-4">
              {game.homeScore != null && game.awayScore != null ? (
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-white">{game.homeScore}</span>
                  <span className="text-xl font-black text-white/20">–</span>
                  <span className="text-4xl font-black text-white">{game.awayScore}</span>
                </div>
              ) : (
                <span className="text-2xl font-black text-white/20 tracking-widest">VS</span>
              )}
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-1.5 justify-center text-xs text-white/40">
                  <Calendar className="h-3 w-3" />
                  <span className="capitalize">{fmtDate(game.date)}</span>
                </div>
                {game.location && (
                  <div className="flex items-center gap-1.5 justify-center text-xs text-white/30">
                    <MapPin className="h-3 w-3" />
                    {game.location}
                  </div>
                )}
              </div>
            </div>

            {/* Away team */}
            <div className="flex flex-col items-center gap-3 flex-1">
              <TeamAvatar name={game.awayTeam} logoUrl={awayTeamObj?.logoUrl ?? null} size="lg" />
              <div className="text-center">
                <p className="font-black text-white text-base uppercase leading-tight">{game.awayTeam}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest">Visitante</p>
                {awayTeamObj && (
                  <Link href={`/teams/${awayTeamObj.id}`}>
                    <span className="text-[10px] text-primary/60 hover:text-primary transition cursor-pointer">Ver equipo →</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Prep ring */}
            <div className="hidden md:flex flex-col items-center gap-2 shrink-0 pl-4 border-l border-white/[0.06]">
              <CircleRing percent={prepPct} />
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Preparación</p>
              {game.difficulty && (
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={`h-3 w-3 ${i <= (diffStars[game.difficulty!] ?? 0) ? "fill-amber-400 text-amber-400" : "text-white/10"}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="border-t border-white/[0.06] px-2 overflow-x-auto">
          <div className="flex">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-black uppercase tracking-wide whitespace-nowrap border-b-2 transition ${
                  activeTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-white/35 hover:text-white/60 hover:border-white/10"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="pb-8">
        {activeTab === "resumen" && (
          <TabResumen scout={scout} onChange={setScout} checklist={checklist} />
        )}
        {activeTab === "scouting" && (
          <TabScouting scout={scout} onChange={setScout} />
        )}
        {activeTab === "plantilla" && (
          <TabPlantilla
            rivalTeamId={rivalTeam?.id ?? null}
            rivalName={rivalTeam?.name ?? (game.homeTeam === ownTeam?.name ? game.awayTeam : game.homeTeam)}
            allGamesList={allGamesList ?? []}
          />
        )}
        {activeTab === "videos" && (
          <TabVideos rivalName={rivalTeam?.name ?? game.awayTeam} />
        )}
        {activeTab === "playbook" && (
          <TabPlaybook gameId={gameId} rivalName={rivalTeam?.name ?? game.awayTeam} />
        )}
        {activeTab === "estadisticas" && (
          <TabEstadisticas
            homeTeam={game.homeTeam} awayTeam={game.awayTeam}
            homeScore={game.homeScore} awayScore={game.awayScore}
            h2hResults={h2hResults}
            rivalTeamId={rivalTeam?.id ?? null}
          />
        )}
        {activeTab === "informe" && (
          <TabInforme
            game={game} scout={scout} checklist={checklist}
            homeTeamLogo={homeTeamObj?.logoUrl}
            awayTeamLogo={awayTeamObj?.logoUrl}
            rivalTeamLogo={rivalTeam?.id === awayTeamObj?.id ? awayTeamObj?.logoUrl : homeTeamObj?.logoUrl}
            gameId={gameId}
            rivalTeamId={rivalTeam?.id ?? null}
            rivalName={rivalTeam?.name ?? (game.homeTeam === ownTeam?.name ? game.awayTeam : game.homeTeam)}
          />
        )}
        {activeTab === "tareas" && (
          <TabTareas gameId={gameId} checklist={checklist} onChange={setChecklist} />
        )}
      </div>
    </div>
  );
}
