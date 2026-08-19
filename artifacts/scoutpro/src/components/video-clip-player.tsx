import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { playsApi, type Play } from "@/lib/plays-api";
import { Edit2, Film, Pause, Play as PlayIcon, Plus, Trash2, X } from "lucide-react";

export interface VideoMediaRecord {
  id: number;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  sourceType: string;
  category: string;
}

export interface VideoClipRecord {
  id: number;
  mediaId: number;
  startTime: string | number;
  endTime: string | number;
  title: string;
  description: string | null;
  category: string;
  playerId: number | null;
  playId: string | null;
  reportId: string | null;
  playerName: string | null;
  playTitle: string | null;
}

const CLIP_CATEGORIES = [
  ["pick_roll", "Pick & Roll"],
  ["transition", "Transición"],
  ["defense", "Defensa"],
  ["closeout", "Closeout"],
  ["shot", "Tiro"],
  ["turnover", "Pérdida"],
  ["other", "Otro"],
] as const;

const CATEGORY_STYLES: Record<string, string> = {
  pick_roll: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  transition: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  defense: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  closeout: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  shot: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  turnover: "bg-red-500/15 text-red-600 border-red-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function embedUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch { /* invalid URLs are rendered as a regular link */ }
  return null;
}

function normalizeClip(clip: VideoClipRecord): VideoClipRecord {
  return { ...clip, startTime: Number(clip.startTime), endTime: Number(clip.endTime) };
}

export function VideoClipPlayer({ media }: { media: VideoMediaRecord }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VideoClipRecord | null>(null);
  const [form, setForm] = useState({
    startTime: "0",
    endTime: "15",
    title: "",
    category: "other",
    playerId: "",
    playId: "",
    description: "",
  });

  const nativeVideo = media.sourceType === "upload" && !!media.url;
  const embedded = embedUrl(media.url);
  const clipsQuery = useQuery({
    queryKey: ["video-clips", media.id],
    queryFn: async () => {
      const response = await fetch(`/api/media/${media.id}/clips`, { credentials: "include" });
      if (!response.ok) throw new Error("No se pudieron cargar los clips");
      return (await response.json() as VideoClipRecord[]).map(normalizeClip);
    },
  });
  const { data: players = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["video-clip-players"],
    queryFn: async () => {
      const response = await fetch("/api/players", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: showForm,
  });
  const { data: plays = [] } = useQuery<Play[]>({
    queryKey: ["video-clip-plays"],
    queryFn: () => playsApi.list("todos", ""),
    enabled: showForm,
  });

  const clips = clipsQuery.data ?? [];
  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const url = editing
        ? `/api/media/${media.id}/clips/${editing.id}`
        : `/api/media/${media.id}/clips`;
      const response = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar el clip");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-clips", media.id] });
      setShowForm(false);
      setEditing(null);
      toast({ title: editing ? "Clip actualizado" : "Clip creado" });
    },
    onError: (error: Error) => toast({ title: "Error al guardar el clip", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (clipId: number) => {
      const response = await fetch(`/api/media/${media.id}/clips/${clipId}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("No se pudo eliminar el clip");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-clips", media.id] });
      toast({ title: "Clip eliminado" });
    },
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoaded = () => setDuration(video.duration || 0);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoaded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [media.url]);

  const setAtCurrent = () => {
    const start = videoRef.current?.currentTime ?? currentTime;
    setForm((value) => ({ ...value, startTime: String(Math.round(start)), endTime: String(Math.round(Math.max(start + 15, start + 1))) }));
  };
  const jumpTo = (clip: VideoClipRecord) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Number(clip.startTime);
    void videoRef.current.play();
    const stopAt = () => {
      if (videoRef.current && videoRef.current.currentTime >= Number(clip.endTime)) {
        videoRef.current.pause();
        videoRef.current.removeEventListener("timeupdate", stopAt);
      }
    };
    videoRef.current.addEventListener("timeupdate", stopAt);
  };
  const openEdit = (clip: VideoClipRecord) => {
    setEditing(clip);
    setForm({
      startTime: String(Number(clip.startTime)),
      endTime: String(Number(clip.endTime)),
      title: clip.title,
      category: clip.category,
      playerId: clip.playerId ? String(clip.playerId) : "",
      playId: clip.playId ?? "",
      description: clip.description ?? "",
    });
    setShowForm(true);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    mutation.mutate({
      startTime: Number(form.startTime),
      endTime: Number(form.endTime),
      title: form.title,
      category: form.category,
      description: form.description || null,
      playerId: form.playerId ? Number(form.playerId) : null,
      playId: form.playId || null,
    });
  };
  const markerWidth = duration > 0 ? (clip: VideoClipRecord) => `${Math.max(1, (Number(clip.endTime) - Number(clip.startTime)) / duration * 100)}%` : "1%";

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="aspect-video bg-black relative">
        {nativeVideo ? (
          <video ref={videoRef} src={media.url ?? undefined} className="w-full h-full" controls preload="metadata" />
        ) : embedded ? (
          <iframe src={embedded} className="w-full h-full" title={media.title ?? "Vídeo"} allowFullScreen />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Vídeo no disponible</div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{media.title ?? "Vídeo sin título"}</h3>
            <p className="text-xs text-muted-foreground">{clips.length} clip{clips.length === 1 ? "" : "s"}</p>
          </div>
          {nativeVideo && (
            <Button size="sm" variant="outline" onClick={() => { setEditing(null); setAtCurrent(); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Añadir clip
            </Button>
          )}
        </div>
        {nativeVideo && duration > 0 && (
          <div className="space-y-1">
            <div className="relative h-5 rounded bg-muted cursor-pointer" onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              if (videoRef.current) videoRef.current.currentTime = ((event.clientX - rect.left) / rect.width) * duration;
            }}>
              <div className="absolute inset-y-0 left-0 bg-primary/20 rounded" style={{ width: `${currentTime / duration * 100}%` }} />
              {clips.map((clip) => (
                <button key={clip.id} type="button" title={clip.title} onClick={(event) => { event.stopPropagation(); jumpTo(clip); }}
                  className={`absolute inset-y-0 rounded border ${CATEGORY_STYLES[clip.category] ?? CATEGORY_STYLES.other}`}
                  style={{ left: `${Number(clip.startTime) / duration * 100}%`, width: markerWidth(clip) }} />
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span>
            </div>
          </div>
        )}
        {showForm && (
          <form onSubmit={submit} className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{editing ? "Editar clip" : "Nuevo clip"}</h4>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">Inicio (segundos)<Input type="number" min="0" step="0.1" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label>
              <label className="text-xs text-muted-foreground">Fin (segundos)<Input type="number" min="0" step="0.1" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label>
            </div>
            <Input required placeholder="Título del clip" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm">
                {CLIP_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">Sin jugador</option>
                {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
              </select>
              <select value={form.playId} onChange={(e) => setForm({ ...form, playId: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">Sin jugada</option>
                {plays.map((play) => <option key={play.id} value={play.id}>{play.title}</option>)}
              </select>
            </div>
            <Textarea placeholder="Notas opcionales" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Button type="submit" disabled={mutation.isPending} className="w-full">{mutation.isPending ? "Guardando…" : "Guardar clip"}</Button>
          </form>
        )}
        {clips.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {clips.map((clip) => (
              <div key={clip.id} className="flex items-center gap-2 rounded-lg border p-2">
                <button type="button" onClick={() => jumpTo(clip)} className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0" title="Reproducir clip">
                  <PlayIcon className="h-3.5 w-3.5 ml-0.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{clip.title}</span>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${CATEGORY_STYLES[clip.category] ?? CATEGORY_STYLES.other}`}>
                      {CLIP_CATEGORIES.find(([value]) => value === clip.category)?.[1] ?? clip.category}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatTime(Number(clip.startTime))} – {formatTime(Number(clip.endTime))}
                    {clip.playerName ? ` · ${clip.playerName}` : ""}
                    {clip.playTitle ? ` · ${clip.playTitle}` : ""}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(clip)}><Edit2 className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(clip.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
        {!nativeVideo && clips.length > 0 && <p className="text-[11px] text-muted-foreground">Los clips de enlaces externos se pueden consultar, pero el salto exacto depende del reproductor externo.</p>}
      </div>
    </div>
  );
}