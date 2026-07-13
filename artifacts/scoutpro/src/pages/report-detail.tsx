import { useRef, useMemo } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetReport,
  useGetPlayer,
  useGetGame,
  useGetPlayerStats,
  useDeleteReport,
  getListReportsQueryKey,
  getGetReportQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetPlayerQueryKey,
  getGetGameQueryKey,
  getGetPlayerStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trash2, TrendingUp, Shield, Zap, Brain, Download, Loader2, Pencil, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useExportPdfPages } from "@/hooks/use-export-pdf-pages";
import { ScoutingReportPdf, type ScoutingNotes } from "@/components/pdf/scouting-report-pdf";

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

function loadScoutingNotes(gameId: number | null | undefined): ScoutingNotes | null {
  if (!gameId) return null;
  try {
    return JSON.parse(localStorage.getItem(`sf-scouting-${gameId}`) ?? "null");
  } catch {
    return null;
  }
}

export default function ReportDetail() {
  const [, params] = useRoute("/reports/:id");
  const reportId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { workspaces, activeId } = useWorkspace();
  const activeWs = useMemo(() => workspaces.find((w) => w.id === activeId), [workspaces, activeId]);
  const seasonYear = activeWs?.seasonId ? parseInt(activeWs.seasonId) : undefined;
  const statsParams = seasonYear ? { seasonYear } : undefined;

  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const page3Ref = useRef<HTMLDivElement>(null);
  const { exportPdf, exporting } = useExportPdfPages(`dossier-scouting-${reportId}`);

  const { data: report, isLoading } = useGetReport(reportId, {
    query: { enabled: !!reportId, queryKey: getGetReportQueryKey(reportId) },
  });
  const { data: player } = useGetPlayer(report?.playerId ?? 0, {
    query: { enabled: !!report?.playerId, queryKey: getGetPlayerQueryKey(report?.playerId ?? 0) },
  });
  const { data: game } = useGetGame(report?.gameId ?? 0, {
    query: { enabled: !!report?.gameId, queryKey: getGetGameQueryKey(report?.gameId ?? 0) },
  });
  const { data: seasonStats } = useGetPlayerStats(report?.playerId ?? 0, statsParams, {
    query: { enabled: !!report?.playerId, queryKey: getGetPlayerStatsQueryKey(report?.playerId ?? 0, statsParams) },
  });
  const deleteReport = useDeleteReport();

  const handleDelete = () => {
    if (!confirm("¿Eliminar este informe de scouting? Esta acción no se puede deshacer.")) return;
    deleteReport.mutate({ id: reportId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Informe eliminado" });
        setLocation("/reports");
      },
    });
  };

  const handleExport = () => {
    exportPdf([page1Ref, page2Ref, page3Ref]);
  };

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
    </div>
  );

  if (!report) return <div className="text-muted-foreground py-12 text-center">Informe no encontrado.</div>;

  const fgPct = report.fieldGoalsAttempted ? ((report.fieldGoalsMade || 0) / report.fieldGoalsAttempted * 100).toFixed(1) + "%" : null;
  const threePct = report.threesAttempted ? ((report.threesMade || 0) / report.threesAttempted * 100).toFixed(1) + "%" : null;
  const ftPct = report.freeThrowsAttempted ? ((report.freeThrowsMade || 0) / report.freeThrowsAttempted * 100).toFixed(1) + "%" : null;

  const notes = loadScoutingNotes(report.gameId);

  return (
    <div className="max-w-3xl space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex items-center gap-2">
          <Link href={`/reports/${reportId}/edit`}>
            <Button variant="outline" size="icon" title="Editar"><Pencil className="h-4 w-4" /></Button>
          </Link>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="gap-2 font-display tracking-wide uppercase"
            title="Exportar Dossier PDF profesional"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Generando..." : "Exportar Dossier PDF"}
          </Button>
          <Button variant="outline" size="icon" onClick={handleDelete} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* On-screen preview */}
      <div className="space-y-5">
        <div className="flex items-center gap-5 p-5 rounded-xl border bg-card">
          <div className="h-20 w-20 rounded-full overflow-hidden flex-shrink-0 border-2 border-primary/30 bg-primary/10 flex items-center justify-center">
            {player?.photoUrl ? (
              <img src={player.photoUrl} className="h-full w-full object-cover" crossOrigin="anonymous" alt={player.name} />
            ) : (
              <User className="h-8 w-8 text-primary/60" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/players/${report.playerId}`}>
              <h1 className="text-3xl uppercase italic hover:text-primary transition-colors cursor-pointer leading-tight">
                {report.playerName}
              </h1>
            </Link>
            {player && (
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-mono font-bold">{player.position}</span>
                {player.teamName && <span>{player.teamName}</span>}
                {player.age != null && <span>· {player.age} años</span>}
                {player.nationality && <span>· {player.nationality}</span>}
              </div>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              <span>Analizado por <strong className="text-foreground">{report.scoutName}</strong></span>
              <span>·</span>
              <span>{report.date}</span>
            </div>
            {game && (
              <div className="mt-1.5 text-xs text-muted-foreground">
                📅 {game.homeTeam} vs {game.awayTeam} · {game.date}
              </div>
            )}
          </div>
          <div className="text-5xl font-display text-primary bg-primary/10 rounded-xl px-5 py-3 shrink-0">
            {report.rating}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle>Valoraciones</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <RatingBar label="Ataque" value={report.offensiveRating} icon={TrendingUp} />
              <RatingBar label="Defensa" value={report.defensiveRating} icon={Shield} />
              <RatingBar label="Atletismo" value={report.athleticismRating} icon={Zap} />
              <RatingBar label="Basketball IQ" value={report.iQRating} icon={Brain} />
              {report.offensiveRating == null && report.defensiveRating == null && (
                <p className="text-sm text-muted-foreground">Sin valoraciones desglosadas.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Estadísticas del partido</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                <StatChip label="PTS" value={report.points} />
                <StatChip label="REB" value={report.rebounds} />
                <StatChip label="AST" value={report.assists} />
                <StatChip label="ROB" value={report.steals} />
                <StatChip label="TAP" value={report.blocks} />
                <StatChip label="PÉR" value={report.turnovers} />
                <StatChip label="MIN" value={report.minutesPlayed} />
                {fgPct && <div className="bg-card border rounded-lg p-3 text-center"><div className="text-xl font-display">{fgPct}</div><div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">TC%</div></div>}
                {threePct && <div className="bg-card border rounded-lg p-3 text-center"><div className="text-xl font-display">{threePct}</div><div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">T3%</div></div>}
                {ftPct && <div className="bg-card border rounded-lg p-3 text-center"><div className="text-xl font-display">{ftPct}</div><div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">TL%</div></div>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Season stats from BEV/FEB */}
        {seasonStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Estadísticas de temporada
                <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {seasonStats.gamesPlayed} PJ · promedio por partido
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
                {[
                  { label: "PTS", value: Number(seasonStats.avgPoints).toFixed(1) },
                  { label: "REB", value: Number(seasonStats.avgRebounds).toFixed(1) },
                  { label: "AST", value: Number(seasonStats.avgAssists).toFixed(1) },
                  { label: "ROB", value: Number(seasonStats.avgSteals).toFixed(1) },
                  { label: "TAP", value: Number(seasonStats.avgBlocks).toFixed(1) },
                  { label: "MIN", value: Number(seasonStats.avgMinutes).toFixed(1) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-center">
                    <div className="text-2xl font-display text-primary">{value}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              {(seasonStats.avgFieldGoalPct != null || seasonStats.avgThreePointPct != null || seasonStats.avgFreeThrowPct != null) && (
                <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                  {seasonStats.avgFieldGoalPct != null && (
                    <div className="bg-card border rounded-xl p-3 text-center">
                      <div className="text-xl font-display">{(Number(seasonStats.avgFieldGoalPct) * 100).toFixed(1)}%</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">TC%</div>
                    </div>
                  )}
                  {seasonStats.avgThreePointPct != null && (
                    <div className="bg-card border rounded-xl p-3 text-center">
                      <div className="text-xl font-display">{(Number(seasonStats.avgThreePointPct) * 100).toFixed(1)}%</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">T3%</div>
                    </div>
                  )}
                  {seasonStats.avgFreeThrowPct != null && (
                    <div className="bg-card border rounded-xl p-3 text-center">
                      <div className="text-xl font-display">{(Number(seasonStats.avgFreeThrowPct) * 100).toFixed(1)}%</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">TL%</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(report.strengths || report.weaknesses) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {report.strengths && (
              <Card className="border-l-4 border-l-primary">
                <CardHeader><CardTitle>Fortalezas</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground leading-relaxed">{report.strengths}</p></CardContent>
              </Card>
            )}
            {report.weaknesses && (
              <Card className="border-l-4 border-l-destructive">
                <CardHeader><CardTitle>Debilidades</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground leading-relaxed">{report.weaknesses}</p></CardContent>
              </Card>
            )}
          </div>
        )}

        {report.summary && (
          <Card>
            <CardHeader><CardTitle>Resumen del scout</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground leading-relaxed">{report.summary}</p></CardContent>
          </Card>
        )}

        {report.recommendation && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader><CardTitle>Recomendación</CardTitle></CardHeader>
            <CardContent><p className="font-semibold text-primary">{report.recommendation}</p></CardContent>
          </Card>
        )}

        {/* Hint */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-dashed text-xs text-muted-foreground">
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span>El botón <strong>Exportar Dossier PDF</strong> genera un informe profesional de 3 páginas: portada premium, estadísticas con Alerta IA y análisis completo.</span>
        </div>
      </div>

      {/* Hidden PDF pages for export — rendered off-screen */}
      {report && (
        <ScoutingReportPdf
          report={report}
          player={player}
          game={game}
          notes={notes}
          page1Ref={page1Ref}
          page2Ref={page2Ref}
          page3Ref={page3Ref}
        />
      )}
    </div>
  );
}
