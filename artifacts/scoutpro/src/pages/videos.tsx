import { useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, Film, Layers, Sparkles, ArrowRight, Plus } from "lucide-react";
import { useListTeams, useListTeamMedia, getListTeamsQueryKey } from "@workspace/api-client-react";

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch { }
  return null;
}

function TeamVideos({ teamId, teamName, logoUrl }: { teamId: number; teamName: string; logoUrl?: string | null }) {
  const { data: media, isLoading } = useListTeamMedia(teamId);
  const videos = useMemo(() => (media ?? []).filter((m) => m.category === "video" || m.category === "highlight"), [media]);

  if (!isLoading && videos.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={teamName} className="h-6 w-6 rounded object-cover" />
          ) : (
            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-[10px] font-display text-muted-foreground">
              {teamName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold">{teamName}</span>
          <span className="text-xs text-muted-foreground">· {videos.length} vídeo{videos.length !== 1 ? "s" : ""}</span>
        </div>
        <Link href={`/teams/${teamId}`}>
          <Button size="sm" variant="ghost" className="text-xs text-primary h-7">
            Ver todos <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-video rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {videos.slice(0, 4).map((v) => {
            const embed = v.url ? toEmbedUrl(v.url) : null;
            return (
              <div key={v.id} className="rounded-lg overflow-hidden border bg-card aspect-video relative group">
                {embed ? (
                  <iframe src={embed} className="w-full h-full" title={v.title ?? "vídeo"} />
                ) : v.sourceType === "upload" && v.url ? (
                  <video src={v.url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Video className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
                {v.title && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-xs text-white font-medium truncate">
                    {v.title}
                  </div>
                )}
                {v.category === "highlight" && (
                  <div className="absolute top-1.5 left-1.5">
                    <span className="text-[10px] font-bold bg-amber-400/90 text-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Sparkles className="h-2.5 w-2.5" /> HL
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Videos() {
  const { data: teams, isLoading: teamsLoading } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-4xl font-display tracking-wide">Vídeos</h1>
          <p className="text-muted-foreground text-sm">Biblioteca de vídeo · Organizada por equipo</p>
        </div>
        <Link href="/equipos">
          <Button className="font-display tracking-wide uppercase">
            <Plus className="mr-2 h-4 w-4" /> Gestionar por equipo
          </Button>
        </Link>
      </div>

      {/* Category legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Film, label: "Vídeos de partido", desc: "Grabaciones y análisis tácticos" },
          { icon: Layers, label: "Sistemas", desc: "Jugadas y sistemas del equipo" },
          { icon: Sparkles, label: "Highlights", desc: "Mejores jugadas por jugador" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Videos by team */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Vídeos por Equipo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {teamsLoading ? (
            <div className="space-y-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-5 w-40 rounded" />
                  <div className="grid grid-cols-4 gap-3">
                    {[...Array(4)].map((_, j) => <Skeleton key={j} className="aspect-video rounded-lg" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : !teams || teams.length === 0 ? (
            <div className="py-12 text-center">
              <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground mb-4">No hay equipos todavía</p>
              <Link href="/teams/new">
                <Button variant="outline" size="sm">Crear primer equipo</Button>
              </Link>
            </div>
          ) : (
            <>
              {teams.map((t) => (
                <TeamVideos key={t.id} teamId={t.id} teamName={t.name} logoUrl={t.logoUrl} />
              ))}
              <div className="pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground mb-3">
                  Para subir vídeos, accede al equipo correspondiente y ve a la pestaña de Vídeos o Highlights.
                </p>
                <Link href="/equipos">
                  <Button variant="outline" size="sm" className="font-display uppercase tracking-wide text-xs">
                    Ir a Equipos <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
