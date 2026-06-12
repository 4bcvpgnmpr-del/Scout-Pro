import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTeamMedia,
  useCreateTeamMedia,
  useDeleteTeamMedia,
  getListTeamMediaQueryKey,
  type TeamMedia,
  type TeamMediaInput,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Image as ImageIcon, Video, ClipboardList, Sparkles,
  Trash2, Loader2, Upload, Link2,
} from "lucide-react";

export type TeamSection = "roster" | "fotos" | "videos" | "sistemas" | "highlights";

type MediaCategory = TeamMediaInput["category"];

const SECTION_TO_CATEGORY: Record<Exclude<TeamSection, "roster">, MediaCategory> = {
  fotos: "photo",
  videos: "video",
  sistemas: "system",
  highlights: "highlight",
};

export const TEAM_SECTIONS: { key: TeamSection; label: string; icon: React.ElementType }[] = [
  { key: "roster", label: "Plantilla", icon: Users },
  { key: "fotos", label: "Fotos", icon: ImageIcon },
  { key: "videos", label: "Vídeos", icon: Video },
  { key: "sistemas", label: "Sistemas", icon: ClipboardList },
  { key: "highlights", label: "Highlights", icon: Sparkles },
];

const VIDEO_CATS: string[] = ["video", "video_partido", "video_rival", "video_propio"];

const TIPO_OPTIONS = [
  { value: "video_partido", label: "Partido" },
  { value: "video_rival", label: "Scouting Rival" },
  { value: "video_propio", label: "Scouting Propio" },
] as const;

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  video_partido: { label: "Partido", cls: "bg-purple-500/80 text-white" },
  video_rival: { label: "S. Rival", cls: "bg-red-500/80 text-white" },
  video_propio: { label: "S. Propio", cls: "bg-emerald-500/80 text-white" },
  video: { label: "Vídeo", cls: "bg-gray-500/70 text-white" },
};

async function uploadFile(file: File): Promise<string> {
  const metaRes = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!metaRes.ok) throw new Error("request-url");
  const { uploadURL, objectPath } = await metaRes.json();
  const put = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("upload");
  return `/api/storage${objectPath}`;
}

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/embed/")) return url;
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      if (u.pathname.startsWith("/video/")) return url;
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    /* ignore invalid URL */
  }
  return null;
}

function SmartMedia({ url }: { url: string }) {
  const embed = toEmbedUrl(url);
  const [isVideo, setIsVideo] = useState(/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url));
  if (embed) return <iframe src={embed} className="w-full h-full" allowFullScreen title="media" />;
  if (isVideo) return <video src={url} controls className="w-full h-full object-contain bg-black" />;
  return <img src={url} onError={() => setIsVideo(true)} className="w-full h-full object-cover" alt="" />;
}

// ─── Video / Highlight card ──────────────────────────────────────────────────
function VideoCard({ media, onDelete }: { media: TeamMedia; onDelete: () => void }) {
  const embed = media.url && media.sourceType === "link" ? toEmbedUrl(media.url) : null;
  const badge = TIPO_BADGE[media.category];
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className="aspect-video bg-black relative">
        {embed ? (
          <iframe src={embed} className="w-full h-full" allowFullScreen title={media.title ?? "vídeo"} />
        ) : media.sourceType === "upload" && media.url ? (
          <video src={media.url} controls className="w-full h-full" />
        ) : media.url ? (
          <a href={media.url} target="_blank" rel="noreferrer"
            className="w-full h-full flex items-center justify-center text-white text-sm font-semibold gap-2 hover:bg-white/5">
            <Link2 className="h-4 w-4" /> Abrir enlace
          </a>
        ) : null}
        {badge && (
          <div className="absolute top-2 left-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm text-gray-800 truncate">
            {media.title || (media.sourceType === "link" ? "Enlace" : "Vídeo")}
          </span>
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition flex-shrink-0 mt-0.5">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {media.description && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">{media.description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Per-category media section ───────────────────────────────────────────────
export function TeamMediaSection({ teamId, category }: { teamId: number; category: MediaCategory }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: allMedia, isLoading } = useListTeamMedia(teamId, {
    query: { queryKey: getListTeamMediaQueryKey(teamId) },
  });
  const createMedia = useCreateTeamMedia();
  const deleteMedia = useDeleteTeamMedia();

  const isVideoSection = category === "video";
  const items = (allMedia ?? []).filter((m) =>
    isVideoSection ? VIDEO_CATS.includes(m.category) : m.category === category
  );

  const [mode, setMode] = useState<"link" | "upload">("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [videoTipo, setVideoTipo] = useState<string>("video_partido");
  const [sysDesc, setSysDesc] = useState("");
  const [sysFile, setSysFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTeamMediaQueryKey(teamId) });

  const create = (data: TeamMediaInput, onDone?: () => void) =>
    createMedia.mutate({ id: teamId, data }, {
      onSuccess: () => { invalidate(); toast({ title: "Añadido" }); onDone?.(); },
      onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
    });

  const handleDelete = (mediaId: number) => {
    if (!confirm("¿Eliminar este elemento?")) return;
    deleteMedia.mutate({ id: teamId, mediaId }, {
      onSuccess: () => { invalidate(); toast({ title: "Eliminado" }); },
      onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Solo se permiten imágenes", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const path = await uploadFile(file);
      create({ category: "photo", url: path, sourceType: "upload", title: title.trim() || undefined }, () => setTitle(""));
    } catch { toast({ title: "Error al subir foto", variant: "destructive" }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast({ title: "Solo se permiten vídeos", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const path = await uploadFile(file);
      const effectiveCategory = isVideoSection ? (videoTipo as MediaCategory) : category;
      create({
        category: effectiveCategory,
        url: path,
        sourceType: "upload",
        title: title.trim() || undefined,
        description: isVideoSection && notes.trim() ? notes.trim() : undefined,
      }, () => { setTitle(""); setNotes(""); });
    } catch { toast({ title: "Error al subir vídeo", variant: "destructive" }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleAddLink = () => {
    if (!url.trim()) return;
    const effectiveCategory = isVideoSection ? (videoTipo as MediaCategory) : category;
    create({
      category: effectiveCategory,
      url: url.trim(),
      sourceType: "link",
      title: title.trim() || undefined,
      description: isVideoSection && notes.trim() ? notes.trim() : undefined,
    }, () => { setUrl(""); setTitle(""); setNotes(""); });
  };

  const handleAddSystem = async () => {
    if (!title.trim()) return;
    setUploading(true);
    try {
      let mediaUrl: string | undefined;
      let sourceType: TeamMediaInput["sourceType"] = "link";
      if (sysFile) { mediaUrl = await uploadFile(sysFile); sourceType = "upload"; }
      create(
        { category: "system", title: title.trim(), description: sysDesc.trim() || undefined, url: mediaUrl, sourceType },
        () => { setTitle(""); setSysDesc(""); setSysFile(null); if (fileRef.current) fileRef.current.value = ""; },
      );
    } catch { toast({ title: "Error al guardar sistema", variant: "destructive" }); }
    finally { setUploading(false); }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400";
  const btnCls = "bg-orange-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-orange-600 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50";

  return (
    <div className="space-y-6">
      {/* ── Add panel ── */}
      {category === "photo" && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" className={`${inputCls} sm:flex-1`} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className={btnCls}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir foto
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>
      )}

      {(isVideoSection || category === "highlight") && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
          {/* Tipo selector — only for video section */}
          {isVideoSection && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tipo de vídeo</p>
              <div className="flex gap-2 flex-wrap">
                {TIPO_OPTIONS.map(({ value, label }) => (
                  <button key={value} onClick={() => setVideoTipo(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${videoTipo === value ? "bg-orange-100 text-orange-600 ring-1 ring-orange-300" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Link / Upload mode toggle */}
          <div className="flex gap-2">
            <button onClick={() => setMode("link")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${mode === "link" ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              <Link2 className="h-3.5 w-3.5" /> Pegar enlace
            </button>
            <button onClick={() => setMode("upload")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${mode === "upload" ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              <Upload className="h-3.5 w-3.5" /> Subir archivo
            </button>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" className={inputCls} />
          {/* Notes textarea — only for video section */}
          {isVideoSection && (
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas (opcional): contexto, observaciones tácticas, jugadas a destacar…"
              className={`${inputCls} h-20 resize-none`} />
          )}
          {mode === "link" ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=… o vimeo.com/…" className={`${inputCls} sm:flex-1`} />
              <button onClick={handleAddLink} disabled={!url.trim()} className={btnCls}>Añadir</button>
            </div>
          ) : (
            <div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className={btnCls}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Seleccionar vídeo
              </button>
              <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
            </div>
          )}
        </div>
      )}

      {category === "system" && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre del sistema (ej. Pick & Roll lado débil)" className={inputCls} />
          <textarea value={sysDesc} onChange={(e) => setSysDesc(e.target.value)} placeholder="Notas tácticas, instrucciones, contexto…" className={`${inputCls} h-24 resize-none`} />
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" /> {sysFile ? sysFile.name : "Adjuntar imagen/vídeo (opcional)"}
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setSysFile(e.target.files?.[0] ?? null)} />
            <button onClick={handleAddSystem} disabled={!title.trim() || uploading} className={`${btnCls} sm:ml-auto`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Añadir sistema
            </button>
          </div>
        </div>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Sin elementos todavía. Añade el primero arriba.</div>
      ) : category === "photo" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((m) => (
            <div key={m.id} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-100">
              {m.url && <img src={m.url} alt={m.title ?? ""} className="w-full h-full object-cover" />}
              <button onClick={() => handleDelete(m.id)}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition hover:bg-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {m.title && <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs font-semibold px-2 py-1.5 truncate">{m.title}</div>}
            </div>
          ))}
        </div>
      ) : category === "system" ? (
        <div className="space-y-4">
          {items.map((m) => (
            <div key={m.id} className="rounded-xl border border-gray-200 p-5 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-black uppercase italic text-gray-900">{m.title || "Sistema"}</h3>
                <button onClick={() => handleDelete(m.id)} className="text-gray-300 hover:text-red-500 transition flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {m.description && <p className="text-sm text-gray-600 mt-2 leading-relaxed whitespace-pre-wrap">{m.description}</p>}
              {m.url && (
                <div className="mt-3 rounded-lg overflow-hidden border border-gray-100 aspect-video max-w-xl">
                  <SmartMedia url={m.url} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {items.map((m) => <VideoCard key={m.id} media={m} onDelete={() => handleDelete(m.id)} />)}
        </div>
      )}
    </div>
  );
}

// ─── Team scouting surface (tabs) ─────────────────────────────────────────────
export function TeamScoutingView({
  team, section, onSectionChange,
}: {
  team: { id: number; name: string; logoUrl?: string | null; teamType?: string | null };
  section: TeamSection;
  onSectionChange: (s: TeamSection) => void;
}) {
  const category = section === "roster" ? null : SECTION_TO_CATEGORY[section];
  return (
    <main className="flex-1 bg-white overflow-y-auto flex flex-col">
      <div className="border-b border-gray-100 px-8 pt-6 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          {team.logoUrl ? (
            <img src={team.logoUrl} alt={team.name} className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center font-black text-gray-400">
              {team.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-2xl font-black uppercase italic text-gray-900 leading-tight">{team.name}</div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
              {team.teamType === "own" ? "Mi Equipo" : "Equipo Rival"} · Scouting
            </div>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {TEAM_SECTIONS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => onSectionChange(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition whitespace-nowrap ${section === t.key ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-8 py-6 flex-1">
        {category && <TeamMediaSection key={category} teamId={team.id} category={category} />}
      </div>
    </main>
  );
}
