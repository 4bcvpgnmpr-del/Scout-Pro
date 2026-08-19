import { useRoute, useLocation, Link } from "wouter";
import { useGetGame, useUpdateGame, getGetGameQueryKey, getListGamesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GameForm, type GameFormValues } from "@/components/forms/game-form";

export default function GameEdit() {
  const [, params] = useRoute("/games/:id/edit");
  const gameId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: game, isLoading } = useGetGame(gameId, { query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) } });
  const updateGame = useUpdateGame();

  const onSubmit = (data: GameFormValues) => {
    updateGame.mutate({
      id: gameId,
      data: {
        date: data.date,
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        homeScore: data.homeScore ? parseInt(data.homeScore) : null,
        awayScore: data.awayScore ? parseInt(data.awayScore) : null,
        location: data.location || undefined,
        notes: data.notes || undefined,
        difficulty: data.difficulty || undefined,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(gameId) });
        queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
        toast({ title: "Partido actualizado" });
        setLocation("/games");
      },
      onError: () => toast({ title: "Error", description: "No se pudo actualizar el partido.", variant: "destructive" }),
    });
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/games"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">Editar Partido</h1>
          <p className="text-muted-foreground">Actualiza los datos del partido.</p>
        </div>
      </div>
      {isLoading || !game ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <GameForm
          defaultValues={{
            date: game.date,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore != null ? String(game.homeScore) : "",
            awayScore: game.awayScore != null ? String(game.awayScore) : "",
            location: game.location || "",
            notes: game.notes || "",
            difficulty: game.difficulty || "",
          }}
          onSubmit={onSubmit}
          submitting={updateGame.isPending}
          submitLabel="Guardar Cambios"
          cancelTo="/games"
        />
      )}
    </div>
  );
}
