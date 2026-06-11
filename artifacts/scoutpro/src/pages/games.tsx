import { useListGames, useDeleteGame, getListGamesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, Trophy, Trash2, Pencil, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DIFFICULTY_BADGE, DIFFICULTY_LABEL } from "@/lib/difficulty";

export default function Games() {
  const { data: games, isLoading } = useListGames({ query: { queryKey: getListGamesQueryKey() } });
  const deleteGame = useDeleteGame();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`¿Eliminar partido: ${name}?`)) return;
    deleteGame.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
        toast({ title: "Partido eliminado" });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl">Partidos</h1>
          <p className="text-muted-foreground">Registros de partidos como contexto de scouting.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/calendar">
            <Button variant="outline" className="font-display tracking-wide uppercase"><CalendarIcon className="mr-2 h-4 w-4" /> Calendario</Button>
          </Link>
          <Link href="/games/new">
            <Button className="font-display tracking-wide uppercase"><Plus className="mr-2 h-4 w-4" /> Registrar Partido</Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !games || games.length === 0 ? (
        <Card className="border-dashed bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted p-3 rounded-full mb-4"><Trophy className="h-6 w-6 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold">No hay partidos registrados</h3>
            <p className="text-sm text-muted-foreground mt-1">Registra partidos para vincular informes de scouting a enfrentamientos concretos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {games.map(game => (
            <Card key={game.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{game.homeTeam}</span>
                    <span className="text-muted-foreground text-sm">vs</span>
                    <span className="font-semibold">{game.awayTeam}</span>
                    {game.homeScore != null && game.awayScore != null && (
                      <span className="font-display text-primary">{game.homeScore}–{game.awayScore}</span>
                    )}
                    {game.difficulty && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_BADGE[game.difficulty] ?? "bg-muted text-muted-foreground"}`}>
                        {DIFFICULTY_LABEL[game.difficulty] ?? game.difficulty}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {game.date}{game.location ? ` · ${game.location}` : ""}
                  </div>
                </div>
                <Link href={`/games/${game.id}/edit`}>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost" size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(game.id, `${game.homeTeam} vs ${game.awayTeam}`)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
