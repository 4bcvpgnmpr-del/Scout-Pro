import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListGames, useListTeams,
  getListGamesQueryKey, getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { DIFFICULTY_BADGE, DIFFICULTY_LABEL } from "@/lib/difficulty";
import {
  Swords, Calendar, Shield, ChevronRight, ChevronDown,
  Columns, Plus,
} from "lucide-react";

// ── Kanban status ─────────────────────────────────────────────────────────────
type KanbanStatus = "pendiente" | "en-progreso" | "revisar" | "completado" | "archivado";

const COLUMNS: {
  id: KanbanStatus; label: string; color: string;
  bg: string; border: string; dot: string; headerBg: string;
}[] = [
  {
    id: "pendiente", label: "Pendiente",
    color: "text-slate-300", bg: "bg-slate-800/40", border: "border-slate-600/20",
    dot: "bg-slate-400", headerBg: "bg-slate-600/20",
  },
  {
    id: "en-progreso", label: "En progreso",
    color: "text-blue-400", bg: "bg-blue-950/30", border: "border-blue-500/20",
    dot: "bg-blue-500", headerBg: "bg-blue-500/15",
  },
  {
    id: "revisar", label: "Revisar",
    color: "text-amber-400", bg: "bg-amber-950/20", border: "border-amber-500/20",
    dot: "bg-amber-500", headerBg: "bg-amber-500/15",
  },
  {
    id: "completado", label: "Completado",
    color: "text-green-400", bg: "bg-green-950/20", border: "border-green-500/20",
    dot: "bg-green-500", headerBg: "bg-green-500/15",
  },
  {
    id: "archivado", label: "Archivado",
    color: "text-muted-foreground", bg: "bg-muted/10", border: "border-border/40",
    dot: "bg-muted-foreground/40", headerBg: "bg-muted/20",
  },
];

// ── Scouting helpers ──────────────────────────────────────────────────────────
type ScoutingData = {
  clavesPartido: string; jugadorasDestacadas: string;
  sistemas: string; ritmo: string; generadoras: string; ataqueObs: string;
  tipoDefensa: string; presion: string; pickRoll: string; zona: string; defensaObs: string;
  contraataque: string; balance: string; transicionObs: string;
  fortalezas: string[]; debilidades: string[];
  objetivos: string; notasEntrenador: string;
};

function hasScouting(id: number): boolean {
  try {
    const raw = localStorage.getItem(`sf-scouting-${id}`);
    if (!raw) return false;
    const d = JSON.parse(raw) as Partial<ScoutingData>;
    return !!(
      d.clavesPartido || d.objetivos || d.notasEntrenador ||
      (d.fortalezas && d.fortalezas.length > 0) ||
      (d.debilidades && d.debilidades.length > 0) ||
      d.sistemas || d.tipoDefensa
    );
  } catch { return false; }
}

function scoutingProgress(id: number): number {
  try {
    const raw = localStorage.getItem(`sf-scouting-${id}`);
    if (!raw) return 0;
    const d = JSON.parse(raw) as Partial<ScoutingData>;
    const fields = [d.clavesPartido, d.objetivos, d.sistemas, d.tipoDefensa, d.contraataque, d.notasEntrenador];
    const filled = fields.filter((f) => f && (f as string).trim()).length;
    const tagsFilled = ((d.fortalezas?.length ?? 0) + (d.debilidades?.length ?? 0)) > 0 ? 1 : 0;
    return Math.round(((filled + tagsFilled) / (fields.length + 1)) * 100);
  } catch { return 0; }
}

// ── Kanban status persistence ─────────────────────────────────────────────────
function getAutoStatus(gameDate: string, gameId: number, todayKey: string): KanbanStatus {
  const isPast = gameDate < todayKey;
  const hasData = hasScouting(gameId);
  if (isPast && !hasData) return "archivado";
  if (isPast && hasData) return "completado";
  if (!isPast && hasData) return "en-progreso";
  return "pendiente";
}

function getKanbanStatus(gameDate: string, gameId: number, todayKey: string): KanbanStatus {
  const saved = localStorage.getItem(`sf-kanban-${gameId}`);
  if (saved && COLUMNS.find((c) => c.id === saved)) return saved as KanbanStatus;
  return getAutoStatus(gameDate, gameId, todayKey);
}

function setKanbanStatus(gameId: number, status: KanbanStatus) {
  localStorage.setItem(`sf-kanban-${gameId}`, status);
}

// ── Date helper ───────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

// ── KanbanCard ────────────────────────────────────────────────────────────────
type Game = {
  id: number; date: string; homeTeam: string; awayTeam: string;
  location?: string | null; difficulty?: string | null;
};
type Team = { id: number; name: string; logoUrl?: string | null };

function KanbanCard({
  game, teams, onStatusChange,
}: {
  game: Game; teams: Team[]; onStatusChange: (id: number, s: KanbanStatus) => void;
}) {
  const [, setLocation] = useLocation();
  const [showMenu, setShowMenu] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);
  const status = getKanbanStatus(game.date, game.id, todayKey);
  const progress = scoutingProgress(game.id);
  const isPast = game.date < todayKey;

  const teamLogoMap = Object.fromEntries(
    teams.filter((t) => t.logoUrl).map((t) => [t.name.toLowerCase(), t.logoUrl]),
  );
  const logoH = teamLogoMap[game.homeTeam?.toLowerCase() ?? ""];
  const logoA = teamLogoMap[game.awayTeam?.toLowerCase() ?? ""];

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 hover:border-primary/40 transition cursor-pointer group relative shadow-sm">
      {/* Status dropdown */}
      <div
        className="absolute top-2 right-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowMenu((s) => !s)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-muted transition"
        >
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {showMenu && (
          <div className="absolute top-7 right-0 z-50 min-w-[150px] bg-card border border-border rounded-xl shadow-2xl py-1 text-xs">
            {COLUMNS.map((col) => (
              <button
                key={col.id}
                onClick={() => { onStatusChange(game.id, col.id); setShowMenu(false); }}
                className={`w-full text-left px-3 py-1.5 hover:bg-muted transition flex items-center gap-2 ${col.id === status ? "font-bold text-foreground" : "text-muted-foreground"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${col.dot}`} />
                {col.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card content */}
      <div onClick={() => setLocation(`/games/${game.id}/match-center`)}>
        {/* Logos */}
        <div className="flex items-center gap-1.5 mb-2.5">
          {[logoH, logoA].map((logo, i) => (
            <div key={i} className="h-7 w-7 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
              {logo
                ? <img src={logo} className="h-full w-full object-cover" alt="" />
                : <Shield className="h-3.5 w-3.5 text-muted-foreground/30" />}
            </div>
          ))}
          {isPast && (
            <span className="ml-auto text-[8px] font-bold uppercase tracking-wide text-muted-foreground/40 bg-muted/60 px-1.5 py-0.5 rounded-full">
              pasado
            </span>
          )}
        </div>

        <div className="text-[11px] font-bold leading-snug mb-1.5 pr-5">
          {game.homeTeam} <span className="text-primary/40 font-normal">vs</span> {game.awayTeam}
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
          <span className="text-[10px] text-muted-foreground/70">{fmtDate(game.date)}</span>
        </div>

        {game.difficulty && (
          <span className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full mb-2.5 ${DIFFICULTY_BADGE[game.difficulty] ?? "bg-muted text-muted-foreground"}`}>
            {DIFFICULTY_LABEL[game.difficulty] ?? game.difficulty}
          </span>
        )}

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">Scouting</span>
            <span className="text-[9px] font-bold text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progress >= 80 ? "bg-green-500" : progress >= 40 ? "bg-amber-500" : progress > 0 ? "bg-primary/60" : "bg-transparent"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ScoutingHub() {
  const { data: games = [] } = useListGames({ query: { queryKey: getListGamesQueryKey() } });
  const { data: teams = [] } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });
  const [tick, setTick] = useState(0);

  const todayKey = new Date().toISOString().slice(0, 10);

  const handleStatusChange = (id: number, status: KanbanStatus) => {
    setKanbanStatus(id, status);
    setTick((t) => t + 1);
  };

  const getColumn = (colId: KanbanStatus) =>
    games.filter((g) => getKanbanStatus(g.date, g.id, todayKey) === colId);

  // Force re-render when tick changes (eslint ignore — intentional)
  void tick;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Columns className="h-[18px] w-[18px] text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight leading-none">Hub de Scouting</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Gestiona el scouting de todos tus partidos · {games.length} partidos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/games/new">
              <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition shadow-sm">
                <Plus className="h-3.5 w-3.5" /> Nuevo Partido
              </button>
            </Link>
            <Link href="/">
              <button className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1">
                Dashboard <ChevronRight className="h-3 w-3" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="px-6 py-6 overflow-x-auto min-h-[calc(100vh-73px)]">
        {games.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Swords className="h-8 w-8 text-primary/30" />
            </div>
            <div>
              <div className="font-bold text-foreground/60 mb-1">Sin partidos registrados</div>
              <div className="text-sm text-muted-foreground/40 mb-4">
                Crea partidos para gestionar el scouting en el tablero.
              </div>
              <Link href="/games/new">
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition mx-auto">
                  <Plus className="h-4 w-4" /> Crear primer partido
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 min-w-max pb-4">
            {COLUMNS.map((col) => {
              const cards = getColumn(col.id);
              return (
                <div key={col.id} className="w-64 flex-shrink-0 flex flex-col">
                  {/* Column header */}
                  <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl ${col.headerBg}`}>
                    <span className={`h-2 w-2 rounded-full shrink-0 ${col.dot}`} />
                    <span className={`text-[11px] font-black uppercase tracking-widest ${col.color}`}>
                      {col.label}
                    </span>
                    <span className="ml-auto text-[10px] font-bold bg-background/40 px-1.5 py-0.5 rounded-full text-muted-foreground min-w-[20px] text-center">
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className={`rounded-2xl ${col.bg} border ${col.border} p-2 flex-1 min-h-[120px] space-y-2`}>
                    {cards.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground/25 text-[10px] uppercase tracking-widest">
                        Vacío
                      </div>
                    ) : (
                      cards.map((g) => (
                        <KanbanCard
                          key={g.id}
                          game={g}
                          teams={teams}
                          onStatusChange={handleStatusChange}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
