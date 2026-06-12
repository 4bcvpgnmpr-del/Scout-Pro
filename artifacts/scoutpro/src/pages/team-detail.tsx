import { useRoute, Link, useLocation } from "wouter";
import { useGetTeam, useListPlayers, useDeleteTeam, getListTeamsQueryKey, getGetTeamQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Trash2, Users, ArrowRight, Download, Loader2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExportPdf } from "@/hooks/use-export-pdf";

export default function TeamDetail() {
  const [, params] = useRoute("/teams/:id");
  const teamId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { contentRef, exportPdf, exporting } = useExportPdf(`equipo-${teamId}`);
  const { data: team, isLoading } = useGetTeam(teamId, { query: { enabled: !!teamId, queryKey: getGetTeamQueryKey(teamId) } });
  const { data: players } = useListPlayers({ teamId }, { query: { enabled: !!teamId, queryKey: getListPlayersQueryKey({ teamId }) } });
  const deleteTeam = useDeleteTeam();

  const handleDelete = () => {
    if (!confirm(`¿Eliminar ${team?.name}? Esta acción no se puede deshacer.`)) return;
    deleteTeam.mutate({ id: teamId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        toast({ title: "Equipo eliminado" });
        setLocation("/equipos");
      },
    });
  };

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!team) return <div className="text-muted-foreground py-12 text-center">Equipo no encontrado.</div>;

  return (
    <div ref={contentRef} className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/equipos"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-4xl uppercase italic">{team.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-muted-foreground">
              {team.league && <span>{team.league}</span>}
              {team.city && <span>{team.city}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/teams/${teamId}/edit`}>
            <Button variant="outline" className="font-display tracking-wide uppercase"><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
          </Link>
          <Button variant="outline" size="icon" onClick={exportPdf} disabled={exporting} title="Exportar PDF">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={handleDelete} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Plantilla</CardTitle>
          <Link href="/players/new">
            <Button size="sm" className="font-display tracking-wide uppercase text-xs">Añadir jugador</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {!players || players.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hay jugadores en este equipo todavía.
            </div>
          ) : (
            <div className="space-y-2">
              {players.map(player => (
                <Link key={player.id} href={`/players/${player.id}`}>
                  <div className="flex items-center gap-4 p-3 rounded-lg border hover:border-primary bg-card cursor-pointer group transition-colors">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-display">
                        {player.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-semibold group-hover:text-primary transition-colors">{player.name}</div>
                      <div className="text-xs text-muted-foreground">{player.position}{player.jerseyNumber != null ? ` · #${player.jerseyNumber}` : ""}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
