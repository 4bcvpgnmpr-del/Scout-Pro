import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search, ChevronUp, ChevronDown, Minus,
  ChevronRight, Users, Shield,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

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

type SortKey = "points" | "rebounds" | "assists" | "steals" | "blocks" | "pir" | "gamesPlayed" | "minutesAvg";

const LIGA_ORDER: Record<string, number> = {
  "primera-feb": 1,
  "segunda-feb": 2,
  "tercera-feb": 3,
  "liga-femenina-endesa": 4,
  "lf-challenge": 5,
  "lf2": 6,
};

function pct(made: number, att: number): string {
  if (!att) return "—";
  return ((made / att) * 100).toFixed(0) + "%";
}
function fmt(v: number | null | undefined, dec = 1): string {
  if (v == null) return "—";
  return Number(v).toFixed(dec);
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <Minus size={9} className="opacity-20" />;
  return dir === "desc" ? <ChevronDown size={9} /> : <ChevronUp size={9} />;
}

const POSITION_COLORS: Record<string, string> = {
  PG: "bg-blue-900/50 text-blue-300",
  SG: "bg-purple-900/50 text-purple-300",
  SF: "bg-emerald-900/50 text-emerald-300",
  PF: "bg-orange-900/50 text-orange-300",
  C:  "bg-red-900/50 text-red-300",
};

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LigaJugadores() {
  const [selectedLiga, setSelectedLiga]   = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam]   = useState<TeamOption | null>(null);
  const [expandedLigas, setExpandedLigas] = useState<Set<string>>(new Set());
  const [search, setSearch]               = useState("");
  const [sortKey, setSortKey]             = useState<SortKey>("points");
  const [sortDir, setSortDir]             = useState<"asc" | "desc">("desc");

  // ── Ligas with player stats ──────────────────────────────────────────────────
  const { data: ligas = [] } = useQuery<LigaOption[]>({
    queryKey: ["liga-jugadores-ligas"],
    queryFn:  () => fetch("/api/liga-jugadores/ligas").then((r) => r.json()),
    select:   (d) => [...d].sort((a, b) =>
      (LIGA_ORDER[a.shortName] ?? 99) - (LIGA_ORDER[b.shortName] ?? 99)
    ),
  });

  // ── Teams for selected liga ──────────────────────────────────────────────────
  const teamsParams = new URLSearchParams();
  if (selectedLiga) teamsParams.set("liga", selectedLiga);

  const { data: allTeams = [], isLoading: loadingTeams } = useQuery<TeamOption[]>({
    queryKey: ["liga-jugadores-equipos", selectedLiga ?? "all"],
    queryFn:  () => fetch(`/api/liga-jugadores/equipos${selectedLiga ? `?liga=${selectedLiga}` : ""}`).then((r) => r.json()),
  });

  // Group teams by liga for sidebar
  const teamsByLiga = useMemo(() => {
    const m = new Map<string, TeamOption[]>();
    for (const t of allTeams) {
      const arr = m.get(t.leagueName) ?? [];
      arr.push(t);
      m.set(t.leagueName, arr);
    }
    return m;
  }, [allTeams]);

  // ── Players for selected team ────────────────────────────────────────────────
  const { data: players = [], isLoading: loadingPlayers } = useQuery<LigaJugador[]>({
    queryKey: ["liga-jugadores-team", selectedTeam?.id],
    queryFn:  () => fetch(`/api/liga-jugadores?teamId=${selectedTeam!.id}&limit=30`).then((r) => r.json()),
    enabled:  !!selectedTeam,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !q ? players : players.filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    );
  }, [players, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = Number(a[sortKey] ?? 0);
      const vb = Number(b[sortKey] ?? 0);
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [filtered, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function toggleLiga(liga: string) {
    setExpandedLigas((prev) => {
      const next = new Set(prev);
      if (next.has(liga)) next.delete(liga);
      else next.add(liga);
      return next;
    });
    setSelectedLiga(liga);
    setSelectedTeam(null);
  }

  function selectTeam(team: TeamOption) {
    setSelectedTeam(team);
    setSearch("");
    setSortKey("points");
    setSortDir("desc");
  }

  function TH({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="px-2 py-2 text-right cursor-pointer select-none hover:text-zinc-200 transition-colors whitespace-nowrap"
        onClick={() => handleSort(col)}
      >
        <span className="inline-flex items-center justify-end gap-0.5">
          {label}
          <SortArrow active={sortKey === col} dir={sortDir} />
        </span>
      </th>
    );
  }

  // ─── Liga display name map ───────────────────────────────────────────────────
  const ligaLabel: Record<string, string> = {
    "primera-feb": "1ª FEB",
    "segunda-feb": "2ª FEB",
    "tercera-feb": "3ª FEB",
    "liga-femenina-endesa": "LF Endesa",
    "lf-challenge": "LF Challenge",
    "lf2": "LF2",
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -mt-6 -mx-6 overflow-hidden">

      {/* ── Left panel: Liga/Equipo browser ─────────────────────────────────── */}
      <div className="w-64 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden bg-zinc-900/40">
        <div className="px-3 py-3 border-b border-zinc-800">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Base de Datos FEB
          </h2>
        </div>

        <div className="overflow-y-auto flex-1">
          {ligas.length === 0 ? (
            <div className="px-3 py-8 text-center text-zinc-600 text-xs">Cargando ligas…</div>
          ) : (
            ligas.map((liga) => {
              const teams = teamsByLiga.get(liga.shortName) ?? [];
              const isExpanded = expandedLigas.has(liga.shortName);
              const label = ligaLabel[liga.shortName] ?? liga.shortName;

              return (
                <div key={liga.shortName}>
                  {/* Liga header */}
                  <button
                    onClick={() => toggleLiga(liga.shortName)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-800/50 transition-colors ${
                      selectedLiga === liga.shortName ? "bg-zinc-800/60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${liga.gender === "F" ? "bg-pink-400" : "bg-blue-400"}`} />
                      <span className="text-xs font-semibold text-zinc-300 truncate">{label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {loadingTeams && selectedLiga === liga.shortName ? (
                        <div className="w-3 h-3 rounded-full border border-zinc-600 border-t-zinc-300 animate-spin" />
                      ) : (
                        <span className="text-[9px] text-zinc-600">{teams.length || ""}</span>
                      )}
                      {isExpanded
                        ? <ChevronDown size={11} className="text-zinc-500" />
                        : <ChevronRight size={11} className="text-zinc-500" />
                      }
                    </div>
                  </button>

                  {/* Team list */}
                  {isExpanded && (
                    <div className="bg-zinc-900/30">
                      {teams.length === 0 && loadingTeams ? (
                        <div className="px-5 py-2 space-y-1">
                          {[1,2,3].map(i => <Skeleton key={i} className="h-5 w-full" />)}
                        </div>
                      ) : teams.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => selectTeam(team)}
                          className={`w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-zinc-800/60 transition-colors ${
                            selectedTeam?.id === team.id
                              ? "bg-primary/10 border-l-2 border-primary"
                              : "border-l-2 border-transparent"
                          }`}
                        >
                          {team.logoUrl ? (
                            <img src={team.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />
                          ) : (
                            <Shield size={12} className="text-zinc-600 shrink-0" />
                          )}
                          <span className={`text-[11px] truncate flex-1 ${
                            selectedTeam?.id === team.id ? "text-zinc-100 font-medium" : "text-zinc-400"
                          }`}>
                            {team.name}
                          </span>
                          <span className="text-[9px] text-zinc-600 shrink-0">{team.playerCount}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel: Players ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedTeam ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600">
            <Users size={36} className="opacity-30" />
            <p className="text-sm">Selecciona un equipo para ver sus jugadores</p>
          </div>
        ) : (
          <>
            {/* Team header */}
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {selectedTeam.logoUrl ? (
                  <img src={selectedTeam.logoUrl} alt="" className="w-8 h-8 object-contain shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                    <Shield size={16} className="text-zinc-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-100 truncate">{selectedTeam.name}</h2>
                  <p className="text-[10px] text-zinc-500">
                    {ligaLabel[selectedTeam.leagueName] ?? selectedTeam.leagueName}
                    {" · "}
                    {loadingPlayers ? "…" : `${sorted.length} jugadores`}
                  </p>
                </div>
              </div>
              <div className="relative w-52 shrink-0">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <Input
                  placeholder="Filtrar jugador…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-7 text-xs bg-zinc-800/60 border-zinc-700"
                />
              </div>
            </div>

            {/* Stats table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-zinc-900">
                  <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-2 text-left w-8">#</th>
                    <th className="px-3 py-2 text-left">Jugador</th>
                    <th className="px-2 py-2 text-center">Pos</th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer hover:text-zinc-200"
                      onClick={() => handleSort("gamesPlayed")}
                    >
                      <span className="inline-flex items-center justify-end gap-0.5">
                        PJ <SortArrow active={sortKey === "gamesPlayed"} dir={sortDir} />
                      </span>
                    </th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer hover:text-zinc-200"
                      onClick={() => handleSort("minutesAvg")}
                    >
                      <span className="inline-flex items-center justify-end gap-0.5">
                        Min <SortArrow active={sortKey === "minutesAvg"} dir={sortDir} />
                      </span>
                    </th>
                    <TH col="points"   label="Pts" />
                    <TH col="rebounds" label="Reb" />
                    <TH col="assists"  label="Ast" />
                    <TH col="steals"   label="Ro" />
                    <TH col="blocks"   label="Tap" />
                    <th className="px-2 py-2 text-right text-zinc-500 whitespace-nowrap">T2%</th>
                    <th className="px-2 py-2 text-right text-zinc-500 whitespace-nowrap">T3%</th>
                    <th className="px-2 py-2 text-right text-zinc-500 whitespace-nowrap">TL%</th>
                    <TH col="pir" label="PIR" />
                  </tr>
                </thead>
                <tbody>
                  {loadingPlayers
                    ? Array.from({ length: 12 }).map((_, i) => (
                        <tr key={i} className="border-b border-zinc-800/40">
                          <td className="px-4 py-2" colSpan={14}>
                            <Skeleton className="h-6 w-full" />
                          </td>
                        </tr>
                      ))
                    : sorted.map((p, i) => {
                        const name = `${p.firstName} ${p.lastName}`;
                        const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`;
                        const posColor = p.position ? (POSITION_COLORS[p.position] ?? "bg-zinc-700/50 text-zinc-300") : "";
                        return (
                          <tr
                            key={p.id}
                            className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="px-4 py-2 text-zinc-600 tabular-nums">{i + 1}</td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="w-8 h-8 shrink-0">
                                  <AvatarImage src={p.photoUrl ?? undefined} />
                                  <AvatarFallback className="text-[9px] bg-zinc-800">{initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-zinc-100 leading-tight">{name}</div>
                                  {p.nationality && (
                                    <div className="text-[9px] text-zinc-500">{p.nationality}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {p.position ? (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor}`}>
                                  {p.position}
                                </span>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{p.gamesPlayed}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{fmt(p.minutesAvg)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-bold text-zinc-100 text-sm">{fmt(p.points)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.rebounds)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.assists)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.steals)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.blocks)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{pct(p.fg2Made, p.fg2Att)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{pct(p.fg3Made, p.fg3Att)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">{pct(p.ftMade, p.ftAtt)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {p.pir != null ? (
                                <span className={`font-semibold ${Number(p.pir) >= 15 ? "text-emerald-400" : Number(p.pir) >= 5 ? "text-zinc-200" : "text-zinc-500"}`}>
                                  {fmt(p.pir, 0)}
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
              {!loadingPlayers && sorted.length === 0 && (
                <div className="py-16 text-center text-zinc-500 text-sm">
                  Sin jugadores para este equipo.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
