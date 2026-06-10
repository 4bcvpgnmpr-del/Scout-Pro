import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useCreateTeam, getListTeamsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type FormData = { name: string; league?: string; city?: string };

export default function TeamNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { register, handleSubmit } = useForm<FormData>();
  const createTeam = useCreateTeam();

  const onSubmit = (data: FormData) => {
    createTeam.mutate({ data: { name: data.name, league: data.league, city: data.city } }, {
      onSuccess: (team) => {
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        toast({ title: "Team added", description: `${team.name} has been added.` });
        setLocation(`/teams/${team.id}`);
      },
      onError: () => toast({ title: "Error", description: "Failed to create team.", variant: "destructive" }),
    });
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/teams"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">New Team</h1>
          <p className="text-muted-foreground">Add a team to your scouting database.</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Team Information</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Team Name *</Label>
              <Input {...register("name", { required: true })} placeholder="e.g. Los Angeles Lakers" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>League</Label>
              <Input {...register("league")} placeholder="e.g. NBA, EuroLeague" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>City / Region</Label>
              <Input {...register("city")} placeholder="e.g. Los Angeles, CA" className="bg-card" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createTeam.isPending} className="font-display tracking-wide uppercase">
                {createTeam.isPending ? "Saving..." : "Add Team"}
              </Button>
              <Link href="/teams"><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
