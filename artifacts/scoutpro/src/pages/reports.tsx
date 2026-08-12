import { useState, useMemo } from "react";
import {
  useListReports,
  useListPlayers,
  useListTeams,
  getListReportsQueryKey,
} from "@workspace/api-client-react";
import type { Report } from "@workspace/api-client-react";
import { useSeason } from "@/contexts/SeasonContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, FileText, ArrowRight, TrendingUp, Shield, Zap, Brain } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

function MiniRatingBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 10}%` }} />
    </div>
  );
}

export default function Reports() {
  const [playerFilter, setPlayerFilter] = useState<number | undefined>();
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [leagueFilter, setLeagueFilter] = useState<string>("");
  const { selectedSeason } = useSeason();
  const { activeWorkspace } = useWorkspace();

  const { data: reports, isLoading } = useListReports(
    playerFilter ? { playerId: playerFilter } : undefined,
    {
      query: {
        queryKey: [
          ...getListReportsQueryKey(playerFilter ? { playerId: playerFilter } : undefined),
          selectedSeason?.id,
        ],
        queryFn: (): Promise<Report[]> => {
          const params = new URLSearchParams();
          if (playerFilter) params.set("playerId", String(playerFilter));
          if (selectedSeason) params.set("season", String(selectedSeason.startYear));
          const qs = params.toString();
          return fetch(`/api/reports${qs ? `?${qs}` : ""}`, { credentials: "include" }).then((r) => r.json());
        },
      },
    },
  );
  const { data: players } = useListPlayers();
  const { data: teams } = useListTeams();

  const playerMap = useMemo(() => {
    const m: Record<number, { position: string; teamId: number | null | undefined }> = {};
    (players ?? []).forEach((p) => { m[p.id] = { position: p.position, teamId: p.teamId }; });
    return m;
  }, [players]);

  const teamLeagueMap = useMemo(() => {
    const m: Record<number, string> = {};
    (teams ?? []).forEach((t) => { if (t.league) m[t.id] = t.league; });
    return m;
  }, [teams]);

  const allLeagues = useMemo(() => {
    const s = new Set<string>();
    (teams ?? []).forEach((t) => { if (t.league) s.add(t.league); });
    return [...s].sort();
  }, [teams]);

  // Build a set of teamIds matching the active workspace team name
  const wsTeamIds = useMemo(() => {
    if (!activeWorkspace) return null;
    const wsNameLower = activeWorkspace.teamName.toLowerCase();
    const ids = new Set<number>();
    (teams ?? []).forEach((t) => {
      if (t.name.toLowerCase() === wsNameLower) ids.add(t.id);
    });
    return ids.size > 0 ? ids : null;
  }, [activeWorkspace?.id, teams]);

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter((r) => {
      const player = playerMap[r.playerId];
      // Workspace filter: only show reports for players on the active workspace team
      if (wsTeamIds) {
        const tId = player?.teamId;
        if (!tId || !wsTeamIds.has(tId)) return false;
      }
      if (positionFilter && player?.position !== positionFilter) return false;
      if (leagueFilter) {
        const teamId = player?.teamId;
        const league = teamId ? teamLeagueMap[teamId] : undefined;
        if (league !== leagueFilter) return false;
      }
      return true;
    });
  }, [reports, playerMap, teamLeagueMap, positionFilter, leagueFilter, wsTeamIds]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl">Informes</h1>
          <p className="text-muted-foreground">Todos los informes de scouting.</p>
        </div>
        <Link href="/reports/new">
          <Button className="font-display tracking-wide uppercase">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Informe
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          value={playerFilter ? String(playerFilter) : "ALL"}
          onValueChange={(v) => setPlayerFilter(v === "ALL" ? undefined : parseInt(v))}
        >
          <SelectTrigger className="w-[200px] bg-card">
            <SelectValue placeholder="Jugador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los jugadores</SelectItem>
            {players?.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={positionFilter || "ALL"} onValueChange={(v) => setPositionFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-[160px] bg-card">
            <SelectValue placeholder="Posición" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las posiciones</SelectItem>
            {POSITIONS.map((pos) => (
              <SelectItem key={pos} value={pos}>{pos}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={leagueFilter || "ALL"} onValueChange={(v) => setLeagueFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-[180px] bg-card">
            <SelectValue placeholder="Liga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las ligas</SelectItem>
            {allLeagues.map((lg) => (
              <SelectItem key={lg} value={lg}>{lg}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(positionFilter || leagueFilter || playerFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setPositionFilter(""); setLeagueFilter(""); setPlayerFilter(undefined); }}
            className="text-muted-foreground"
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : !filteredReports || filteredReports.length === 0 ? (
        <Card className="border-dashed bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted p-3 rounded-full mb-4"><FileText className="h-6 w-6 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold">Sin informes</h3>
            <p className="text-sm text-muted-foreground mt-1">No hay informes que coincidan con los filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((r) => {
            const hasRatings = r.offensiveRating != null || r.defensiveRating != null || r.athleticismRating != null || r.iQRating != null;
            return (
              <Link key={r.id} href={`/reports/${r.id}`}>
                <Card className="hover:border-primary transition-all duration-200 cursor-pointer group hover-elevate">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="text-3xl font-display text-primary bg-primary/10 rounded-lg px-4 py-2 min-w-[60px] text-center flex-shrink-0 mt-0.5">
                      {r.rating}
                    </div>
                    <div className="flex-1 overflow-hidden min-w-0">
                      <div className="font-semibold group-hover:text-primary transition-colors">{r.playerName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        por {r.scoutName} · {r.date}
                      </div>
                      {(r.points != null || r.rebounds != null || r.assists != null) && (
                        <div className="flex gap-3 mt-1.5 text-xs font-mono text-muted-foreground">
                          {r.points != null && <span>{r.points} PTS</span>}
                          {r.rebounds != null && <span>{r.rebounds} REB</span>}
                          {r.assists != null && <span>{r.assists} AST</span>}
                          {r.steals != null && <span>{r.steals} ROB</span>}
                          {r.blocks != null && <span>{r.blocks} TAP</span>}
                        </div>
                      )}
                      {hasRatings && (
                        <div className="mt-2.5 space-y-1">
                          {r.offensiveRating != null && (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
                              <MiniRatingBar value={r.offensiveRating} color="bg-orange-500" />
                              <span className="text-[11px] font-display text-muted-foreground w-6 text-right">{r.offensiveRating}</span>
                            </div>
                          )}
                          {r.defensiveRating != null && (
                            <div className="flex items-center gap-2">
                              <Shield className="h-3 w-3 text-muted-foreground shrink-0" />
                              <MiniRatingBar value={r.defensiveRating} color="bg-blue-500" />
                              <span className="text-[11px] font-display text-muted-foreground w-6 text-right">{r.defensiveRating}</span>
                            </div>
                          )}
                          {r.athleticismRating != null && (
                            <div className="flex items-center gap-2">
                              <Zap className="h-3 w-3 text-muted-foreground shrink-0" />
                              <MiniRatingBar value={r.athleticismRating} color="bg-yellow-500" />
                              <span className="text-[11px] font-display text-muted-foreground w-6 text-right">{r.athleticismRating}</span>
                            </div>
                          )}
                          {r.iQRating != null && (
                            <div className="flex items-center gap-2">
                              <Brain className="h-3 w-3 text-muted-foreground shrink-0" />
                              <MiniRatingBar value={r.iQRating} color="bg-green-500" />
                              <span className="text-[11px] font-display text-muted-foreground w-6 text-right">{r.iQRating}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1 shrink-0 mt-1" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
