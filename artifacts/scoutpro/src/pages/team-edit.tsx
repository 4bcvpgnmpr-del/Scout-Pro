import { useRoute, useLocation, Link } from "wouter";
import { useGetTeam, useUpdateTeam, getGetTeamQueryKey, getListTeamsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TeamForm, type TeamFormValues } from "@/components/forms/team-form";

export default function TeamEdit() {
  const [, params] = useRoute("/teams/:id/edit");
  const teamId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: team, isLoading } = useGetTeam(teamId, { query: { enabled: !!teamId, queryKey: getGetTeamQueryKey(teamId) } });
  const updateTeam = useUpdateTeam();

  const onSubmit = (data: TeamFormValues) => {
    updateTeam.mutate({
      id: teamId,
      data: { name: data.name, league: data.league || undefined, city: data.city || undefined },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) });
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        toast({ title: "Equipo actualizado" });
        setLocation(`/teams/${teamId}`);
      },
      onError: () => toast({ title: "Error", description: "No se pudo actualizar el equipo.", variant: "destructive" }),
    });
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/teams/${teamId}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">Editar Equipo</h1>
          <p className="text-muted-foreground">Actualiza la información del equipo.</p>
        </div>
      </div>
      {isLoading || !team ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <TeamForm
          defaultValues={{
            name: team.name,
            league: team.league || "",
            city: team.city || "",
          }}
          onSubmit={onSubmit}
          submitting={updateTeam.isPending}
          submitLabel="Guardar Cambios"
          cancelTo={`/teams/${teamId}`}
        />
      )}
    </div>
  );
}
