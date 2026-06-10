import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Shield, FileText, Trophy, Activity } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data, isLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  const summary = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Dashboard</h1>
        <p className="text-muted-foreground">League-wide scouting overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display">{summary?.totalPlayers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teams Tracked</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display">{summary?.totalTeams || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reports Filed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display">{summary?.totalReports || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Prospect Rating</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display text-primary">{summary?.avgRating?.toFixed(1) || "N/A"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {summary?.recentReports && summary.recentReports.length > 0 ? (
              <div className="space-y-4">
                {summary.recentReports.map(report => (
                  <Link key={report.id} href={`/reports/${report.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-primary transition-colors cursor-pointer group">
                      <div>
                        <div className="font-semibold group-hover:text-primary transition-colors">{report.playerName}</div>
                        <div className="text-xs text-muted-foreground">by {report.scoutName} &bull; {new Date(report.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div className="bg-primary/10 text-primary font-display text-xl px-3 py-1 rounded">
                        {report.rating}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm py-12">
                No reports filed recently.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Positional Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.positionBreakdown && summary.positionBreakdown.length > 0 ? (
              <div className="space-y-4">
                {summary.positionBreakdown.map(pos => (
                  <div key={pos.position} className="flex items-center">
                    <div className="w-16 font-mono text-sm font-bold">{pos.position}</div>
                    <div className="flex-1 mx-4 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${(pos.count / (summary.totalPlayers || 1)) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-right font-mono text-sm">{pos.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm py-12">
                No positional data available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
