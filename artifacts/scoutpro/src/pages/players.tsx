import { useState, useEffect } from "react";
import { useListPlayers, getListPlayersQueryKey, useListTeams } from "@workspace/api-client-react";
import { useSeason } from "@/contexts/SeasonContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Search, Plus, ChevronRight, Users, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const POSITIONS = [
  { value: "ALL", label: "Todas" },
  { value: "PG", label: "PG" },
  { value: "SG", label: "SG" },
  { value: "SF", label: "SF" },
  { value: "PF", label: "PF" },
  { value: "C", label: "C" },
];

export default function Players() {
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState<number | "ALL">("ALL");
  const { selectedSeason, isLoading: seasonLoading } = useSeason();
  const { activeWorkspace } = useWorkspace();

  const { data: teams = [] } = useListTeams();

  // Sync team filter with active workspace — find team by name, use its numeric id
  useEffect(() => {
    if (!activeWorkspace) {
      setTeamFilter("ALL");
      return;
    }
    const wsTeamNameLower = activeWorkspace.teamName.toLowerCase();
    const match = teams.find((t) => t.name.toLowerCase() === wsTeamNameLower);
    if (match) setTeamFilter(match.id);
  }, [activeWorkspace?.id, teams]);

  // Always send seasonYear — never fetch without it to avoid cross-season duplicates
  const params = {
    ...(positionFilter !== "ALL" ? { position: positionFilter } : {}),
    ...(teamFilter !== "ALL" ? { teamId: teamFilter } : {}),
    ...(selectedSeason?.startYear ? { seasonYear: selectedSeason.startYear } : {}),
  };

  const { data: players, isLoading: playersLoading } = useListPlayers(
    params,
    {
      query: {
        queryKey: [...getListPlayersQueryKey(params), selectedSeason?.id ?? "none"],
        // Block the query until season is known — prevents unfiltered multi-season fetch
        enabled: !seasonLoading && !!selectedSeason,
      },
    },
  );

  const isLoading = seasonLoading || playersLoading;

  // Deduplicate by statPlayerExternalId as a safety net (same player, multiple seasons)
  const seen = new Set<string>();
  const deduped = (players ?? []).filter((p) => {
    const key = p.statPlayerExternalId ?? String(p.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const filteredPlayers = deduped.filter(
    (p) =>
      (!search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.teamName?.toLowerCase().includes(search.toLowerCase())),
  );

  // Sort teams alphabetically for the dropdown
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tight">Jugadores</h1>
          <p className="text-muted-foreground text-sm mt-1">Base de datos de prospectos scouting.</p>
        </div>
        <Link href="/players/new">
          <Button className="font-black tracking-wide uppercase text-xs px-5">
            <Plus className="mr-2 h-4 w-4" /> Añadir Jugador
          </Button>
        </Link>
      </div>

      {/* Filter bar — white card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 flex flex-col gap-3">
        {/* Row 1: search + team select */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre..."
              className="pl-9 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus-visible:ring-primary/30 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Team select */}
          <div className="relative sm:w-56">
            <select
              value={teamFilter === "ALL" ? "ALL" : String(teamFilter)}
              onChange={(e) =>
                setTeamFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
              }
              className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 pr-8 text-xs font-semibold text-gray-700 h-9 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="ALL">Todos los equipos</option>
              {sortedTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          </div>
        </div>

        {/* Row 2: position pills */}
        <div className="flex gap-1 flex-wrap">
          {POSITIONS.map((pos) => (
            <button
              key={pos.value}
              onClick={() => setPositionFilter(pos.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                positionFilter === pos.value
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              }`}
            >
              {pos.label}
            </button>
          ))}
          {/* Active filters summary */}
          {(teamFilter !== "ALL" || positionFilter !== "ALL") && (
            <button
              onClick={() => { setTeamFilter("ALL"); setPositionFilter("ALL"); }}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 transition-all"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      {!isLoading && (
        <p className="text-xs text-gray-400 -mt-3 px-1">
          {filteredPlayers.length} jugador{filteredPlayers.length !== 1 ? "es" : ""} encontrado{filteredPlayers.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Player grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Users className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="text-base font-bold text-gray-700">No se encontraron jugadores</h3>
          <p className="text-sm text-gray-400 max-w-sm mt-1">Prueba con otros filtros de búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredPlayers.map((player) => (
            <Link key={player.id} href={`/players/${player.id}`}>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group p-4 flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-gray-100 shadow-sm shrink-0">
                  <AvatarImage src={player.photoUrl || undefined} alt={player.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">
                    {player.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 truncate group-hover:text-primary transition-colors text-sm">
                    {player.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {player.position}
                    </span>
                    {player.teamLogoUrl ? (
                      <img
                        src={player.teamLogoUrl}
                        alt={player.teamName ?? ""}
                        className="h-4 w-4 object-contain shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : null}
                    <span className="text-[11px] text-gray-400 truncate">{player.teamName || "Agente libre"}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
