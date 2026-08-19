import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetTeam,
  useDeleteTeam,
  useCreateReport,
  useListTeams,
  getListTeamsQueryKey,
  getGetTeamQueryKey,
  getListPlayersQueryKey,
  getListReportsQueryKey,
  useListPlayers,
  useListReports,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Trash2, Users, BarChart2, ClipboardList,
  Video, Library, Loader2, Pencil, Plus, Camera, Trophy,
} from "lucide-react";
import { TeamReportExportButton } from "@/components/pdf/team-report-pdf";
import { useToast } from "@/hooks/use-toast";
import { TeamMediaSection, PlantillaSection, EstadisticasSection, ClasificacionSection } from "@/components/team-scouting";
import { useMemo } from "react";

export default function TeamDetail() {
  const [, params] = useRoute("/teams/:id");
  const teamId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: team, isLoading } = useGetTeam(teamId, {
    query: { enabled: !!teamId, queryKey: getGetTeamQueryKey(teamId) },
  });
  const { data: players } = useListPlayers(
    { teamId },
    { query: { enabled: !!teamId, queryKey: getListPlayersQueryKey({ teamId }) } },
  );
  const { data: allTeams } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });
  const { data: allReports } = useListReports(undefined, {
    query: { enabled: !!teamId, queryKey: getListReportsQueryKey() },
  });

  const deleteTeam = useDeleteTeam();
  const createReport = useCreateReport();

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

  const handleDeleteTeam = async () => {
    const isOwn = team?.teamType === "own";
    const rivals = isOwn ? (allTeams ?? []).filter((t) => t.teamType !== "own") : [];
    const msg = isOwn && rivals.length > 0
      ? `¿Eliminar ${team?.name} y sus ${rivals.length} equipo(s) rival(es)? Esta acción no se puede deshacer.`
      : `¿Eliminar ${team?.name}? Esta acción no se puede deshacer.`;
    if (!confirm(msg)) return;

    // Cascade: delete all rivals first if removing own team
    if (rivals.length > 0) {
      await Promise.all(rivals.map((r) => fetch(`/api/teams/${r.id}`, { method: "DELETE" })));
    }

    deleteTeam.mutate({ id: teamId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        toast({ title: isOwn && rivals.length > 0 ? `Equipo y ${rivals.length} rival(es) eliminados` : "Equipo eliminado" });
        setLocation("/equipos");
      },
    });
  };

  // Per-player stat averages from reports (for quick-add button in roster)
  const playerStatsMap = useMemo(() => {
    const playerIds = new Set((players ?? []).map((p) => p.id));
    const acc: Record<number, { count: number }> = {};
    (allReports ?? [])
      .filter((r) => playerIds.has(r.playerId))
      .forEach((r) => {
        if (!acc[r.playerId]) acc[r.playerId] = { count: 0 };
        acc[r.playerId].count += 1;
      });
    return acc;
  }, [players, allReports]);

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!team) return <div className="text-muted-foreground py-12 text-center">Equipo no encontrado.</div>;

  const isOwn = team.teamType === "own";
  const initials = team.name.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 w-full">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/equipos">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>

          {/* Logo */}
          <div className={`h-20 w-20 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center border-2 shadow-sm ${
            isOwn ? "border-primary/30 bg-primary/10" : "border-border bg-muted/60"
          }`}>
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
            ) : (
              <span className={`text-2xl font-black ${isOwn ? "text-primary" : "text-muted-foreground"}`}>
                {initials}
              </span>
            )}
          </div>

          <div>
            {isOwn && (
              <div className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5">Mi Equipo</div>
            )}
            <h1 className="text-3xl font-black uppercase italic tracking-tight leading-tight">{team.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {team.league && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{team.league}</span>
              )}
              {team.city && (
                <span className="text-xs text-muted-foreground">{team.city}</span>
              )}
              <span className="text-xs text-muted-foreground/50">
                <Users className="h-3 w-3 inline mr-0.5" />{players?.length ?? 0} jugadores
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <TeamReportExportButton team={team} />
          <Link href={`/teams/${teamId}/edit`}>
            <Button variant="outline" className="font-black tracking-wide uppercase text-xs gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          </Link>
          <Button variant="outline" size="icon" onClick={handleDeleteTeam} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="plantilla">
        <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-transparent border-b border-border rounded-none p-0 pb-px">
          {[
            { value: "plantilla",      label: "Plantilla",    icon: Users },
            { value: "estadisticas",   label: "Estadísticas", icon: BarChart2 },
            { value: "clasificacion",  label: "Clasificación", icon: Trophy },
            { value: "fotos",          label: "Fotos",        icon: Camera },
            { value: "videos",         label: "Vídeos",       icon: Video },
            { value: "sistemas",       label: "Sistemas",     icon: ClipboardList },
            { value: "highlights",     label: "Highlights",   icon: Library },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value}
              className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition">
              <Icon className="h-3.5 w-3.5" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Plantilla ── */}
        <TabsContent value="plantilla" className="mt-6">
          <PlantillaSection teamId={teamId} teamName={team.name} showAddButton />
        </TabsContent>

        {/* ── Estadísticas ── */}
        <TabsContent value="estadisticas" className="mt-6">
          <EstadisticasSection teamId={teamId} />
        </TabsContent>

        {/* ── Clasificación ── */}
        <TabsContent value="clasificacion" className="mt-6">
          <div className="bg-card rounded-2xl p-6 border">
            <ClasificacionSection statTeamExternalId={team.statTeamExternalId} />
          </div>
        </TabsContent>

        {/* ── Fotos ── */}
        <TabsContent value="fotos" className="mt-6">
          <div className="bg-card rounded-2xl p-6 border">
            <TeamMediaSection teamId={teamId} category="photo" />
          </div>
        </TabsContent>

        {/* ── Vídeos ── */}
        <TabsContent value="videos" className="mt-6">
          <div className="bg-card rounded-2xl p-6 border">
            <TeamMediaSection teamId={teamId} category="video" />
          </div>
        </TabsContent>

        {/* ── Sistemas ── */}
        <TabsContent value="sistemas" className="mt-6">
          <div className="bg-card rounded-2xl p-6 border">
            <TeamMediaSection teamId={teamId} category="system" />
          </div>
        </TabsContent>

        {/* ── Highlights ── */}
        <TabsContent value="highlights" className="mt-6">
          <div className="bg-card rounded-2xl p-6 border">
            <TeamMediaSection teamId={teamId} category="highlight" />
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
                { key: "to",  label: "PÉR" },
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block text-center">{label}</label>
                  <Input
                    type="number" min={0}
                    value={qs[key]}
                    onChange={(e) => setQs((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="0" className="text-center px-1"
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
