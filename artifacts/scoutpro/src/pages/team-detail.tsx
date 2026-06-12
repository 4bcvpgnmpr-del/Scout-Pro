import { useMemo, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetTeam,
  useListPlayers,
  useDeleteTeam,
  useCreateReport,
  useListTeamMedia,
  useListReports,
  getListTeamsQueryKey,
  getGetTeamQueryKey,
  getListPlayersQueryKey,
  getListTeamMediaQueryKey,
  getListReportsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Trash2, Users, ArrowRight, Download, Loader2, Pencil, Plus,
  Image as ImageIcon, Video, BarChart2, ClipboardList, FileText, TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExportPdf } from "@/hooks/use-export-pdf";
import { TeamMediaSection } from "@/components/team-scouting";

function fmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

export default function TeamDetail() {
  const [, params] = useRoute("/teams/:id");
  const teamId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { contentRef, exportPdf, exporting } = useExportPdf(`informe-equipo-${teamId}`);

  const { data: team, isLoading } = useGetTeam(teamId, {
    query: { enabled: !!teamId, queryKey: getGetTeamQueryKey(teamId) },
  });
  const { data: players } = useListPlayers(
    { teamId },
    { query: { enabled: !!teamId, queryKey: getListPlayersQueryKey({ teamId }) } },
  );
  const { data: allMedia } = useListTeamMedia(teamId, {
    query: { enabled: !!teamId, queryKey: getListTeamMediaQueryKey(teamId) },
  });
  // Fetch all reports to filter by team players
  const { data: allReports } = useListReports(undefined, {
    query: { enabled: !!teamId, queryKey: getListReportsQueryKey() },
  });

  const deleteTeam = useDeleteTeam();
  const createReport = useCreateReport();
  const [sortBy, setSortBy] = useState<"name" | "jersey" | "position">("name");

  const [quickStat, setQuickStat] = useState<{ playerId: number; name: string } | null>(null);
  const [qs, setQs] = useState({ pts: "", reb: "", ast: "", stl: "", blk: "", to: "", min: "" });

  const openQuickStat = (playerId: number, name: string) => {
    setQuickStat({ playerId, name });
    setQs({ pts: "", reb: "", ast: "", stl: "", blk: "", to: "", min: "" });
  };

  const handleSaveQuickStat = () => {
    if (!quickStat) return;
    const today = new Date().toISOString().split("T")[0];
    createReport.mutate({
      data: {
        playerId: quickStat.playerId,
        scoutName: "Equipo",
        rating: 5,
        date: today,
        points: qs.pts ? parseInt(qs.pts) : null,
        rebounds: qs.reb ? parseInt(qs.reb) : null,
        assists: qs.ast ? parseInt(qs.ast) : null,
        steals: qs.stl ? parseInt(qs.stl) : null,
        blocks: qs.blk ? parseInt(qs.blk) : null,
        turnovers: qs.to ? parseInt(qs.to) : null,
        minutesPlayed: qs.min ? parseInt(qs.min) : null,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        toast({ title: "Estadística añadida" });
        setQuickStat(null);
      },
      onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
    });
  };

  const videos = (allMedia ?? []).filter((m) => m.category === "video");
  const systems = (allMedia ?? []).filter((m) => m.category === "system");

  const sortedPlayers = useMemo(() => {
    const list = [...(players ?? [])];
    if (sortBy === "jersey") {
      return list.sort((a, b) => {
        if (a.jerseyNumber == null && b.jerseyNumber == null) return 0;
        if (a.jerseyNumber == null) return 1;
        if (b.jerseyNumber == null) return -1;
        return a.jerseyNumber - b.jerseyNumber;
      });
    }
    if (sortBy === "position") {
      const order = ["PG", "SG", "SF", "PF", "C"];
      return list.sort((a, b) => {
        const ai = order.indexOf(a.position);
        const bi = order.indexOf(b.position);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [players, sortBy]);

  // Build per-player stat averages from reports
  const playerStatsMap = useMemo(() => {
    const playerIds = new Set((players ?? []).map((p) => p.id));
    const acc: Record<number, { pts: number; reb: number; ast: number; stl: number; blk: number; to: number; min: number; val: number; count: number }> = {};
    (allReports ?? [])
      .filter((r) => playerIds.has(r.playerId))
      .forEach((r) => {
        if (!acc[r.playerId]) acc[r.playerId] = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, min: 0, val: 0, count: 0 };
        const a = acc[r.playerId];
        a.pts += r.points ?? 0;
        a.reb += (r.rebounds ?? 0);
        a.ast += r.assists ?? 0;
        a.stl += r.steals ?? 0;
        a.blk += r.blocks ?? 0;
        a.to += r.turnovers ?? 0;
        a.min += r.minutesPlayed ?? 0;
        a.val += r.rating ?? 0;
        a.count += 1;
      });
    return acc;
  }, [players, allReports]);

  // Team totals (sum of averages)
  const teamTotals = useMemo(() => {
    const t = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, min: 0, val: 0 };
    Object.values(playerStatsMap).forEach((a) => {
      if (a.count === 0) return;
      t.pts += a.pts / a.count;
      t.reb += a.reb / a.count;
      t.ast += a.ast / a.count;
      t.stl += a.stl / a.count;
      t.blk += a.blk / a.count;
      t.to += a.to / a.count;
      t.min += a.min / a.count;
      t.val += a.val / a.count;
    });
    return t;
  }, [playerStatsMap]);

  const handleDeleteTeam = () => {
    if (!confirm(`¿Eliminar ${team?.name}? Esta acción no se puede deshacer.`)) return;
    deleteTeam.mutate({ id: teamId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        toast({ title: "Equipo eliminado" });
        setLocation("/equipos");
      },
    });
  };

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!team) return <div className="text-muted-foreground py-12 text-center">Equipo no encontrado.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/equipos">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          {/* Team logo */}
          {team.logoUrl && (
            <div className="h-12 w-12 rounded-xl overflow-hidden border shrink-0">
              <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
            </div>
          )}
          <div>
            <h1 className="text-4xl uppercase italic">{team.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-muted-foreground text-sm">
              {team.league && <span>{team.league}</span>}
              {team.city && <span>· {team.city}</span>}
              {team.teamType === "own" && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Mi Equipo</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/teams/${teamId}/edit`}>
            <Button variant="outline" className="font-display tracking-wide uppercase text-xs">
              <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
            </Button>
          </Link>
          <Button variant="outline" size="icon" onClick={handleDeleteTeam} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs — Highlights removed */}
      <Tabs defaultValue="plantilla">
        <TabsList className="w-full justify-start h-auto flex-wrap gap-1">
          <TabsTrigger value="plantilla" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Plantilla
          </TabsTrigger>
          <TabsTrigger value="fotos" className="flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> Fotos
          </TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5" /> Vídeos
          </TabsTrigger>
          <TabsTrigger value="estadisticas" className="flex items-center gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" /> Estadísticas
          </TabsTrigger>
          <TabsTrigger value="sistemas" className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Sistemas
          </TabsTrigger>
          <TabsTrigger value="informe" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Informe PDF
          </TabsTrigger>
        </TabsList>

        {/* ── Plantilla ─────────────────────────────────── */}
        <TabsContent value="plantilla" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" /> Plantilla · {players?.length ?? 0} jugadores
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Por nombre</SelectItem>
                    <SelectItem value="jersey">Por dorsal #</SelectItem>
                    <SelectItem value="position">Por posición</SelectItem>
                  </SelectContent>
                </Select>
                <Link href="/players/new">
                  <Button size="sm" className="font-display tracking-wide uppercase text-xs">
                    Añadir jugador
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {sortedPlayers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay jugadores en este equipo todavía.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedPlayers.map((player) => (
                    <Link key={player.id} href={`/players/${player.id}`}>
                      <div className="flex items-center gap-4 p-3 rounded-lg border hover:border-primary bg-card cursor-pointer group transition-colors">
                        <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center">
                          {player.photoUrl ? (
                            <img src={player.photoUrl} alt={player.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="font-display text-primary text-sm">
                              {player.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold group-hover:text-primary transition-colors">{player.name}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono bg-primary/10 text-primary px-1 rounded text-[10px]">{player.position}</span>
                            {player.jerseyNumber != null ? ` · #${player.jerseyNumber}` : ""}
                            {player.age != null ? ` · ${player.age} años` : ""}
                            {player.nationality ? ` · ${player.nationality}` : ""}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fotos ─────────────────────────────────────── */}
        <TabsContent value="fotos" className="mt-4">
          <div className="bg-white rounded-xl p-5 border">
            <TeamMediaSection teamId={teamId} category="photo" />
          </div>
        </TabsContent>

        {/* ── Vídeos ────────────────────────────────────── */}
        <TabsContent value="videos" className="mt-4">
          <div className="bg-white rounded-xl p-5 border">
            <TeamMediaSection teamId={teamId} category="video" />
          </div>
        </TabsContent>

        {/* ── Estadísticas (report-based) ───────────────── */}
        <TabsContent value="estadisticas" className="mt-4 space-y-4">
          {/* Team totals */}
          {Object.keys(playerStatsMap).length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {[
                { label: "PTS", value: teamTotals.pts },
                { label: "REB", value: teamTotals.reb },
                { label: "AST", value: teamTotals.ast },
                { label: "ROB", value: teamTotals.stl },
                { label: "TAP", value: teamTotals.blk },
                { label: "PÉR", value: teamTotals.to },
                { label: "MIN", value: teamTotals.min },
                { label: "VAL", value: teamTotals.val, accent: true },
              ].map(({ label, value, accent }) => (
                <Card key={label}>
                  <CardContent className="p-3 text-center">
                    <div className={`text-xl font-display leading-none ${accent ? "text-primary" : ""}`}>
                      {value.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" /> Estadísticas por Jugador
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">Promedio por partido · pulsa <Plus className="h-3 w-3 inline" /> para añadir</span>
            </CardHeader>
            <CardContent>
              {!players || players.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No hay jugadores en este equipo.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b text-[11px] text-muted-foreground uppercase tracking-wider">
                        <th className="text-left py-2.5 pr-4 font-medium">Jugador</th>
                        <th className="text-center py-2.5 px-2 font-medium w-10">Pos</th>
                        <th className="text-center py-2.5 px-2 font-medium w-8">#</th>
                        <th className="text-center py-2.5 px-2 font-medium">PTS</th>
                        <th className="text-center py-2.5 px-2 font-medium">REB</th>
                        <th className="text-center py-2.5 px-2 font-medium">AST</th>
                        <th className="text-center py-2.5 px-2 font-medium">ROB</th>
                        <th className="text-center py-2.5 px-2 font-medium">TAP</th>
                        <th className="text-center py-2.5 px-2 font-medium">PÉR</th>
                        <th className="text-center py-2.5 px-2 font-medium">MIN</th>
                        <th className="text-center py-2.5 px-2 font-medium text-primary">VAL</th>
                        <th className="text-center py-2.5 pl-2 font-medium text-muted-foreground/60">Part</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p) => {
                        const s = playerStatsMap[p.id];
                        const n = s?.count ?? 0;
                        const avg = (v: number) => n > 0 ? (v / n).toFixed(1) : "—";
                        return (
                          <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 pr-4">
                              <Link href={`/players/${p.id}`}>
                                <div className="flex items-center gap-2 cursor-pointer group">
                                  <div className="h-7 w-7 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                                    {p.photoUrl ? (
                                      <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                                    ) : (
                                      <span className="text-[10px] font-display text-primary">
                                        {p.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-medium group-hover:text-primary transition-colors">{p.name}</span>
                                </div>
                              </Link>
                            </td>
                            <td className="text-center py-2.5 px-2">
                              <span className="font-mono text-[10px] bg-primary/10 text-primary px-1 py-0.5 rounded">{p.position}</span>
                            </td>
                            <td className="text-center py-2.5 px-2 text-muted-foreground text-xs">
                              {p.jerseyNumber != null ? `#${p.jerseyNumber}` : "—"}
                            </td>
                            <td className="text-center py-2.5 px-2 font-medium">{avg(s?.pts ?? 0)}</td>
                            <td className="text-center py-2.5 px-2">{avg(s?.reb ?? 0)}</td>
                            <td className="text-center py-2.5 px-2">{avg(s?.ast ?? 0)}</td>
                            <td className="text-center py-2.5 px-2">{avg(s?.stl ?? 0)}</td>
                            <td className="text-center py-2.5 px-2">{avg(s?.blk ?? 0)}</td>
                            <td className="text-center py-2.5 px-2">{avg(s?.to ?? 0)}</td>
                            <td className="text-center py-2.5 px-2">{avg(s?.min ?? 0)}</td>
                            <td className="text-center py-2.5 px-2 font-semibold text-primary">{avg(s?.val ?? 0)}</td>
                            <td className="text-center py-2.5 pl-2 text-muted-foreground text-xs">{n || "—"}</td>
                            <td className="text-center py-2.5 pl-1">
                              <button
                                onClick={() => openQuickStat(p.id, p.name)}
                                title="Añadir estadística"
                                className="text-muted-foreground/40 hover:text-primary transition p-1 rounded hover:bg-primary/10"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Team totals row */}
                      {Object.keys(playerStatsMap).length > 0 && (
                        <tr className="border-t-2 bg-muted/30 font-semibold">
                          <td className="py-2.5 pr-4 text-xs uppercase tracking-wider text-muted-foreground" colSpan={3}>
                            Total equipo
                          </td>
                          <td className="text-center py-2.5 px-2">{teamTotals.pts.toFixed(1)}</td>
                          <td className="text-center py-2.5 px-2">{teamTotals.reb.toFixed(1)}</td>
                          <td className="text-center py-2.5 px-2">{teamTotals.ast.toFixed(1)}</td>
                          <td className="text-center py-2.5 px-2">{teamTotals.stl.toFixed(1)}</td>
                          <td className="text-center py-2.5 px-2">{teamTotals.blk.toFixed(1)}</td>
                          <td className="text-center py-2.5 px-2">{teamTotals.to.toFixed(1)}</td>
                          <td className="text-center py-2.5 px-2">{teamTotals.min.toFixed(1)}</td>
                          <td className="text-center py-2.5 px-2 text-primary">{teamTotals.val.toFixed(1)}</td>
                          <td />
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {Object.keys(playerStatsMap).length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-sm mt-4 border-t space-y-2">
                      <p>Sin estadísticas todavía. Pulsa <Plus className="h-3 w-3 inline" /> junto al jugador para añadir la primera.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sistemas ──────────────────────────────────── */}
        <TabsContent value="sistemas" className="mt-4">
          <div className="bg-white rounded-xl p-5 border">
            <TeamMediaSection teamId={teamId} category="system" />
          </div>
        </TabsContent>

        {/* ── Informe PDF ───────────────────────────────── */}
        <TabsContent value="informe" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={exportPdf} disabled={exporting} className="font-display uppercase tracking-wide">
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Descargar PDF
            </Button>
          </div>

          <div ref={contentRef} className="space-y-6 p-8 bg-white text-gray-900 rounded-xl border">
            {/* PDF Header */}
            <div className="flex items-start justify-between border-b-2 border-gray-200 pb-5">
              <div className="flex items-center gap-4">
                {team.logoUrl && (
                  <img src={team.logoUrl} alt={team.name} className="h-14 w-14 rounded-lg object-cover border" />
                )}
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Informe de Scouting</div>
                  <h2 className="text-3xl font-bold uppercase tracking-wide text-gray-900">{team.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5 text-gray-500 text-sm">
                    {team.league && <span>{team.league}</span>}
                    {team.city && <><span>·</span><span>{team.city}</span></>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-gray-400">Fecha</div>
                <div className="font-semibold text-sm text-gray-700">{new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}</div>
                <div className="text-xs text-gray-400 mt-1">ScoutPro · Análisis Profesional</div>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Jugadores", value: players?.length ?? 0 },
                { label: "Vídeos", value: videos.length },
                { label: "Sistemas", value: systems.length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                  <div className="text-3xl font-bold text-gray-900">{value}</div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-400 mt-1">{label}</div>
                </div>
              ))}
            </div>

            {/* Plantilla table */}
            {players && players.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b">Plantilla</h3>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600 text-xs uppercase tracking-wide rounded-tl-lg">#</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Jugador</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Pos</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Edad</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Altura</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600 text-xs uppercase tracking-wide rounded-tr-lg">Nac.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, i) => (
                      <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="py-2 px-3 text-gray-400 font-mono text-xs">{p.jerseyNumber != null ? `#${p.jerseyNumber}` : "—"}</td>
                        <td className="py-2 px-3 font-semibold text-gray-900">{p.name}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{p.position}</span>
                        </td>
                        <td className="py-2 px-3 text-center text-gray-500">{p.age ?? "—"}</td>
                        <td className="py-2 px-3 text-center text-gray-500">{p.height ?? "—"}</td>
                        <td className="py-2 px-3 text-gray-500">{p.nationality ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Stats table */}
            {Object.keys(playerStatsMap).length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b">Estadísticas de Partido</h3>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {["Jugador", "PTS", "REB", "AST", "ROB", "TAP", "PÉR", "MIN", "VAL", "Part."].map((h, i) => (
                        <th key={h} className={`py-2.5 px-2 font-semibold text-gray-600 text-xs uppercase tracking-wide ${i === 0 ? "text-left pl-3" : "text-center"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(players ?? []).filter((p) => playerStatsMap[p.id]).map((p, i) => {
                      const s = playerStatsMap[p.id];
                      const n = s.count;
                      const avg = (v: number) => (v / n).toFixed(1);
                      return (
                        <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                          <td className="py-2 px-3 pl-3 font-medium text-gray-900">{p.name}</td>
                          <td className="py-2 px-2 text-center font-bold">{avg(s.pts)}</td>
                          <td className="py-2 px-2 text-center text-gray-600">{avg(s.reb)}</td>
                          <td className="py-2 px-2 text-center text-gray-600">{avg(s.ast)}</td>
                          <td className="py-2 px-2 text-center text-gray-600">{avg(s.stl)}</td>
                          <td className="py-2 px-2 text-center text-gray-600">{avg(s.blk)}</td>
                          <td className="py-2 px-2 text-center text-gray-600">{avg(s.to)}</td>
                          <td className="py-2 px-2 text-center text-gray-600">{avg(s.min)}</td>
                          <td className="py-2 px-2 text-center font-bold text-blue-700">{avg(s.val)}</td>
                          <td className="py-2 px-2 text-center text-gray-400 text-xs">{n}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                      <td className="py-2.5 px-3 pl-3 text-gray-600 text-xs uppercase tracking-wide">Total equipo</td>
                      <td className="py-2.5 px-2 text-center">{teamTotals.pts.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center">{teamTotals.reb.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center">{teamTotals.ast.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center">{teamTotals.stl.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center">{teamTotals.blk.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center">{teamTotals.to.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center">{teamTotals.min.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center text-blue-700">{teamTotals.val.toFixed(1)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Systems */}
            {systems.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b">Sistemas Tácticos</h3>
                <div className="space-y-2">
                  {systems.map((s) => (
                    <div key={s.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="font-semibold text-sm text-gray-900">{s.title}</div>
                      {s.description && <p className="text-sm text-gray-500 mt-1">{s.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t pt-3 flex justify-between items-center text-[10px] text-gray-400">
              <span>ScoutPro · Plataforma de Scouting Profesional</span>
              <span>Generado el {new Date().toLocaleDateString("es-ES")}</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Quick stats dialog ── */}
      <Dialog open={!!quickStat} onOpenChange={(open) => { if (!open) setQuickStat(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Añadir estadística — {quickStat?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-4 gap-3">
              {([
                { key: "pts", label: "PTS" },
                { key: "min", label: "MIN" },
                { key: "reb", label: "REB" },
                { key: "ast", label: "AST" },
                { key: "stl", label: "ROB" },
                { key: "blk", label: "TAP" },
                { key: "to", label: "PÉR" },
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block text-center">{label}</label>
                  <Input
                    type="number"
                    min={0}
                    value={qs[key]}
                    onChange={(e) => setQs((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="0"
                    className="text-center px-1"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/70 text-center">Fecha: hoy · Se guarda como informe rápido</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQuickStat(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveQuickStat} disabled={createReport.isPending}>
              {createReport.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
