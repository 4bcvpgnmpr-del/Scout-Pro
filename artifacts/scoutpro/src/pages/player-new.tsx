import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useCreatePlayer, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListTeams } from "@workspace/api-client-react";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

type FormData = {
  name: string;
  position: string;
  teamId?: string;
  jerseyNumber?: string;
  age?: string;
  height?: string;
  weight?: string;
  nationality?: string;
  notes?: string;
};

export default function PlayerNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { register, handleSubmit, setValue, watch } = useForm<FormData>();
  const createPlayer = useCreatePlayer();
  const { data: teams } = useListTeams();

  const onSubmit = (data: FormData) => {
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
        notes: data.notes || undefined,
      },
    }, {
      onSuccess: (player) => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        toast({ title: "Player added", description: `${player.name} has been added to the database.` });
        setLocation(`/players/${player.id}`);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create player.", variant: "destructive" });
      },
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/players">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-4xl">New Player</h1>
          <p className="text-muted-foreground">Add a prospect to the database.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Player Information</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name *</Label>
                <Input {...register("name", { required: true })} placeholder="e.g. Marcus Johnson" className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Position *</Label>
                <Select onValueChange={(v) => setValue("position", v)}>
                  <SelectTrigger className="bg-card"><SelectValue placeholder="Select position" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PG">PG — Point Guard</SelectItem>
                    <SelectItem value="SG">SG — Shooting Guard</SelectItem>
                    <SelectItem value="SF">SF — Small Forward</SelectItem>
                    <SelectItem value="PF">PF — Power Forward</SelectItem>
                    <SelectItem value="C">C — Center</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Team</Label>
                <Select onValueChange={(v) => setValue("teamId", v)}>
                  <SelectTrigger className="bg-card"><SelectValue placeholder="Free agent" /></SelectTrigger>
                  <SelectContent>
                    {teams?.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Jersey Number</Label>
                <Input {...register("jerseyNumber")} type="number" placeholder="0" className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Age</Label>
                <Input {...register("age")} type="number" placeholder="22" className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Height</Label>
                <Input {...register("height")} placeholder={`6'4"`} className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Weight (lbs)</Label>
                <Input {...register("weight")} type="number" placeholder="220" className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Nationality</Label>
                <Input {...register("nationality")} placeholder="e.g. USA" className="bg-card" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Scout Notes</Label>
                <Textarea {...register("notes")} placeholder="General observations, background..." className="bg-card h-24" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createPlayer.isPending} className="font-display tracking-wide uppercase">
                {createPlayer.isPending ? "Saving..." : "Add Player"}
              </Button>
              <Link href="/players"><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
