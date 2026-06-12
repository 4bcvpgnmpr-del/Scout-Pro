import { useRoute, useLocation, Link } from "wouter";
import { useGetReport, useUpdateReport, getGetReportQueryKey, getListReportsQueryKey, getGetPlayerStatsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReportForm, type ReportFormValues } from "@/components/forms/report-form";

const s = (v: number | null | undefined) => (v != null ? String(v) : "");

export default function ReportEdit() {
  const [, params] = useRoute("/reports/:id/edit");
  const reportId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: report, isLoading } = useGetReport(reportId, { query: { enabled: !!reportId, queryKey: getGetReportQueryKey(reportId) } });
  const updateReport = useUpdateReport();

  const onSubmit = (data: ReportFormValues) => {
    const n = (v?: string) => (v ? parseInt(v) : null);
    const oreb = n(data.offensiveRebounds);
    const dreb = n(data.defensiveRebounds);
    const totalReb = oreb != null || dreb != null ? (oreb ?? 0) + (dreb ?? 0) : null;
    updateReport.mutate({
      id: reportId,
      data: {
        scoutName: data.scoutName,
        date: data.date,
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
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetReportQueryKey(reportId) });
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(parseInt(data.playerId)) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Informe actualizado" });
        setLocation(`/reports/${reportId}`);
      },
      onError: () => toast({ title: "Error", description: "No se pudo actualizar el informe.", variant: "destructive" }),
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/reports/${reportId}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">Editar Informe</h1>
          <p className="text-muted-foreground">Actualiza el informe de scouting.</p>
        </div>
      </div>
      {isLoading || !report ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <ReportForm
          defaultValues={{
            playerId: String(report.playerId),
            gameId: report.gameId != null ? String(report.gameId) : "",
            scoutName: report.scoutName,
            date: report.date || "",
            rating: s(report.rating),
            offensiveRating: s(report.offensiveRating),
            defensiveRating: s(report.defensiveRating),
            athleticismRating: s(report.athleticismRating),
            iQRating: s(report.iQRating),
            points: s(report.points),
            offensiveRebounds: s(report.offensiveRebounds),
            defensiveRebounds: s(report.defensiveRebounds),
            assists: s(report.assists),
            steals: s(report.steals),
            blocks: s(report.blocks),
            turnovers: s(report.turnovers),
            minutesPlayed: s(report.minutesPlayed),
            fieldGoalsMade: s(report.fieldGoalsMade),
            fieldGoalsAttempted: s(report.fieldGoalsAttempted),
            threesMade: s(report.threesMade),
            threesAttempted: s(report.threesAttempted),
            freeThrowsMade: s(report.freeThrowsMade),
            freeThrowsAttempted: s(report.freeThrowsAttempted),
            strengths: report.strengths || "",
            weaknesses: report.weaknesses || "",
            summary: report.summary || "",
            recommendation: report.recommendation || "",
          }}
          onSubmit={onSubmit}
          submitting={updateReport.isPending}
          submitLabel="Guardar Cambios"
          cancelTo={`/reports/${reportId}`}
        />
      )}
    </div>
  );
}
