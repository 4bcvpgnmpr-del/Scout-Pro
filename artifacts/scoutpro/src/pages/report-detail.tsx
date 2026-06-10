import { useRoute, Link, useLocation } from "wouter";
import { useGetReport, useDeleteReport, getListReportsQueryKey, getGetReportQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, TrendingUp, Shield, Zap, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function RatingBar({ label, value, icon: Icon }: { label: string; value: number | null | undefined; icon: React.ElementType }) {
  if (value == null) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
        <span className="font-display text-primary">{value}/10</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <div className="bg-card border rounded-lg p-3 text-center">
      <div className="text-xl font-display">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

export default function ReportDetail() {
  const [, params] = useRoute("/reports/:id");
  const reportId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: report, isLoading } = useGetReport(reportId, { query: { enabled: !!reportId, queryKey: getGetReportQueryKey(reportId) } });
  const deleteReport = useDeleteReport();

  const handleDelete = () => {
    if (!confirm("Delete this scouting report?")) return;
    deleteReport.mutate({ id: reportId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Report deleted" });
        setLocation("/reports");
      },
    });
  };

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
    </div>
  );

  if (!report) return <div className="text-muted-foreground py-12 text-center">Report not found.</div>;

  const fgPct = report.fieldGoalsAttempted ? ((report.fieldGoalsMade || 0) / report.fieldGoalsAttempted * 100).toFixed(1) + "%" : null;
  const threePct = report.threesAttempted ? ((report.threesMade || 0) / report.threesAttempted * 100).toFixed(1) + "%" : null;
  const ftPct = report.freeThrowsAttempted ? ((report.freeThrowsMade || 0) / report.freeThrowsAttempted * 100).toFixed(1) + "%" : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <Link href={`/players/${report.playerId}`}>
              <h1 className="text-4xl uppercase italic hover:text-primary transition-colors cursor-pointer">{report.playerName}</h1>
            </Link>
            <div className="flex items-center gap-3 mt-1 text-muted-foreground text-sm">
              <span>Scouted by <strong className="text-foreground">{report.scoutName}</strong></span>
              <span>·</span>
              <span>{report.date}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-5xl font-display text-primary bg-primary/10 rounded-xl px-6 py-3">{report.rating}</div>
          <Button variant="outline" size="icon" onClick={handleDelete} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle>Component Ratings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <RatingBar label="Offense" value={report.offensiveRating} icon={TrendingUp} />
            <RatingBar label="Defense" value={report.defensiveRating} icon={Shield} />
            <RatingBar label="Athleticism" value={report.athleticismRating} icon={Zap} />
            <RatingBar label="Basketball IQ" value={report.iQRating} icon={Brain} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Game Stats</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <StatChip label="PTS" value={report.points} />
              <StatChip label="REB" value={report.rebounds} />
              <StatChip label="AST" value={report.assists} />
              <StatChip label="STL" value={report.steals} />
              <StatChip label="BLK" value={report.blocks} />
              <StatChip label="TO" value={report.turnovers} />
              <StatChip label="MIN" value={report.minutesPlayed} />
              {fgPct && <div className="bg-card border rounded-lg p-3 text-center"><div className="text-xl font-display">{fgPct}</div><div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">FG%</div></div>}
              {threePct && <div className="bg-card border rounded-lg p-3 text-center"><div className="text-xl font-display">{threePct}</div><div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">3P%</div></div>}
              {ftPct && <div className="bg-card border rounded-lg p-3 text-center"><div className="text-xl font-display">{ftPct}</div><div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">FT%</div></div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {(report.strengths || report.weaknesses) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {report.strengths && (
            <Card className="border-l-4 border-l-primary">
              <CardHeader><CardTitle>Strengths</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground leading-relaxed">{report.strengths}</p></CardContent>
            </Card>
          )}
          {report.weaknesses && (
            <Card className="border-l-4 border-l-destructive">
              <CardHeader><CardTitle>Weaknesses</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground leading-relaxed">{report.weaknesses}</p></CardContent>
            </Card>
          )}
        </div>
      )}

      {report.summary && (
        <Card>
          <CardHeader><CardTitle>Scout Summary</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground leading-relaxed">{report.summary}</p></CardContent>
        </Card>
      )}

      {report.recommendation && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader><CardTitle>Recommendation</CardTitle></CardHeader>
          <CardContent><p className="font-semibold text-primary">{report.recommendation}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
