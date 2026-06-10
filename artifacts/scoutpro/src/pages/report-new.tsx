import { useForm } from "react-hook-form";
import { useLocation, useSearch } from "wouter";
import { useCreateReport, useListPlayers, useListGames, getListReportsQueryKey, getGetPlayerStatsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type FormData = {
  scoutName: string; date: string; rating: string;
  offensiveRating?: string; defensiveRating?: string; athleticismRating?: string; iQRating?: string;
  points?: string; rebounds?: string; assists?: string; steals?: string; blocks?: string; turnovers?: string; minutesPlayed?: string;
  fieldGoalsMade?: string; fieldGoalsAttempted?: string; threesMade?: string; threesAttempted?: string; freeThrowsMade?: string; freeThrowsAttempted?: string;
  strengths?: string; weaknesses?: string; summary?: string; recommendation?: string;
};

export default function ReportNew() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const defaultPlayerId = params.get("playerId");

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { register, handleSubmit, setValue } = useForm<FormData>({
    defaultValues: { date: new Date().toISOString().split("T")[0] }
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(defaultPlayerId || "");
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  const createReport = useCreateReport();
  const { data: players } = useListPlayers();
  const { data: games } = useListGames();

  const today = new Date().toISOString().split("T")[0];

  const onSubmit = (data: FormData) => {
    if (!selectedPlayerId) { toast({ title: "Select a player", variant: "destructive" }); return; }
    const n = (v?: string) => v ? parseInt(v) : null;
    createReport.mutate({
      data: {
        playerId: parseInt(selectedPlayerId),
        gameId: selectedGameId ? parseInt(selectedGameId) : null,
        scoutName: data.scoutName,
        date: data.date || today,
        rating: parseInt(data.rating),
        offensiveRating: n(data.offensiveRating),
        defensiveRating: n(data.defensiveRating),
        athleticismRating: n(data.athleticismRating),
        iQRating: n(data.iQRating),
        points: n(data.points),
        rebounds: n(data.rebounds),
        assists: n(data.assists),
        steals: n(data.steals),
        blocks: n(data.blocks),
        turnovers: n(data.turnovers),
        minutesPlayed: n(data.minutesPlayed),
        fieldGoalsMade: n(data.fieldGoalsMade),
        fieldGoalsAttempted: n(data.fieldGoalsAttempted),
        threesMade: n(data.threesMade),
        threesAttempted: n(data.threesAttempted),
        freeThrowsMade: n(data.freeThrowsMade),
        freeThrowsAttempted: n(data.freeThrowsAttempted),
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        summary: data.summary,
        recommendation: data.recommendation,
      },
    }, {
      onSuccess: (report) => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(parseInt(selectedPlayerId)) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Report filed" });
        setLocation(`/reports/${report.id}`);
      },
      onError: () => toast({ title: "Error", description: "Failed to file report.", variant: "destructive" }),
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">New Report</h1>
          <p className="text-muted-foreground">File a scouting report on a prospect.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>General Info</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Player *</Label>
              <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                <SelectTrigger className="bg-card"><SelectValue placeholder="Select player" /></SelectTrigger>
                <SelectContent>
                  {players?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.position})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Scout Name *</Label>
              <Input {...register("scoutName", { required: true })} placeholder="Your name" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input {...register("date")} type="date" defaultValue={today} className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Overall Rating (1–10) *</Label>
              <Input {...register("rating", { required: true })} type="number" min="1" max="10" placeholder="7" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Game (optional)</Label>
              <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                <SelectTrigger className="bg-card"><SelectValue placeholder="Select game" /></SelectTrigger>
                <SelectContent>
                  {games?.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.date} · {g.homeTeam} vs {g.awayTeam}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Component Ratings (1–10)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {[["offensiveRating", "Offense"], ["defensiveRating", "Defense"], ["athleticismRating", "Athleticism"], ["iQRating", "Basketball IQ"]].map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <Label>{label}</Label>
                <Input {...register(field as keyof FormData)} type="number" min="1" max="10" placeholder="—" className="bg-card" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Game Stats</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            {[["points","PTS"],["rebounds","REB"],["assists","AST"],["steals","STL"],["blocks","BLK"],["turnovers","TO"],["minutesPlayed","MIN"],["fieldGoalsMade","FGM"],["fieldGoalsAttempted","FGA"],["threesMade","3PM"],["threesAttempted","3PA"],["freeThrowsMade","FTM"],["freeThrowsAttempted","FTA"]].map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Input {...register(field as keyof FormData)} type="number" min="0" placeholder="0" className="bg-card" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Analysis</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Strengths</Label>
              <Textarea {...register("strengths")} placeholder="What does this player do well?" className="bg-card h-20" />
            </div>
            <div className="space-y-1.5">
              <Label>Weaknesses</Label>
              <Textarea {...register("weaknesses")} placeholder="Areas needing improvement..." className="bg-card h-20" />
            </div>
            <div className="space-y-1.5">
              <Label>Summary</Label>
              <Textarea {...register("summary")} placeholder="Overall assessment..." className="bg-card h-24" />
            </div>
            <div className="space-y-1.5">
              <Label>Recommendation</Label>
              <Textarea {...register("recommendation")} placeholder="Sign, Draft, Monitor, Pass..." className="bg-card h-16" />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={createReport.isPending} className="font-display tracking-wide uppercase">
            {createReport.isPending ? "Filing..." : "File Report"}
          </Button>
          <Link href="/reports"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
