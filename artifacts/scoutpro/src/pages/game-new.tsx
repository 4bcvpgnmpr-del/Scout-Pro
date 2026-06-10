import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useCreateGame, getListGamesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type FormData = { date: string; homeTeam: string; awayTeam: string; homeScore?: string; awayScore?: string; location?: string; notes?: string };

export default function GameNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { register, handleSubmit } = useForm<FormData>();
  const createGame = useCreateGame();

  const onSubmit = (data: FormData) => {
    createGame.mutate({
      data: {
        date: data.date,
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        homeScore: data.homeScore ? parseInt(data.homeScore) : null,
        awayScore: data.awayScore ? parseInt(data.awayScore) : null,
        location: data.location,
        notes: data.notes,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
        toast({ title: "Game logged" });
        setLocation("/games");
      },
      onError: () => toast({ title: "Error", description: "Failed to log game.", variant: "destructive" }),
    });
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/games"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">Log Game</h1>
          <p className="text-muted-foreground">Record a game for scouting reference.</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Game Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input {...register("date", { required: true })} type="date" className="bg-card" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Home Team *</Label>
                <Input {...register("homeTeam", { required: true })} placeholder="Home team" className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Away Team *</Label>
                <Input {...register("awayTeam", { required: true })} placeholder="Away team" className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Home Score</Label>
                <Input {...register("homeScore")} type="number" placeholder="0" className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Away Score</Label>
                <Input {...register("awayScore")} type="number" placeholder="0" className="bg-card" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input {...register("location")} placeholder="e.g. Crypto.com Arena" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register("notes")} placeholder="Conditions, context..." className="bg-card h-20" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createGame.isPending} className="font-display tracking-wide uppercase">
                {createGame.isPending ? "Saving..." : "Log Game"}
              </Button>
              <Link href="/games"><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
