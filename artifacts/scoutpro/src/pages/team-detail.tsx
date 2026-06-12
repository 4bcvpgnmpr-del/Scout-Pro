import { useState, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetTeam,
  useListPlayers,
  useDeleteTeam,
  useListTeamMedia,
  useCreateTeamMedia,
  useDeleteTeamMedia,
  getListTeamsQueryKey,
  getGetTeamQueryKey,
  getListPlayersQueryKey,
  getListTeamMediaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Trash2, Users, ArrowRight, Download, Loader2, Pencil,
  Plus, Video, BarChart2, Settings2, FileText, X, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExportPdf } from "@/hooks/use-export-pdf";

function embedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
  return null;
}

function VideoCard({ item, onDelete }: { item: { id: number; title?: string | null; url?: string | null }; onDelete: () => void }) {
  const embed = item.url ? embedUrl(item.url) : null;
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {embed ? (
        <div className="aspect-video w-full">
          <iframe src={embed} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
        </div>
      ) : (
        <div className="aspect-video bg-muted flex items-center justify-center">
          <Video className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{item.title || "Vídeo"}</div>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
              <ExternalLink className="h-3 w-3" /> Ver original
            </a>
          )}
        </div>
        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 shrink-0" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SystemCard({ item, onDelete }: { item: { id: number; title?: string | null; description?: string | null; url?: string | null }; onDelete: () => void }) {
  const embed = item.url ? embedUrl(item.url) : null;
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold">{item.title || "Sistema"}</div>
        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 shrink-0 -mt-1" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {item.description && <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>}
      {embed && (
        <div className="aspect-video mt-2 rounded-lg overflow-hidden">
          <iframe src={embed} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
        </div>
      )}
      {!embed && item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> Ver recurso
        </a>
      )}
    </div>
  );
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
  const deleteTeam = useDeleteTeam();
  const createMedia = useCreateTeamMedia();
  const deleteMedia = useDeleteTeamMedia();

  const videos = (allMedia ?? []).filter((m) => m.category === "video");
  const systems = (allMedia ?? []).filter((m) => m.category === "system");

  const invalidateMedia = () => queryClient.invalidateQueries({ queryKey: getListTeamMediaQueryKey(teamId) });

  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [sysTitle, setSysTitle] = useState("");
  const [sysDesc, setSysDesc] = useState("");
  const [sysUrl, setSysUrl] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);
  const [addingSys, setAddingSys] = useState(false);

  const handleAddVideo = () => {
    if (!videoUrl.trim()) return;
    createMedia.mutate(
      { id: teamId, data: { category: "video", title: videoTitle || undefined, url: videoUrl, sourceType: "link" } },
      { onSuccess: () => { setVideoTitle(""); setVideoUrl(""); setAddingVideo(false); invalidateMedia(); } },
    );
  };

  const handleAddSystem = () => {
    if (!sysTitle.trim()) return;
    createMedia.mutate(
      { id: teamId, data: { category: "system", title: sysTitle, description: sysDesc || undefined, url: sysUrl || undefined, sourceType: "link" } },
      { onSuccess: () => { setSysTitle(""); setSysDesc(""); setSysUrl(""); setAddingSys(false); invalidateMedia(); } },
    );
  };

  const handleDeleteMedia = (mediaId: number) => {
    deleteMedia.mutate({ id: teamId, mediaId }, { onSuccess: invalidateMedia });
  };

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
          <TabsTrigger value="videos" className="flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5" /> Vídeos
          </TabsTrigger>
          <TabsTrigger value="estadisticas" className="flex items-center gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" /> Estadísticas
          </TabsTrigger>
          <TabsTrigger value="sistemas" className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" /> Sistemas
          </TabsTrigger>
          <TabsTrigger value="informe" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Informe PDF
          </TabsTrigger>
        </TabsList>

        {/* ── Plantilla ─────────────────────────────────── */}
        <TabsContent value="plantilla" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" /> Plantilla · {players?.length ?? 0} jugadores
              </CardTitle>
              <Link href="/players/new">
                <Button size="sm" className="font-display tracking-wide uppercase text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Añadir
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {!players || players.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay jugadores en este equipo todavía.
                </div>
              ) : (
                <div className="space-y-2">
                  {players.map((player) => (
                    <Link key={player.id} href={`/players/${player.id}`}>
                      <div className="flex items-center gap-4 p-3 rounded-lg border hover:border-primary bg-card cursor-pointer group transition-colors">
                        <Avatar className="h-10 w-10">
                          {player.photoUrl ? (
                            <img src={player.photoUrl} className="h-full w-full object-cover rounded-full" />
                          ) : (
                            <AvatarFallback className="bg-primary/10 text-primary font-display">
                              {player.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-semibold group-hover:text-primary transition-colors">{player.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {player.position}
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

        {/* ── Vídeos ────────────────────────────────────── */}
        <TabsContent value="videos" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Vídeos del equipo · {videos.length}
            </h2>
            <Button size="sm" variant="outline" onClick={() => setAddingVideo((v) => !v)}>
              {addingVideo ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              {addingVideo ? "Cancelar" : "Añadir vídeo"}
            </Button>
          </div>

          {addingVideo && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Input
                  placeholder="Título (opcional)"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                />
                <Input
                  placeholder="URL de YouTube o Vimeo"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <Button size="sm" onClick={handleAddVideo} disabled={!videoUrl.trim() || createMedia.isPending}>
                  {createMedia.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                  Guardar vídeo
                </Button>
              </CardContent>
            </Card>
          )}

          {videos.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Video className="h-10 w-10 mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No hay vídeos todavía. Añade enlaces de YouTube o Vimeo.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.map((v) => (
                <VideoCard key={v.id} item={v} onDelete={() => handleDeleteMedia(v.id)} />
              ))}
            </div>
          )}
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
                            {p.age != null ? `${p.age}` : "—"}
                          </td>
                          <td className="text-center py-2.5 px-3 text-muted-foreground">
                            {p.height ?? "—"}
                          </td>
                          <td className="text-center py-2.5 px-3 text-muted-foreground">
                            {p.weight != null ? `${p.weight} kg` : "—"}
                          </td>
                          <td className="py-2.5 pl-3 text-muted-foreground">
                            {p.nationality ?? "—"}
                          </td>
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
        <TabsContent value="sistemas" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Sistemas del equipo · {systems.length}
            </h2>
            <Button size="sm" variant="outline" onClick={() => setAddingSys((v) => !v)}>
              {addingSys ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              {addingSys ? "Cancelar" : "Añadir sistema"}
            </Button>
          </div>

          {addingSys && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Input
                  placeholder="Nombre del sistema *"
                  value={sysTitle}
                  onChange={(e) => setSysTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Descripción, notas tácticas..."
                  value={sysDesc}
                  onChange={(e) => setSysDesc(e.target.value)}
                  rows={3}
                />
                <Input
                  placeholder="URL de vídeo (opcional)"
                  value={sysUrl}
                  onChange={(e) => setSysUrl(e.target.value)}
                />
                <Button size="sm" onClick={handleAddSystem} disabled={!sysTitle.trim() || createMedia.isPending}>
                  {createMedia.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                  Guardar sistema
                </Button>
              </CardContent>
            </Card>
          )}

          {systems.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Settings2 className="h-10 w-10 mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No hay sistemas tácticos registrados.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {systems.map((s) => (
                <SystemCard key={s.id} item={s} onDelete={() => handleDeleteMedia(s.id)} />
              ))}
            </div>
          )}
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
            {/* Header */}
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

            {/* Summary stats */}
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

            {/* Roster table */}
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

            {/* Systems summary */}
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
