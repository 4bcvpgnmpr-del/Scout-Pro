import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useListGames, useListTeams, getListGamesQueryKey, getListTeamsQueryKey } from "@workspace/api-client-react";
import {
  Search, ChevronRight, Plus, Trash2, Calendar, Shield, BookOpen,
  TrendingUp, Zap, CheckCircle2, Circle, Target, Swords, Save,
} from "lucide-react";

// ── Types (same as game-match-center) ────────────────────────────────────────
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

function loadScouting(id: number): ScoutingData {
  try { return { ...DEFAULT_SCOUTING, ...JSON.parse(localStorage.getItem(`sf-scouting-${id}`) ?? "{}") }; }
  catch { return { ...DEFAULT_SCOUTING }; }
}
function saveScouting(id: number, d: ScoutingData) {
  localStorage.setItem(`sf-scouting-${id}`, JSON.stringify(d));
}
function hasScouting(id: number): boolean {
  try {
    const raw = localStorage.getItem(`sf-scouting-${id}`);
    if (!raw) return false;
    const d = JSON.parse(raw) as Partial<ScoutingData>;
    return !!(d.clavesPartido || d.objetivos || d.notasEntrenador ||
      (d.fortalezas && d.fortalezas.length > 0) || (d.debilidades && d.debilidades.length > 0) ||
      d.sistemas || d.tipoDefensa);
  } catch { return false; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SLabel({ icon: Icon, label, color = "text-primary" }: { icon: React.ElementType; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      <span className={`text-[11px] font-black uppercase tracking-widest ${color}`}>{label}</span>
    </div>
  );
}

function ScoutField({ label, value, onChange, placeholder = "Escribe aquí...", rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 resize-none transition"
      />
    </div>
  );
}

function TagList({ label, items, onAdd, onRemove, placeholder, color }: {
  label: string; items: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void;
  placeholder: string; color: string;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput("");
  };
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60 transition"
        />
        <button onClick={add} className="px-3 py-2 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition shrink-0">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span key={i} className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${color}`}>
              {item}
              <button onClick={() => onRemove(i)} className="hover:opacity-70 transition">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ScoutingHub() {
  const { data: games = [] } = useListGames({ query: { queryKey: getListGamesQueryKey() } });
  const { data: teams = [] } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scouting, setScouting] = useState<ScoutingData>({ ...DEFAULT_SCOUTING });
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "con" | "sin">("all");

  // Sort: upcoming first (asc), then past (desc)
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const sortedGames = [...games].sort((a, b) => {
    const aFuture = a.date >= todayKey;
    const bFuture = b.date >= todayKey;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    if (aFuture) return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });

  const filtered = sortedGames.filter((g) => {
    const label = `${g.homeTeam} vs ${g.awayTeam}`.toLowerCase();
    if (search && !label.includes(search.toLowerCase())) return false;
    if (filter === "con" && !hasScouting(g.id)) return false;
    if (filter === "sin" && hasScouting(g.id)) return false;
    return true;
  });

  const selectedGame = games.find((g) => g.id === selectedId) ?? null;

  const selectGame = useCallback((id: number) => {
    setSelectedId(id);
    setScouting(loadScouting(id));
    setSaved(false);
  }, []);

  const handleSave = () => {
    if (!selectedId) return;
    saveScouting(selectedId, scouting);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const upd = useCallback(<K extends keyof ScoutingData>(key: K, val: ScoutingData[K]) => {
    setScouting((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const addItem = (key: "fortalezas" | "debilidades", val: string) => {
    setScouting((prev) => ({ ...prev, [key]: [...prev[key], val] }));
    setSaved(false);
  };
  const removeItem = (key: "fortalezas" | "debilidades", i: number) => {
    setScouting((prev) => ({ ...prev, [key]: prev[key].filter((_, idx) => idx !== i) }));
    setSaved(false);
  };

  const teamLogoMap = Object.fromEntries(
    teams.filter((t) => t.logoUrl).map((t) => [t.name.toLowerCase(), t.logoUrl]),
  );

  const getRivalLogo = (game: typeof games[0]) => {
    const h = game.homeTeam?.toLowerCase() ?? "";
    const a = game.awayTeam?.toLowerCase() ?? "";
    return teamLogoMap[h] || teamLogoMap[a] || null;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Swords className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight leading-none">Hub de Scouting</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Adelanta y archiva el scouting de cualquier partido</p>
            </div>
          </div>
          <Link href="/">
            <button className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1">
              Dashboard <ChevronRight className="h-3 w-3" />
            </button>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6 h-[calc(100vh-73px)]">
        {/* ── LEFT: Game list ──────────────────────────────────────── */}
        <div className="w-80 flex flex-col shrink-0">
          {/* Filters */}
          <div className="mb-3">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar partido..."
                className="w-full pl-8 pr-3 py-2 bg-card border border-border rounded-xl text-sm outline-none focus:border-primary/60 transition"
              />
            </div>
            <div className="flex gap-1.5">
              {(["all", "con", "sin"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-1.5 rounded-lg transition ${filter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
                  {f === "all" ? "Todos" : f === "con" ? "Con Scouting" : "Sin Scouting"}
                </button>
              ))}
            </div>
          </div>

          {/* Game list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground/50 text-sm">Sin partidos</div>
            )}
            {filtered.map((g) => {
              const isSelected = g.id === selectedId;
              const hasData = hasScouting(g.id);
              const isPast = g.date < todayKey;
              const logo = getRivalLogo(g);
              return (
                <button
                  key={g.id}
                  onClick={() => selectGame(g.id)}
                  className={`w-full text-left p-3 rounded-xl border transition ${isSelected
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-card hover:border-primary/20 hover:bg-card/80"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {logo
                        ? <img src={logo} className="h-full w-full object-cover" alt="" />
                        : <Shield className="h-4 w-4 text-muted-foreground/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate leading-tight">
                        {g.homeTeam} vs {g.awayTeam}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" /> {fmtDate(g.date)}
                        </span>
                        {isPast && <span className="text-[9px] text-muted-foreground/40 uppercase">pasado</span>}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {hasData
                        ? <CheckCircle2 className="h-4 w-4 text-primary" />
                        : <Circle className="h-4 w-4 text-muted-foreground/20" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Scouting form ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedGame ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Swords className="h-8 w-8 text-primary/40" />
              </div>
              <div>
                <div className="font-bold text-foreground/60 mb-1">Selecciona un partido</div>
                <div className="text-sm text-muted-foreground/40">
                  Haz clic en cualquier partido para ver o editar su scouting.<br />
                  Los datos se sincronizan automáticamente con el Centro de Partido.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Game header */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <div className="text-xl font-black uppercase">
                      {selectedGame.homeTeam} <span className="text-primary/50">vs</span> {selectedGame.awayTeam}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <Calendar className="h-3 w-3" /> {fmtDate(selectedGame.date)}
                      {selectedGame.location && <><span>·</span> {selectedGame.location}</>}
                      {selectedGame.date < todayKey && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full uppercase font-bold">Partido pasado</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/games/${selectedGame.id}/match-center`}>
                      <button className="text-[10px] text-muted-foreground hover:text-primary transition flex items-center gap-1 px-2 py-1.5 rounded-lg border border-border hover:border-primary/30">
                        Centro de Partido <ChevronRight className="h-3 w-3" />
                      </button>
                    </Link>
                    <button
                      onClick={handleSave}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${saved ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saved ? "Guardado" : "Guardar"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Form sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Análisis ofensivo */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <SLabel icon={TrendingUp} label="Análisis Ofensivo" color="text-amber-400" />
                  <ScoutField label="Sistemas de ataque" value={scouting.sistemas} onChange={(v) => upd("sistemas", v)} rows={2} />
                  <ScoutField label="Ritmo de juego" value={scouting.ritmo} onChange={(v) => upd("ritmo", v)} rows={2} />
                  <ScoutField label="Jugadoras generadoras" value={scouting.generadoras} onChange={(v) => upd("generadoras", v)} rows={2} />
                  <ScoutField label="Observaciones ofensivas" value={scouting.ataqueObs} onChange={(v) => upd("ataqueObs", v)} rows={3} />
                </div>

                {/* Análisis defensivo */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <SLabel icon={Shield} label="Análisis Defensivo" color="text-blue-400" />
                  <ScoutField label="Tipo de defensa" value={scouting.tipoDefensa} onChange={(v) => upd("tipoDefensa", v)} rows={2} />
                  <ScoutField label="Presión y trapping" value={scouting.presion} onChange={(v) => upd("presion", v)} rows={2} />
                  <ScoutField label="Defensa del Pick & Roll" value={scouting.pickRoll} onChange={(v) => upd("pickRoll", v)} rows={2} />
                  <ScoutField label="Defensa de zona" value={scouting.zona} onChange={(v) => upd("zona", v)} rows={2} />
                  <ScoutField label="Observaciones defensivas" value={scouting.defensaObs} onChange={(v) => upd("defensaObs", v)} rows={3} />
                </div>

                {/* Transición */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <SLabel icon={Zap} label="Transición" color="text-purple-400" />
                  <ScoutField label="Contraataque" value={scouting.contraataque} onChange={(v) => upd("contraataque", v)} rows={2} />
                  <ScoutField label="Balance defensivo" value={scouting.balance} onChange={(v) => upd("balance", v)} rows={2} />
                  <ScoutField label="Observaciones de transición" value={scouting.transicionObs} onChange={(v) => upd("transicionObs", v)} rows={3} />
                </div>

                {/* Jugadoras + claves */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <SLabel icon={BookOpen} label="Claves del Partido" color="text-primary" />
                  <ScoutField label="Claves del partido" value={scouting.clavesPartido} onChange={(v) => upd("clavesPartido", v)} rows={3} />
                  <ScoutField label="Jugadoras a vigilar" value={scouting.jugadorasDestacadas} onChange={(v) => upd("jugadorasDestacadas", v)} rows={2} />
                  <ScoutField label="Objetivos del partido" value={scouting.objetivos} onChange={(v) => upd("objetivos", v)} rows={2} />
                </div>
              </div>

              {/* Fortalezas / Debilidades */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <SLabel icon={CheckCircle2} label="Fortalezas del Rival" color="text-red-400" />
                  <TagList
                    label=""
                    items={scouting.fortalezas}
                    onAdd={(v) => addItem("fortalezas", v)}
                    onRemove={(i) => removeItem("fortalezas", i)}
                    placeholder="Añadir fortaleza..."
                    color="bg-red-500/10 text-red-400 border-red-500/20"
                  />
                </div>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <SLabel icon={Target} label="Debilidades del Rival" color="text-green-400" />
                  <TagList
                    label=""
                    items={scouting.debilidades}
                    onAdd={(v) => addItem("debilidades", v)}
                    onRemove={(i) => removeItem("debilidades", i)}
                    placeholder="Añadir debilidad..."
                    color="bg-green-500/10 text-green-400 border-green-500/20"
                  />
                </div>
              </div>

              {/* Notas entrenador */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <SLabel icon={BookOpen} label="Notas del Entrenador" color="text-muted-foreground" />
                <ScoutField label="" value={scouting.notasEntrenador} onChange={(v) => upd("notasEntrenador", v)} rows={5} placeholder="Notas privadas del entrenador..." />
              </div>

              {/* Bottom save */}
              <div className="flex justify-end pb-6">
                <button
                  onClick={handleSave}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition ${saved ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                >
                  <Save className="h-4 w-4" />
                  {saved ? "¡Guardado!" : "Guardar Scouting"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
