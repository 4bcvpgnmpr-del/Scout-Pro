import { useMemo } from "react";
import { useListTeams, useListPlayers, getListTeamsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, Shield, Users, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function Teams() {
  const { data: teams, isLoading } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });
  const { data: players } = useListPlayers();
  const { activeWorkspace } = useWorkspace();

  const playerCountByTeam = (teamId: number) =>
    (players ?? []).filter((p) => p.teamId === teamId).length;

  // Filter by workspace team name — same pattern as players/games/reports pages
  const visibleTeams = useMemo(() => {
    if (!activeWorkspace) return teams ?? [];
    const wsLower = activeWorkspace.teamName.toLowerCase();
    return (teams ?? []).filter((t) => t.name.toLowerCase() === wsLower);
  }, [activeWorkspace, teams]);

  const ownTeams   = visibleTeams.filter((t) => t.teamType === "own");
  const rivalTeams = visibleTeams.filter((t) => t.teamType !== "own");

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tight">Equipos</h1>
          {activeWorkspace ? (
            <p className="text-muted-foreground text-sm mt-1">
              Liga: <span className="font-semibold text-foreground">{activeWorkspace.leagueName}</span>
              <span className="mx-1.5 text-muted-foreground/40">·</span>
              <span className="text-muted-foreground/60">{activeWorkspace.teamName}</span>
            </p>
          ) : (
            <p className="text-muted-foreground text-sm mt-1">Equipos y plantillas bajo seguimiento.</p>
          )}
        </div>
        <Link href="/teams/new">
          <Button className="font-black tracking-wide uppercase text-xs px-5">
            <Plus className="mr-2 h-4 w-4" /> Añadir Equipo
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : !teams || teams.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-black text-gray-700">No hay equipos todavía</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Añade equipos para organizar tu base de jugadores.
          </p>
          <Link href="/teams/new">
            <Button variant="outline" size="sm">Añadir equipo</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {ownTeams.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-primary/20" />
                <span className="text-[10px] font-black text-primary uppercase tracking-widest px-2">Mi Equipo</span>
                <div className="h-px flex-1 bg-primary/20" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownTeams.map((team) => (
                  <TeamCard key={team.id} team={team} playerCount={playerCountByTeam(team.id)} isOwn />
                ))}
              </div>
            </div>
          )}
          {rivalTeams.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Equipos Rivales</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rivalTeams.map((team) => (
                  <TeamCard key={team.id} team={team} playerCount={playerCountByTeam(team.id)} isOwn={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamCard({
  team,
  playerCount,
  isOwn,
}: {
  team: { id: number; name: string; league?: string | null; city?: string | null; teamType?: string | null; logoUrl?: string | null };
  playerCount: number;
  isOwn: boolean;
}) {
  const initials = team.name.slice(0, 2).toUpperCase();

  return (
    <Link href={`/teams/${team.id}`}>
      <div className={`group relative overflow-hidden bg-white rounded-2xl border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
        isOwn
          ? "border-primary/30 hover:border-primary/60 hover:shadow-primary/10"
          : "border-gray-200 hover:border-gray-300"
      }`}>
        {/* Accent bar */}
        {isOwn && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-2xl" />
        )}

        <div className="p-5 flex items-center gap-4 pl-6">
          {/* Logo */}
          <div className={`h-14 w-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border-2 ${
            isOwn ? "border-primary/20 bg-primary/5" : "border-gray-100 bg-gray-50"
          }`}>
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
            ) : (
              <span className={`text-xl font-black ${isOwn ? "text-primary" : "text-gray-400"}`}>
                {initials}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {isOwn && (
              <div className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5">Mi Equipo</div>
            )}
            <div className={`font-black text-base uppercase leading-tight truncate transition-colors text-gray-800 group-hover:text-primary`}>
              {team.name}
            </div>
            {(team.league || team.city) && (
              <div className="text-xs text-gray-400 mt-0.5 truncate">
                {[team.league, team.city].filter(Boolean).join(" · ")}
              </div>
            )}
            <div className="flex items-center gap-1 mt-1.5">
              <Users className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-400">{playerCount} jugadores</span>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors shrink-0" />
        </div>
      </div>
    </Link>
  );
}
