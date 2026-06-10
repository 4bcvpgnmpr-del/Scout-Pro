import { useListGames, useDeleteGame, getListGamesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, Trophy, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Games() {
  const { data: games, isLoading } = useListGames({ query: { queryKey: getListGamesQueryKey() } });
  const deleteGame = useDeleteGame();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete game: ${name}?`)) return;
    deleteGame.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
        toast({ title: "Game deleted" });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl">Games</h1>
          <p className="text-muted-foreground">Game records for scouting context.</p>
        </div>
        <Link href="/games/new">
          <Button className="font-display tracking-wide uppercase"><Plus className="mr-2 h-4 w-4" /> Log Game</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !games || games.length === 0 ? (
        <Card className="border-dashed bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted p-3 rounded-full mb-4"><Trophy className="h-6 w-6 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold">No games logged</h3>
            <p className="text-sm text-muted-foreground mt-1">Log games to tie scouting reports to specific matchups.</p>
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
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {game.date}{game.location ? ` · ${game.location}` : ""}
                  </div>
                </div>
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
