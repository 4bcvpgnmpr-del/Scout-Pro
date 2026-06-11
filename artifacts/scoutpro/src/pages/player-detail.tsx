import { useRoute, Link, useLocation } from "wouter";
import { useGetPlayer, useGetPlayerStats, useListReports, useDeletePlayer, getListPlayersQueryKey, getGetPlayerQueryKey, getGetPlayerStatsQueryKey, getListReportsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, FileText, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatBox({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="bg-card border rounded-lg p-4 text-center">
      <div className="text-2xl font-display text-primary">{value != null ? (typeof value === 'number' ? value.toFixed(1) : value) : "—"}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

export default function PlayerDetail() {
  const [, params] = useRoute("/players/:id");
  const playerId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: player, isLoading } = useGetPlayer(playerId, { query: { enabled: !!playerId, queryKey: getGetPlayerQueryKey(playerId) } });
  const { data: stats } = useGetPlayerStats(playerId, { query: { enabled: !!playerId, queryKey: getGetPlayerStatsQueryKey(playerId) } });
  const { data: reports } = useListReports({ playerId }, { query: { enabled: !!playerId, queryKey: getListReportsQueryKey({ playerId }) } });
  const deletePlayer = useDeletePlayer();

  const handleDelete = () => {
    if (!confirm(`Delete ${player?.name}? This cannot be undone.`)) return;
    deletePlayer.mutate({ id: playerId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        toast({ title: "Player deleted" });
        setLocation("/players");
      },
    });
  };

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    </div>
  );

  if (!player) return <div className="text-muted-foreground py-12 text-center">Player not found.</div>;

  const fgPct = stats?.avgFieldGoalPct != null ? (Number(stats.avgFieldGoalPct) * 100).toFixed(1) + "%" : null;
  const threePct = stats?.avgThreePointPct != null ? (Number(stats.avgThreePointPct) * 100).toFixed(1) + "%" : null;
  const ftPct = stats?.avgFreeThrowPct != null ? (Number(stats.avgFreeThrowPct) * 100).toFixed(1) + "%" : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/players">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <Avatar className="h-20 w-20 border-4 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-display text-2xl">
              {player.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-4xl uppercase italic">{player.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge className="font-mono font-bold">{player.position}</Badge>
              <span className="text-muted-foreground">{player.teamName || "Free Agent"}</span>
              {player.jerseyNumber != null && <span className="text-primary font-display text-lg">#{player.jerseyNumber}</span>}
            </div>
            <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
              {player.age && <span>{player.age} yrs</span>}
              {player.height && <span>{player.height}</span>}
              {player.weight && <span>{player.weight} lbs</span>}
              {player.nationality && <span>{player.nationality}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/reports/new?playerId=${playerId}`}>
            <Button className="font-display tracking-wide uppercase"><Plus className="mr-2 h-4 w-4" /> Nuevo informe</Button>
          </Link>
          <Button variant="outline" size="icon" onClick={handleDelete} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {stats && stats.gamesPlayed > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Season Averages ({stats.gamesPlayed} games)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <StatBox label="PTS" value={Number(stats.avgPoints)} />
              <StatBox label="REB" value={Number(stats.avgRebounds)} />
              <StatBox label="AST" value={Number(stats.avgAssists)} />
              <StatBox label="STL" value={Number(stats.avgSteals)} />
              <StatBox label="BLK" value={Number(stats.avgBlocks)} />
              <StatBox label="MIN" value={Number(stats.avgMinutes)} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <StatBox label="FG%" value={fgPct} />
              <StatBox label="3P%" value={threePct} />
              <StatBox label="FT%" value={ftPct} />
            </div>
          </CardContent>
        </Card>
      )}

      {player.notes && (
        <Card>
          <CardHeader><CardTitle>Scout Notes</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground leading-relaxed">{player.notes}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Scouting Reports</CardTitle>
          <span className="text-sm text-muted-foreground">{reports?.length || 0} total</span>
        </CardHeader>
        <CardContent>
          {!reports || reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No reports yet.{" "}
              <Link href={`/reports/new?playerId=${playerId}`}>
                <span className="text-primary underline cursor-pointer">Create the first one.</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(r => (
                <Link key={r.id} href={`/reports/${r.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:border-primary transition-colors cursor-pointer group">
                    <div>
                      <div className="font-semibold group-hover:text-primary transition-colors">
                        {r.date} — by {r.scoutName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {r.summary || [r.strengths && `Strengths: ${r.strengths}`, r.weaknesses && `Weaknesses: ${r.weaknesses}`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="text-2xl font-display text-primary ml-4 px-3 py-1 bg-primary/10 rounded">{r.rating}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
