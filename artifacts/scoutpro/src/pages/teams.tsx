import { useListTeams, useListPlayers, getListTeamsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, Shield, ArrowRight, Users } from "lucide-react";

export default function Teams() {
  const { data: teams, isLoading } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });
  const { data: players } = useListPlayers();

  const playerCountByTeam = (teamId: number) =>
    players?.filter((p) => p.teamId === teamId).length ?? 0;

  const ownTeams = teams?.filter((t) => t.teamType === "own") ?? [];
  const rivalTeams = teams?.filter((t) => t.teamType !== "own") ?? [];

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl">Equipos</h1>
          <p className="text-muted-foreground">Equipos y plantillas bajo seguimiento.</p>
        </div>
        <Link href="/teams/new">
          <Button className="font-display tracking-wide uppercase">
            <Plus className="mr-2 h-4 w-4" /> Añadir Equipo
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !teams || teams.length === 0 ? (
        <Card className="border-dashed bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted p-3 rounded-full mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No hay equipos todavía</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Añade equipos para organizar tu base de jugadores.
            </p>
            <Link href="/teams/new">
              <Button variant="outline" size="sm" className="mt-4">Añadir equipo</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {ownTeams.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Mi Equipo
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownTeams.map((team) => (
                  <TeamCard key={team.id} team={team} playerCount={playerCountByTeam(team.id)} />
                ))}
              </div>
            </div>
          )}
          {rivalTeams.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Equipos Rivales
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rivalTeams.map((team) => (
                  <TeamCard key={team.id} team={team} playerCount={playerCountByTeam(team.id)} />
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
}: {
  team: { id: number; name: string; league?: string | null; city?: string | null; teamType?: string | null };
  playerCount: number;
}) {
  return (
    <Link href={`/teams/${team.id}`}>
      <Card className="hover:border-primary transition-all duration-200 cursor-pointer group hover-elevate">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="font-semibold truncate group-hover:text-primary transition-colors">
              {team.name}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {[team.league, team.city].filter(Boolean).join(" · ") || "Sin datos de liga"}
            </div>
            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{playerCount} jugadores</span>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
        </CardContent>
      </Card>
    </Link>
  );
}
