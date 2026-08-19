import { useLocation, useSearch, Link } from "wouter";
import { useCreateReport, getListReportsQueryKey, getGetPlayerStatsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReportForm, type ReportFormValues } from "@/components/forms/report-form";

export default function ReportNew() {
  const search = useSearch();
  const defaultPlayerId = new URLSearchParams(search).get("playerId") || "";

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createReport = useCreateReport();

  const today = new Date().toISOString().split("T")[0];

  const onSubmit = (data: ReportFormValues) => {
    const n = (v?: string) => (v ? parseInt(v) : null);
    const oreb = n(data.offensiveRebounds);
    const dreb = n(data.defensiveRebounds);
    const totalReb = oreb != null || dreb != null ? (oreb ?? 0) + (dreb ?? 0) : null;
    createReport.mutate({
      data: {
        playerId: parseInt(data.playerId),
        gameId: data.gameId ? parseInt(data.gameId) : null,
        scoutName: data.scoutName,
        date: data.date || today,
        rating: parseInt(data.rating),
        offensiveRating: n(data.offensiveRating),
        defensiveRating: n(data.defensiveRating),
        athleticismRating: n(data.athleticismRating),
        iQRating: n(data.iQRating),
        points: n(data.points),
        rebounds: totalReb,
        offensiveRebounds: oreb,
        defensiveRebounds: dreb,
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
        queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(parseInt(data.playerId)) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Informe guardado" });
        setLocation(`/reports/${report.id}`);
      },
      onError: () => toast({ title: "Error", description: "No se pudo guardar el informe.", variant: "destructive" }),
    });
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">Nuevo Informe</h1>
          <p className="text-muted-foreground">Registra un informe de scouting sobre un prospecto.</p>
        </div>
      </div>
      <ReportForm
        defaultValues={{ playerId: defaultPlayerId, gameId: "", date: today }}
        onSubmit={onSubmit}
        submitting={createReport.isPending}
        submitLabel="Guardar Informe"
        cancelTo="/reports"
      />
    </div>
  );
}
