import { useState, useCallback, useMemo } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetGame, useListTeams, useListPlayers, useListGames,
  getGetGameQueryKey, getListTeamsQueryKey, getListPlayersQueryKey, getListGamesQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowLeft, Calendar, MapPin, Star, CheckCircle2, Circle,
  Download, Loader2, Users, Video, Swords, BarChart2, Target,
  Shield, TrendingUp, Plus, Trash2, FileText, MessageSquare,
  Activity, Pencil, Trophy, Zap, BookOpen, ChevronRight,
} from "lucide-react";
import { useExportPdf } from "@/hooks/use-export-pdf";
import { DIFFICULTY_LABEL } from "@/lib/difficulty";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "resumen" | "scouting" | "rival" | "videos" | "jugadas" | "estadisticas" | "informe" | "tareas";

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
  { id: "rival", label: "Rival", icon: Users },
  { id: "videos", label: "Vídeos", icon: Video },
  { id: "jugadas", label: "Jugadas", icon: Swords },
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

// ── Tab: Rival ────────────────────────────────────────────────────────────────
function TabRival({ rivalTeamId, rivalName }: { rivalTeamId: number | null; rivalName: string }) {
  const { data: players, isLoading } = useListPlayers(
    rivalTeamId ? { teamId: rivalTeamId } : undefined,
    { query: { enabled: !!rivalTeamId, queryKey: getListPlayersQueryKey(rivalTeamId ? { teamId: rivalTeamId } : undefined) } },
  );
  const positions: Record<string, string> = { PG: "Base", SG: "Escolta", SF: "Alero", PF: "Ala-Pívot", C: "Pívot" };
  return (
    <div className="space-y-4">
      <MCard>
        <div className="flex items-center justify-between mb-5">
          <SLabel icon={Users} label={`Plantilla · ${rivalName}`} />
          {rivalTeamId && (
            <Link href={`/teams/${rivalTeamId}`}>
              <button className="text-xs text-white/40 hover:text-primary transition flex items-center gap-1">
                Ver equipo <ChevronRight className="h-3 w-3" />
              </button>
            </Link>
          )}
        </div>
        {!rivalTeamId ? (
          <div className="py-10 text-center">
            <Users className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">El equipo rival no está registrado en ScoutFlow</p>
            <Link href="/equipos">
              <button className="mt-3 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl transition">
                Ir a Equipos
              </button>
            </Link>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}</div>
        ) : !players || players.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">No hay jugadoras registradas para este equipo</p>
            <Link href={`/teams/${rivalTeamId}`}>
              <button className="mt-3 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl transition flex items-center gap-1 mx-auto">
                <Plus className="h-3.5 w-3.5" /> Añadir jugadoras
              </button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["#", "Nombre", "Posición", "Edad", "Alt.", "Nac."].map(h => (
                    <th key={h} className="text-left text-[10px] text-white/30 uppercase tracking-widest font-black py-2 px-3 first:pl-0">{h}</th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition group">
                    <td className="py-3 px-3 pl-0 text-sm text-white/30 font-mono w-10">{p.jerseyNumber ?? "—"}</td>
                    <td className="py-3 px-3 font-semibold text-white/85 text-sm">{p.name}</td>
                    <td className="py-3 px-3 text-sm text-white/50">{positions[p.position ?? ""] ?? p.position ?? "—"}</td>
                    <td className="py-3 px-3 text-sm text-white/50">{p.age ?? "—"}</td>
                    <td className="py-3 px-3 text-sm text-white/40">{p.height ?? "—"}</td>
                    <td className="py-3 px-3 text-sm text-white/40">{p.nationality ?? "—"}</td>
                    <td className="py-3 pr-0">
                      <Link href={`/players/${p.id}`}>
                        <button className="opacity-0 group-hover:opacity-100 transition text-white/30 hover:text-primary">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MCard>

      <div className="text-[11px] text-white/25 text-center">
        En el futuro esta información se actualizará automáticamente desde FEB.
      </div>
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

// ── Tab: Jugadas ──────────────────────────────────────────────────────────────
function TabJugadas() {
  return (
    <div className="space-y-4">
      <MCard>
        <SLabel icon={Swords} label="Jugadas y Sistemas" color="text-cyan-400" />
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
            <Swords className="h-8 w-8 text-cyan-400/50" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/60">Asocia jugadas a este partido</p>
            <p className="text-xs text-white/30 mt-1">Accede a la biblioteca de jugadas para seleccionarlas</p>
          </div>
          <Link href="/jugadas">
            <button className="text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-5 py-2.5 rounded-xl transition font-bold flex items-center gap-2">
              <Swords className="h-4 w-4" /> Ir a Jugadas
            </button>
          </Link>
        </div>
      </MCard>
    </div>
  );
}

// ── Tab: Estadísticas ─────────────────────────────────────────────────────────
function TabEstadisticas({ homeTeam, awayTeam, homeScore, awayScore, h2hResults }: {
  homeTeam: string; awayTeam: string;
  homeScore?: number | null; awayScore?: number | null;
  h2hResults: { date: string; home: string; away: string; hs: number; as: number }[];
}) {
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

      <MCard>
        <SLabel icon={BarChart2} label="Estadísticas Avanzadas" color="text-amber-400" />
        <div className="py-8 text-center">
          <p className="text-sm text-white/40">Las estadísticas avanzadas estarán disponibles próximamente</p>
          <p className="text-xs text-white/25 mt-1">Se conectarán con la FEB en futuras versiones</p>
        </div>
      </MCard>
    </div>
  );
}

// ── Tab: Informe ──────────────────────────────────────────────────────────────
function TabInforme({ game, scout, checklist, homeTeamLogo, awayTeamLogo, gameId }: {
  game: { homeTeam: string; awayTeam: string; date: string; location?: string | null; difficulty?: string | null; homeScore?: number | null; awayScore?: number | null };
  scout: ScoutingData; checklist: Checklist;
  homeTeamLogo?: string | null; awayTeamLogo?: string | null;
  gameId: number;
}) {
  const { contentRef, exportPdf, exporting } = useExportPdf(`informe-${game.homeTeam}-vs-${game.awayTeam}-${game.date}`);
  const prepPct = Math.round((Object.values(checklist).filter(Boolean).length / 4) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-white text-lg">Informe de Scouting</h3>
          <p className="text-xs text-white/40 mt-0.5">{game.homeTeam} vs {game.awayTeam} · {new Date(game.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <button
          onClick={exportPdf}
          disabled={exporting}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black px-5 py-2.5 rounded-xl transition text-sm shadow-lg shadow-primary/20 disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generar PDF
        </button>
      </div>

      {/* Printable content */}
      <div ref={contentRef} className="space-y-4 bg-[#0a0f1a] p-2 rounded-2xl">
        {/* Cover */}
        <MCard className="text-center py-8">
          <div className="flex items-center justify-center gap-6 mb-6">
            <TeamAvatar name={game.homeTeam} logoUrl={homeTeamLogo} size="lg" />
            <div>
              <p className="text-3xl font-black text-white/20">VS</p>
              {game.homeScore != null && game.awayScore != null && (
                <p className="text-2xl font-black text-primary mt-1">{game.homeScore} – {game.awayScore}</p>
              )}
            </div>
            <TeamAvatar name={game.awayTeam} logoUrl={awayTeamLogo} size="lg" />
          </div>
          <h2 className="text-xl font-black text-white mb-1">{game.homeTeam} <span className="text-white/30">vs</span> {game.awayTeam}</h2>
          <p className="text-sm text-white/50">{new Date(game.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          {game.location && <p className="text-sm text-white/40 mt-1">{game.location}</p>}
          {game.difficulty && <DiffBadge diff={game.difficulty} />}
          <div className="mt-4 inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5">
            <span className="text-sm font-black text-green-400">{prepPct}% Preparado</span>
          </div>
        </MCard>

        {/* Claves */}
        {scout.clavesPartido && (
          <MCard>
            <SLabel icon={BookOpen} label="Claves del Partido" />
            <p className="text-sm text-white/75 whitespace-pre-wrap leading-relaxed">{scout.clavesPartido}</p>
          </MCard>
        )}

        {/* Fortalezas/Debilidades */}
        {(scout.fortalezas.length > 0 || scout.debilidades.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {scout.fortalezas.length > 0 && (
              <MCard>
                <SLabel icon={TrendingUp} label="Fortalezas del Rival" color="text-red-400" />
                {scout.fortalezas.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <ChevronRight className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-white/75">{f}</span>
                  </div>
                ))}
              </MCard>
            )}
            {scout.debilidades.length > 0 && (
              <MCard>
                <SLabel icon={Shield} label="Debilidades del Rival" color="text-green-400" />
                {scout.debilidades.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <ChevronRight className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-white/75">{d}</span>
                  </div>
                ))}
              </MCard>
            )}
          </div>
        )}

        {/* Scouting Ataque/Defensa */}
        {(scout.sistemas || scout.ritmo || scout.tipoDefensa || scout.presion) && (
          <div className="grid grid-cols-2 gap-4">
            {(scout.sistemas || scout.ritmo || scout.generadoras) && (
              <MCard>
                <SLabel icon={Zap} label="Ataque" color="text-orange-400" />
                {scout.sistemas && <div className="mb-2"><p className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-0.5">Sistemas</p><p className="text-sm text-white/75">{scout.sistemas}</p></div>}
                {scout.ritmo && <div className="mb-2"><p className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-0.5">Ritmo</p><p className="text-sm text-white/75">{scout.ritmo}</p></div>}
                {scout.generadoras && <div><p className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-0.5">Generadoras</p><p className="text-sm text-white/75">{scout.generadoras}</p></div>}
              </MCard>
            )}
            {(scout.tipoDefensa || scout.presion || scout.pickRoll) && (
              <MCard>
                <SLabel icon={Shield} label="Defensa" color="text-blue-400" />
                {scout.tipoDefensa && <div className="mb-2"><p className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-0.5">Tipo</p><p className="text-sm text-white/75">{scout.tipoDefensa}</p></div>}
                {scout.presion && <div className="mb-2"><p className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-0.5">Presión</p><p className="text-sm text-white/75">{scout.presion}</p></div>}
                {scout.pickRoll && <div><p className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-0.5">Pick & Roll</p><p className="text-sm text-white/75">{scout.pickRoll}</p></div>}
              </MCard>
            )}
          </div>
        )}

        {/* Jugadoras / Objetivos */}
        {(scout.jugadorasDestacadas || scout.objetivos) && (
          <div className="grid grid-cols-2 gap-4">
            {scout.jugadorasDestacadas && (
              <MCard>
                <SLabel icon={Star} label="Jugadoras Destacadas" color="text-amber-400" />
                <p className="text-sm text-white/75 whitespace-pre-wrap">{scout.jugadorasDestacadas}</p>
              </MCard>
            )}
            {scout.objetivos && (
              <MCard>
                <SLabel icon={Target} label="Objetivos del Partido" color="text-blue-400" />
                <p className="text-sm text-white/75 whitespace-pre-wrap">{scout.objetivos}</p>
              </MCard>
            )}
          </div>
        )}

        {/* Notas */}
        {scout.notasEntrenador && (
          <MCard>
            <SLabel icon={MessageSquare} label="Notas del Entrenador" />
            <p className="text-sm text-white/75 whitespace-pre-wrap leading-relaxed">{scout.notasEntrenador}</p>
          </MCard>
        )}
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
    <div className="max-w-xl mx-auto space-y-4">
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
        {activeTab === "rival" && (
          <TabRival rivalTeamId={rivalTeam?.id ?? null} rivalName={rivalTeam?.name ?? (game.homeTeam === ownTeam?.name ? game.awayTeam : game.homeTeam)} />
        )}
        {activeTab === "videos" && (
          <TabVideos rivalName={rivalTeam?.name ?? game.awayTeam} />
        )}
        {activeTab === "jugadas" && (
          <TabJugadas />
        )}
        {activeTab === "estadisticas" && (
          <TabEstadisticas
            homeTeam={game.homeTeam} awayTeam={game.awayTeam}
            homeScore={game.homeScore} awayScore={game.awayScore}
            h2hResults={h2hResults}
          />
        )}
        {activeTab === "informe" && (
          <TabInforme
            game={game} scout={scout} checklist={checklist}
            homeTeamLogo={homeTeamObj?.logoUrl} awayTeamLogo={awayTeamObj?.logoUrl}
            gameId={gameId}
          />
        )}
        {activeTab === "tareas" && (
          <TabTareas gameId={gameId} checklist={checklist} onChange={setChecklist} />
        )}
      </div>
    </div>
  );
}
