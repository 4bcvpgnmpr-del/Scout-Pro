import { useRoute, useLocation, Link } from "wouter";
import { useGetPlayer, useUpdatePlayer, getGetPlayerQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlayerForm, type PlayerFormValues } from "@/components/forms/player-form";

export default function PlayerEdit() {
  const [, params] = useRoute("/players/:id/edit");
  const playerId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: player, isLoading } = useGetPlayer(playerId, { query: { enabled: !!playerId, queryKey: getGetPlayerQueryKey(playerId) } });
  const updatePlayer = useUpdatePlayer();

  const onSubmit = (data: PlayerFormValues) => {
    updatePlayer.mutate({
      id: playerId,
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
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(playerId) });
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        toast({ title: "Jugador actualizado" });
        setLocation(`/players/${playerId}`);
      },
      onError: () => toast({ title: "Error", description: "No se pudo actualizar el jugador.", variant: "destructive" }),
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/players/${playerId}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">Editar Jugador</h1>
          <p className="text-muted-foreground">Actualiza la información del jugador.</p>
        </div>
      </div>
      {isLoading || !player ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <PlayerForm
          defaultValues={{
            name: player.name,
            position: player.position,
            teamId: player.teamId != null ? String(player.teamId) : "",
            jerseyNumber: player.jerseyNumber != null ? String(player.jerseyNumber) : "",
            age: player.age != null ? String(player.age) : "",
            height: player.height || "",
            weight: player.weight != null ? String(player.weight) : "",
            nationality: player.nationality || "",
            handedness: player.handedness || "",
            notes: player.notes || "",
          }}
          onSubmit={onSubmit}
          submitting={updatePlayer.isPending}
          submitLabel="Guardar Cambios"
          cancelTo={`/players/${playerId}`}
        />
      )}
    </div>
  );
}
