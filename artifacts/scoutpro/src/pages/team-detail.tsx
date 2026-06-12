import { useMemo, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetTeam,
  useListPlayers,
  useDeleteTeam,
  useListTeamMedia,
  getListTeamsQueryKey,
  getGetTeamQueryKey,
  getListPlayersQueryKey,
  getListTeamMediaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Trash2, Users, ArrowRight, Download, Loader2, Pencil,
  Image as ImageIcon, Video, BarChart2, ClipboardList, Sparkles, FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExportPdf } from "@/hooks/use-export-pdf";
import { TeamMediaSection } from "@/components/team-scouting";

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

  const deleteTeam = useDeleteTeam();
  const [sortBy, setSortBy] = useState<"name" | "jersey" | "position">("name");

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

      {/* Tabs */}
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
          <TabsTrigger value="highlights" className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Highlights
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
                            <img src={player.photoUrl} className="h-full w-full object-cover" />
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

        {/* ── Estadísticas ──────────────────────────────── */}
        <TabsContent value="estadisticas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart2 className="h-4 w-4 text-primary" /> Estadísticas de la plantilla
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!players || players.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No hay jugadores en este equipo.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                        <th className="text-left py-2 pr-4 font-medium">Jugador</th>
                        <th className="text-center py-2 px-3 font-medium">Pos</th>
                        <th className="text-center py-2 px-3 font-medium">#</th>
                        <th className="text-center py-2 px-3 font-medium">Edad</th>
                        <th className="text-center py-2 px-3 font-medium">Altura</th>
                        <th className="text-center py-2 px-3 font-medium">Peso</th>
                        <th className="text-left py-2 pl-3 font-medium">Nac.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-4">
                            <Link href={`/players/${p.id}`}>
                              <span className="font-medium hover:text-primary transition-colors cursor-pointer">{p.name}</span>
                            </Link>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{p.position}</span>
                          </td>
                          <td className="text-center py-2.5 px-3 text-muted-foreground">
                            {p.jerseyNumber != null ? `#${p.jerseyNumber}` : "—"}
                          </td>
                          <td className="text-center py-2.5 px-3 text-muted-foreground">
                            {p.age != null ? String(p.age) : "—"}
                          </td>
                          <td className="text-center py-2.5 px-3 text-muted-foreground">{p.height ?? "—"}</td>
                          <td className="text-center py-2.5 px-3 text-muted-foreground">
                            {p.weight != null ? `${p.weight} kg` : "—"}
                          </td>
                          <td className="py-2.5 pl-3 text-muted-foreground">{p.nationality ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

        {/* ── Highlights ────────────────────────────────── */}
        <TabsContent value="highlights" className="mt-4">
          <div className="bg-white rounded-xl p-5 border">
            <TeamMediaSection teamId={teamId} category="highlight" />
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

          <div ref={contentRef} className="space-y-5 p-6 bg-card rounded-xl border">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h2 className="text-3xl font-display uppercase italic">{team.name}</h2>
                <div className="flex items-center gap-3 mt-1 text-muted-foreground text-sm">
                  {team.league && <span>{team.league}</span>}
                  {team.city && <span>· {team.city}</span>}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div className="font-semibold text-sm">Informe de Equipo</div>
                <div>{new Date().toLocaleDateString("es-ES")}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-2xl font-display">{players?.length ?? 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">Jugadores</div>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-2xl font-display">{videos.length}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">Vídeos</div>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-2xl font-display">{systems.length}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">Sistemas</div>
              </div>
            </div>

            {players && players.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Plantilla</h3>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground uppercase">
                      <th className="text-left py-2 pr-3 font-medium">Jugador</th>
                      <th className="text-center py-2 px-2 font-medium">Pos</th>
                      <th className="text-center py-2 px-2 font-medium">#</th>
                      <th className="text-center py-2 px-2 font-medium">Edad</th>
                      <th className="text-left py-2 pl-2 font-medium">Nac.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{p.name}</td>
                        <td className="text-center py-2 px-2 text-muted-foreground font-mono text-xs">{p.position}</td>
                        <td className="text-center py-2 px-2 text-muted-foreground">{p.jerseyNumber != null ? `#${p.jerseyNumber}` : "—"}</td>
                        <td className="text-center py-2 px-2 text-muted-foreground">{p.age ?? "—"}</td>
                        <td className="py-2 pl-2 text-muted-foreground">{p.nationality ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {systems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sistemas Tácticos</h3>
                <div className="space-y-3">
                  {systems.map((s) => (
                    <div key={s.id} className="border rounded-lg p-3">
                      <div className="font-semibold text-sm">{s.title}</div>
                      {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
