import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetPlayer, useGetPlayerStats, useListReports, useDeletePlayer, useCreateReport, useUpdateReport, getListPlayersQueryKey, getGetPlayerQueryKey, getGetPlayerStatsQueryKey, getListReportsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, FileText, TrendingUp, Download, Loader2, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExportPdf } from "@/hooks/use-export-pdf";

type StatKey = "points" | "offReb" | "defReb" | "assists" | "steals" | "blocks" | "turnovers" | "minutes"
  | "fgMade" | "fgAtt" | "t3Made" | "t3Att" | "ftMade" | "ftAtt";

type EditStats = Record<StatKey, string>;

const STAT_ROWS: [StatKey, string][] = [
  ["minutes", "MIN"],
  ["points", "PTS"],
  ["offReb", "REB OF"],
  ["defReb", "REB DEF"],
  ["assists", "AST"],
  ["steals", "ROB"],
  ["blocks", "TAP"],
  ["turnovers", "PÉR"],
  ["fgMade", "TC C"],
  ["fgAtt", "TC I"],
  ["t3Made", "T3 C"],
  ["t3Att", "T3 I"],
  ["ftMade", "TL C"],
  ["ftAtt", "TL I"],
];

function StatBox({ label, value, editing, editValue, onChange }: {
  label: string;
  value: string | number | null | undefined;
  editing?: boolean;
  editValue?: string;
  onChange?: (v: string) => void;
}) {
  if (editing) {
    return (
      <div className="bg-card border-2 border-primary/30 rounded-lg p-2 text-center">
        <Input
          type="number"
          min="0"
          value={editValue ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-8 text-center text-base font-bold border-0 bg-transparent focus-visible:ring-0 p-0"
        />
        <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">{label}</div>
      </div>
    );
  }
  return (
    <div className="bg-card border rounded-lg p-4 text-center">
      <div className="text-2xl font-display text-primary">{value != null ? (typeof value === "number" ? value.toFixed(1) : value) : "—"}</div>
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

  const { contentRef, exportPdf, exporting } = useExportPdf(`perfil-jugador-${playerId}`);
  const { data: player, isLoading } = useGetPlayer(playerId, { query: { enabled: !!playerId, queryKey: getGetPlayerQueryKey(playerId) } });
  const { data: stats } = useGetPlayerStats(playerId, { query: { enabled: !!playerId, queryKey: getGetPlayerStatsQueryKey(playerId) } });
  const { data: reports } = useListReports({ playerId }, { query: { enabled: !!playerId, queryKey: getListReportsQueryKey({ playerId }) } });
  const deletePlayer = useDeletePlayer();
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();

  const [editingStats, setEditingStats] = useState(false);
  const [editStats, setEditStats] = useState<EditStats>({
    points: "", offReb: "", defReb: "", assists: "", steals: "", blocks: "", turnovers: "", minutes: "",
    fgMade: "", fgAtt: "", t3Made: "", t3Att: "", ftMade: "", ftAtt: "",
  });

  const fgPct = stats?.avgFieldGoalPct != null ? (Number(stats.avgFieldGoalPct) * 100).toFixed(1) + "%" : null;
  const threePct = stats?.avgThreePointPct != null ? (Number(stats.avgThreePointPct) * 100).toFixed(1) + "%" : null;
  const ftPct = stats?.avgFreeThrowPct != null ? (Number(stats.avgFreeThrowPct) * 100).toFixed(1) + "%" : null;

  const handleStartEdit = () => {
    setEditStats({
      points: stats?.avgPoints != null ? String(Math.round(Number(stats.avgPoints))) : "",
      offReb: "",
      defReb: stats?.avgRebounds != null ? String(Math.round(Number(stats.avgRebounds))) : "",
      assists: stats?.avgAssists != null ? String(Math.round(Number(stats.avgAssists))) : "",
      steals: stats?.avgSteals != null ? String(Math.round(Number(stats.avgSteals))) : "",
      blocks: stats?.avgBlocks != null ? String(Math.round(Number(stats.avgBlocks))) : "",
      turnovers: "",
      minutes: stats?.avgMinutes != null ? String(Math.round(Number(stats.avgMinutes))) : "",
      fgMade: "", fgAtt: "", t3Made: "", t3Att: "", ftMade: "", ftAtt: "",
    });
    setEditingStats(true);
  };

  const n = (v: string | undefined) => v && v !== "" ? parseInt(v) : undefined;

  const handleSaveStats = () => {
    const today = new Date().toISOString().split("T")[0];
    const reportData = {
      playerId,
      scoutName: "Scout",
      date: today,
      rating: 7,
      points: n(editStats.points),
      offensiveRebounds: n(editStats.offReb),
      defensiveRebounds: n(editStats.defReb),
      assists: n(editStats.assists),
      steals: n(editStats.steals),
      blocks: n(editStats.blocks),
      turnovers: n(editStats.turnovers),
      minutesPlayed: n(editStats.minutes),
      fieldGoalsMade: n(editStats.fgMade),
      fieldGoalsAttempted: n(editStats.fgAtt),
      threesMade: n(editStats.t3Made),
      threesAttempted: n(editStats.t3Att),
      freeThrowsMade: n(editStats.ftMade),
      freeThrowsAttempted: n(editStats.ftAtt),
    };

    const onDone = () => {
      queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(playerId) });
      queryClient.invalidateQueries({ queryKey: getListReportsQueryKey({ playerId }) });
      setEditingStats(false);
      toast({ title: "Estadísticas actualizadas" });
    };

    if (reports && reports.length === 1) {
      updateReport.mutate({ id: reports[0].id, data: reportData }, { onSuccess: onDone });
    } else {
      createReport.mutate({ data: reportData }, { onSuccess: onDone });
    }
  };

  const handleDelete = () => {
    if (!confirm(`¿Eliminar a ${player?.name}? Esta acción no se puede deshacer.`)) return;
    deletePlayer.mutate({ id: playerId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        toast({ title: "Jugador eliminado" });
        setLocation("/jugadores");
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

  if (!player) return <div className="text-muted-foreground py-12 text-center">Jugador no encontrado.</div>;

  const isSaving = createReport.isPending || updateReport.isPending;

  return (
    <div ref={contentRef} className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/jugadores">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <Avatar className="h-20 w-20 border-4 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-display text-2xl">
              {player.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-4xl uppercase italic">{player.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge className="font-mono font-bold">{player.position}</Badge>
              <span className="text-muted-foreground">{player.teamName || "Agente libre"}</span>
              {player.jerseyNumber != null && <span className="text-primary font-display text-lg">#{player.jerseyNumber}</span>}
            </div>
            <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
              {player.age && <span>{player.age} años</span>}
              {player.height && <span>{player.height}</span>}
              {player.weight && <span>{player.weight} kg</span>}
              {player.nationality && <span>{player.nationality}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/reports/new?playerId=${playerId}`}>
            <Button className="font-display tracking-wide uppercase"><Plus className="mr-2 h-4 w-4" /> Nuevo informe</Button>
          </Link>
          <Link href={`/players/${playerId}/edit`}>
            <Button variant="outline" className="font-display tracking-wide uppercase"><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
          </Link>
          <Button variant="outline" size="icon" onClick={exportPdf} disabled={exporting} title="Exportar PDF">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={handleDelete} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats card — always shown, editable */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {stats && stats.gamesPlayed > 0
              ? `Promedios de temporada (${stats.gamesPlayed} partidos)`
              : "Estadísticas de temporada"}
          </CardTitle>
          {!editingStats ? (
            <Button variant="ghost" size="sm" onClick={handleStartEdit} className="text-muted-foreground hover:text-primary">
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveStats} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingStats(false)} disabled={isSaving}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {editingStats ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {reports && reports.length === 1
                  ? "Actualizando el informe existente."
                  : "Se creará un nuevo informe con estas estadísticas."}
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {STAT_ROWS.map(([key, label]) => (
                  <div key={key} className="bg-card border-2 border-primary/20 rounded-lg p-2 text-center">
                    <Input
                      type="number"
                      min="0"
                      value={editStats[key]}
                      onChange={(e) => setEditStats((s) => ({ ...s, [key]: e.target.value }))}
                      className="h-7 text-center text-sm font-bold border-0 bg-transparent focus-visible:ring-0 p-0"
                      placeholder="—"
                    />
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : stats && stats.gamesPlayed > 0 ? (
            <div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <StatBox label="PTS" value={Number(stats.avgPoints)} />
                <StatBox label="REB" value={Number(stats.avgRebounds)} />
                <StatBox label="AST" value={Number(stats.avgAssists)} />
                <StatBox label="ROB" value={Number(stats.avgSteals)} />
                <StatBox label="TAP" value={Number(stats.avgBlocks)} />
                <StatBox label="MIN" value={Number(stats.avgMinutes)} />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <StatBox label="TC%" value={fgPct} />
                <StatBox label="T3%" value={threePct} />
                <StatBox label="TL%" value={ftPct} />
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Sin estadísticas todavía.{" "}
              <button onClick={handleStartEdit} className="text-primary underline">Añadir ahora.</button>
            </div>
          )}
        </CardContent>
      </Card>

      {player.notes && (
        <Card>
          <CardHeader><CardTitle>Notas de scouting</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground leading-relaxed">{player.notes}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Informes de scouting</CardTitle>
          <span className="text-sm text-muted-foreground">{reports?.length || 0} total</span>
        </CardHeader>
        <CardContent>
          {!reports || reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Sin informes todavía.{" "}
              <Link href={`/reports/new?playerId=${playerId}`}>
                <span className="text-primary underline cursor-pointer">Crear el primero.</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <Link key={r.id} href={`/reports/${r.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:border-primary transition-colors cursor-pointer group">
                    <div>
                      <div className="font-semibold group-hover:text-primary transition-colors">
                        {r.date} — por {r.scoutName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {r.summary || [r.strengths && `Fortalezas: ${r.strengths}`, r.weaknesses && `Debilidades: ${r.weaknesses}`].filter(Boolean).join(" · ")}
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
