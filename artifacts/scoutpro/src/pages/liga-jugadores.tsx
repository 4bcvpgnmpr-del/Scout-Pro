import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronRight, ChevronDown, Shield, Users, BarChart2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LigaOption {
  shortName: string;
  name: string;
  gender: string;
}

interface TeamOption {
  id: string;
  name: string;
  logoUrl: string | null;
  leagueName: string;
  leagueFullName: string;
  gender: string;
  playerCount: number;
}

interface LigaJugador {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  nationality: string | null;
  photoUrl: string | null;
  teamName: string;
  leagueName: string;
  leagueFullName: string;
  seasonName: string;
  gamesPlayed: number;
  minutesAvg: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg2Made: number;
  fg2Att: number;
  fg3Made: number;
  fg3Att: number;
  ftMade: number;
  ftAtt: number;
  pir: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LIGA_LABEL: Record<string, string> = {
  "primera-feb": "1ª FEB",
  "segunda-feb": "2ª FEB",
  "tercera-feb": "3ª FEB",
  "liga-femenina-endesa": "LF Endesa",
  "lf-challenge": "LF Challenge",
  "lf2": "LF2",
};

const LIGA_ORDER: Record<string, number> = {
  "primera-feb": 1, "segunda-feb": 2, "tercera-feb": 3,
  "liga-femenina-endesa": 4, "lf-challenge": 5, "lf2": 6,
};

const POS_COLOR: Record<string, string> = {
  PG: "bg-blue-900/60 text-blue-300",
  SG: "bg-purple-900/60 text-purple-300",
  SF: "bg-emerald-900/60 text-emerald-300",
  PF: "bg-orange-900/60 text-orange-300",
  C:  "bg-red-900/60 text-red-300",
};

function pct(made: number, att: number) {
  return att ? ((made / att) * 100).toFixed(1) + "%" : "—";
}
function fmt(v: number | null | undefined, dec = 1) {
  if (v == null) return "—";
  return Number(v).toFixed(dec);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatBig({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-zinc-800/50 rounded-xl px-4 py-3">
      <div className="text-2xl font-black tabular-nums text-zinc-100">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</div>
      {sub && <div className="text-[9px] text-zinc-600">{sub}</div>}
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/50 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${accent ? "text-emerald-400" : "text-zinc-200"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Team node (lazy-loads players when expanded) ─────────────────────────────

function TeamNode({
  team,
  selectedPlayerId,
  onSelectPlayer,
}: {
  team: TeamOption;
  selectedPlayerId: string | null;
  onSelectPlayer: (p: LigaJugador) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data: players = [], isLoading } = useQuery<LigaJugador[]>({
    queryKey: ["liga-jugadores-team", team.id],
    queryFn:  () => fetch(`/api/liga-jugadores?teamId=${team.id}&limit=30`).then((r) => r.json()),
    enabled:  open,
  });

  return (
    <div>
      {/* Team row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-zinc-800/50 transition-colors group"
      >
        {open
          ? <ChevronDown size={11} className="text-zinc-500 shrink-0" />
          : <ChevronRight size={11} className="text-zinc-500 shrink-0" />
        }
        {team.logoUrl ? (
          <img src={team.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />
        ) : (
          <Shield size={11} className="text-zinc-600 shrink-0" />
        )}
        <span className="text-[11px] text-zinc-400 truncate flex-1 group-hover:text-zinc-200 transition-colors">
          {team.name}
        </span>
        <span className="text-[9px] text-zinc-600 shrink-0">{team.playerCount}</span>
      </button>

      {/* Players */}
      {open && (
        <div className="bg-zinc-900/30">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-8 py-1">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))
            : players.map((p) => {
                const name = `${p.firstName} ${p.lastName}`;
                const isSelected = selectedPlayerId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectPlayer(p)}
                    className={`w-full flex items-center gap-2 px-7 py-1.5 text-left transition-colors ${
                      isSelected
                        ? "bg-primary/15 border-l-2 border-primary"
                        : "border-l-2 border-transparent hover:bg-zinc-800/40"
                    }`}
                  >
                    <Avatar className="w-5 h-5 shrink-0">
                      <AvatarImage src={p.photoUrl ?? undefined} />
                      <AvatarFallback className="text-[7px] bg-zinc-800">
                        {p.firstName[0]}{p.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`text-[10px] truncate flex-1 ${isSelected ? "text-zinc-100 font-medium" : "text-zinc-500"}`}>
                      {name}
                    </span>
                    {p.position && (
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded shrink-0 ${POS_COLOR[p.position] ?? "bg-zinc-700/50 text-zinc-400"}`}>
                        {p.position}
                      </span>
                    )}
                  </button>
                );
              })}
        </div>
      )}
    </div>
  );
}

// ─── League node ──────────────────────────────────────────────────────────────

function LeagueNode({
  liga,
  selectedPlayerId,
  onSelectPlayer,
}: {
  liga: LigaOption;
  selectedPlayerId: string | null;
  onSelectPlayer: (p: LigaJugador) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data: teams = [], isLoading } = useQuery<TeamOption[]>({
    queryKey: ["liga-jugadores-equipos", liga.shortName],
    queryFn:  () => fetch(`/api/liga-jugadores/equipos?liga=${liga.shortName}`).then((r) => r.json()),
    enabled:  open,
  });

  const label = LIGA_LABEL[liga.shortName] ?? liga.shortName;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${liga.gender === "F" ? "bg-pink-400" : "bg-blue-400"}`} />
          <span className="text-xs font-semibold text-zinc-300">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLoading && <div className="w-3 h-3 rounded-full border border-t-zinc-300 border-zinc-700 animate-spin" />}
          {open ? <ChevronDown size={11} className="text-zinc-500" /> : <ChevronRight size={11} className="text-zinc-500" />}
        </div>
      </button>

      {open && (
        <div>
          {teams.map((team) => (
            <TeamNode
              key={team.id}
              team={team}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={onSelectPlayer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Player stats panel ───────────────────────────────────────────────────────

function PlayerPanel({ player }: { player: LigaJugador }) {
  const name = `${player.firstName} ${player.lastName}`;
  const initials = `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`;
  const posColor = player.position ? (POS_COLOR[player.position] ?? "bg-zinc-700/50 text-zinc-300") : "";

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      {/* Player header */}
      <div className="flex items-start gap-4">
        <Avatar className="w-16 h-16 shrink-0 rounded-xl">
          <AvatarImage src={player.photoUrl ?? undefined} className="object-cover" />
          <AvatarFallback className="text-lg bg-zinc-800 rounded-xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black uppercase text-zinc-100 leading-tight truncate">{name}</h2>
          <p className="text-sm text-zinc-400 mt-0.5 truncate">{player.teamName}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-700/60 text-zinc-400">
              {LIGA_LABEL[player.leagueName] ?? player.leagueName} · {player.seasonName}
            </span>
            {player.position && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${posColor}`}>
                {player.position}
              </span>
            )}
            {player.nationality && (
              <span className="text-[10px] text-zinc-500">{player.nationality}</span>
            )}
          </div>
        </div>
      </div>

      {/* Big stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatBig label="Puntos" value={fmt(player.points)} sub={`${player.gamesPlayed} PJ`} />
        <StatBig label="Rebotes" value={fmt(player.rebounds)} />
        <StatBig label="Asistencias" value={fmt(player.assists)} />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-800/30 rounded-xl px-4 py-3 space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Defensa / Balón</div>
          <StatRow label="Robos" value={fmt(player.steals)} />
          <StatRow label="Tapones" value={fmt(player.blocks)} />
          <StatRow label="Pérdidas" value={fmt(player.turnovers)} />
          <StatRow label="Minutos" value={fmt(player.minutesAvg)} />
        </div>
        <div className="bg-zinc-800/30 rounded-xl px-4 py-3 space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Tiro</div>
          <StatRow label="T2%" value={pct(player.fg2Made, player.fg2Att)} />
          <StatRow label="T3%" value={pct(player.fg3Made, player.fg3Att)} />
          <StatRow label="TL%" value={pct(player.ftMade, player.ftAtt)} />
          <StatRow
            label="PIR"
            value={player.pir != null ? fmt(player.pir, 0) : "—"}
            accent={(player.pir ?? 0) >= 15}
          />
        </div>
      </div>

      {/* Shooting detail */}
      <div className="bg-zinc-800/30 rounded-xl px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Desglose de tiro</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "2 Pts", made: player.fg2Made, att: player.fg2Att },
            { label: "3 Pts", made: player.fg3Made, att: player.fg3Att },
            { label: "Tiros Libres", made: player.ftMade, att: player.ftAtt },
          ].map(({ label, made, att }) => {
            const ratio = att ? made / att : 0;
            return (
              <div key={label} className="space-y-1">
                <div className="text-[9px] text-zinc-500">{label}</div>
                <div className="text-sm font-bold text-zinc-200">{pct(made, att)}</div>
                <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                  />
                </div>
                <div className="text-[9px] text-zinc-600">{fmt(made, 1)} / {fmt(att, 1)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LigaJugadores() {
  const [selectedPlayer, setSelectedPlayer] = useState<LigaJugador | null>(null);

  const { data: ligas = [] } = useQuery<LigaOption[]>({
    queryKey: ["liga-jugadores-ligas"],
    queryFn:  () => fetch("/api/liga-jugadores/ligas").then((r) => r.json()),
    select:   (d) => [...d].sort((a, b) =>
      (LIGA_ORDER[a.shortName] ?? 99) - (LIGA_ORDER[b.shortName] ?? 99)
    ),
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -mt-6 -mx-6 overflow-hidden">

      {/* ── Left: Liga → Equipo → Jugador tree ─────────────────────────────── */}
      <div className="w-64 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden bg-zinc-900/40">
        <div className="px-3 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Users size={13} className="text-zinc-500" />
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Base de Datos FEB
          </h2>
        </div>
        <div className="overflow-y-auto flex-1 py-1">
          {ligas.length === 0
            ? <div className="px-3 py-8 text-center text-zinc-600 text-xs">Cargando…</div>
            : ligas.map((liga) => (
                <LeagueNode
                  key={liga.shortName}
                  liga={liga}
                  selectedPlayerId={selectedPlayer?.id ?? null}
                  onSelectPlayer={setSelectedPlayer}
                />
              ))
          }
        </div>
      </div>

      {/* ── Right: Player stats panel ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedPlayer ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600">
            <BarChart2 size={40} className="opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">Selecciona un jugador</p>
              <p className="text-xs mt-1 text-zinc-700">Abre una liga → equipo → jugador</p>
            </div>
          </div>
        ) : (
          <PlayerPanel player={selectedPlayer} />
        )}
      </div>
    </div>
  );
}
