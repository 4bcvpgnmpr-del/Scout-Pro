import { useLocation, Link } from "wouter";
import { useCreatePlayer, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlayerForm, type PlayerFormValues } from "@/components/forms/player-form";

export default function PlayerNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createPlayer = useCreatePlayer();

  const onSubmit = (data: PlayerFormValues) => {
    createPlayer.mutate({
      data: {
        name: data.name,
        position: data.position,
        teamId: data.teamId ? parseInt(data.teamId) : null,
        jerseyNumber: data.jerseyNumber ? parseInt(data.jerseyNumber) : null,
        age: data.age ? parseInt(data.age) : null,
        height: data.height || undefined,
        weight: data.weight ? parseInt(data.weight) : null,
        nationality: data.nationality || undefined,
        handedness: data.handedness || undefined,
        notes: data.notes || undefined,
        photoUrl: data.photoUrl || undefined,
      },
    }, {
      onSuccess: (player) => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        toast({ title: "Jugador añadido", description: `${player.name} se ha añadido a la base de datos.` });
        setLocation(`/players/${player.id}`);
      },
      onError: () => toast({ title: "Error", description: "No se pudo crear el jugador.", variant: "destructive" }),
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/jugadores"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">Nuevo Jugador</h1>
          <p className="text-muted-foreground">Añade un prospecto a la base de datos.</p>
        </div>
      </div>
      <PlayerForm onSubmit={onSubmit} submitting={createPlayer.isPending} submitLabel="Añadir Jugador" cancelTo="/jugadores" />
    </div>
  );
}
