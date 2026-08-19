import { useLocation, Link } from "wouter";
import { useCreateGame, getListGamesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GameForm, type GameFormValues } from "@/components/forms/game-form";

export default function GameNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createGame = useCreateGame();

  const onSubmit = (data: GameFormValues) => {
    createGame.mutate({
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
        queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
        toast({ title: "Partido registrado" });
        setLocation("/games");
      },
      onError: () => toast({ title: "Error", description: "No se pudo registrar el partido.", variant: "destructive" }),
    });
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/games"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">Registrar Partido</h1>
          <p className="text-muted-foreground">Registra un partido como referencia de scouting.</p>
        </div>
      </div>
      <GameForm onSubmit={onSubmit} submitting={createGame.isPending} submitLabel="Registrar Partido" cancelTo="/games" />
    </div>
  );
}
