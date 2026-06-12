import { useLocation, Link } from "wouter";
import { useCreateTeam, getListTeamsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TeamForm, type TeamFormValues } from "@/components/forms/team-form";

export default function TeamNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createTeam = useCreateTeam();

  const onSubmit = (data: TeamFormValues) => {
    createTeam.mutate({
      data: {
        name: data.name,
        league: data.league || undefined,
        city: data.city || undefined,
        logoUrl: data.logoUrl || undefined,
        teamType: (data.teamType as "own" | "rival") || undefined,
      },
    }, {
      onSuccess: (team) => {
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        toast({ title: "Equipo añadido", description: `${team.name} se ha añadido.` });
        setLocation(`/teams/${team.id}`);
      },
      onError: () => toast({ title: "Error", description: "No se pudo crear el equipo.", variant: "destructive" }),
    });
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/equipos"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">Nuevo Equipo</h1>
          <p className="text-muted-foreground">Añade un equipo a tu base de datos de scouting.</p>
        </div>
      </div>
      <TeamForm onSubmit={onSubmit} submitting={createTeam.isPending} submitLabel="Añadir Equipo" cancelTo="/equipos" />
    </div>
  );
}
