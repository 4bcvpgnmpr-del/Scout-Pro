import { useState } from "react";
import { useListReports, useListPlayers, getListReportsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, FileText, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Reports() {
  const [playerFilter, setPlayerFilter] = useState<number | undefined>();
  const { data: reports, isLoading } = useListReports(
    playerFilter ? { playerId: playerFilter } : undefined,
    { query: { queryKey: getListReportsQueryKey(playerFilter ? { playerId: playerFilter } : undefined) } }
  );
  const { data: players } = useListPlayers();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl">Reports</h1>
          <p className="text-muted-foreground">All scouting reports in the database.</p>
        </div>
        <Link href="/reports/new">
          <Button className="font-display tracking-wide uppercase"><Plus className="mr-2 h-4 w-4" /> New Report</Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <Select value={playerFilter ? String(playerFilter) : "ALL"} onValueChange={(v) => setPlayerFilter(v === "ALL" ? undefined : parseInt(v))}>
          <SelectTrigger className="w-[240px] bg-card">
            <SelectValue placeholder="Filter by player" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Players</SelectItem>
            {players?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !reports || reports.length === 0 ? (
        <Card className="border-dashed bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted p-3 rounded-full mb-4"><FileText className="h-6 w-6 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold">No reports yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Start filing scouting reports on prospects.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <Link key={r.id} href={`/reports/${r.id}`}>
              <Card className="hover:border-primary transition-all duration-200 cursor-pointer group hover-elevate">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="text-3xl font-display text-primary bg-primary/10 rounded-lg px-4 py-2 min-w-[60px] text-center flex-shrink-0">
                    {r.rating}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="font-semibold group-hover:text-primary transition-colors">{r.playerName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">by {r.scoutName} · {r.date}</div>
                    {(r.points != null || r.rebounds != null || r.assists != null) && (
                      <div className="flex gap-3 mt-1.5 text-xs font-mono">
                        {r.points != null && <span>{r.points} PTS</span>}
                        {r.rebounds != null && <span>{r.rebounds} REB</span>}
                        {r.assists != null && <span>{r.assists} AST</span>}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
