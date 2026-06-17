import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTeamMedia,
  useCreateTeamMedia,
  useDeleteTeamMedia,
  useUpdateTeam,
  useListPlayers,
  useGetPlayerStats,
  getListTeamMediaQueryKey,
  getListTeamsQueryKey,
  getListPlayersQueryKey,
  getGetPlayerStatsQueryKey,
  type TeamMedia,
  type TeamMediaInput,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Video, ClipboardList, Library,
  Trash2, Loader2, Upload, Link2,
  Pencil, Check, Plus, Camera,
  BarChart2, Activity, Search,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type TeamSection = "roster" | "videos" | "sistemas" | "playbook" | "estadisticas";

type MediaCategory = TeamMediaInput["category"];

const SECTION_TO_CATEGORY: Partial<Record<TeamSection, MediaCategory>> = {
  videos: "video",
  sistemas: "system",
};

export const TEAM_SECTIONS: { key: TeamSection; label: string; icon: React.ElementType }[] = [
  { key: "roster",       label: "Plantilla",    icon: Users },
  { key: "estadisticas", label: "Estadísticas", icon: BarChart2 },
  { key: "videos",       label: "Vídeos",       icon: Video },
  { key: "sistemas",     label: "Sistemas",     icon: ClipboardList },
  { key: "playbook",     label: "Playbook",     icon: Library },
];

const POS_ORDER = ["PG", "SG", "SF", "PF", "C"];

// ── Constants for video types ─────────────────────────────────────────────────
const TIPO_OPTIONS = [
  { value: "video_partido",  label: "Partido" },
  { value: "video_rival",    label: "Scouting Rival" },
  { value: "video_propio",   label: "Scouting Propio" },
] as const;

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  video_partido: { label: "Partido",   cls: "bg-purple-500/80 text-white" },
  video_rival:   { label: "S. Rival",  cls: "bg-red-500/80 text-white" },
  video_propio:  { label: "S. Propio", cls: "bg-emerald-500/80 text-white" },
  video:         { label: "Vídeo",     cls: "bg-gray-500/70 text-white" },
};

const VIDEO_CATS = ["video", "video_partido", "video_rival", "video_propio"];

// ── Upload helper ─────────────────────────────────────────────────────────────
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

// ── Embed URL ─────────────────────────────────────────────────────────────────
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
  } catch { /* ignore */ }
  return null;
}

function SmartMedia({ url }: { url: string }) {
  const embed = toEmbedUrl(url);
  const [isVideo, setIsVideo] = useState(/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url));
  if (embed) return <iframe src={embed} className="w-full h-full" allowFullScreen title="media" />;
  if (isVideo) return <video src={url} controls className="w-full h-full object-contain bg-black" />;
  return <img src={url} onError={() => setIsVideo(true)} className="w-full h-full object-cover" alt="" />;
}

// ── Video card ────────────────────────────────────────────────────────────────
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

// ── Media section (Videos / Sistemas) ────────────────────────────────────────
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
  const photoFileRef = useRef<HTMLInputElement>(null);

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
    finally { setUploading(false); if (photoFileRef.current) photoFileRef.current.value = ""; }
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
        category: effectiveCategory, url: path, sourceType: "upload",
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
      category: effectiveCategory, url: url.trim(), sourceType: "link",
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
      {/* Photo add panel */}
      {category === "photo" && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" className={`${inputCls} sm:flex-1`} />
          <button onClick={() => photoFileRef.current?.click()} disabled={uploading} className={btnCls}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir foto
          </button>
          <input ref={photoFileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>
      )}

      {/* Videos add panel */}
      {(isVideoSection || category === "highlight") && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
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
          {isVideoSection && (
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas tácticas, contexto, jugadas a destacar…"
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

      {/* Sistemas add panel */}
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

      {/* List */}
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

// ── Playbook section (per-team, syncs same format as Centro de Partido) ────────
function PlaybookSection({ teamId, teamName }: { teamId: number; teamName: string }) {
  const [plays, setPlays] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`sf-team-playbook-${teamId}`) ?? "[]"); } catch { return []; }
  });
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`sf-team-playbook-${teamId}`) ?? "[]");
      setPlays(saved);
    } catch { /* ignore */ }
  }, [teamId]);

  const save = (next: string[]) => {
    setPlays(next);
    localStorage.setItem(`sf-team-playbook-${teamId}`, JSON.stringify(next));
  };

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    save([...plays, v]);
    setDraft("");
  };

  const remove = (i: number) => save(plays.filter((_, j) => j !== i));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Library className="h-5 w-5 text-orange-500" /> Playbook
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Jugadas y sistemas de {teamName}</p>
        </div>
      </div>

      {/* Add play */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Añadir jugada o sistema (ej. P&R lado débil, zona 2-3, último segundo...)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
          />
          <button
            onClick={add}
            disabled={!draft.trim()}
            className="bg-orange-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-orange-600 transition text-sm disabled:opacity-50 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </div>
      </div>

      {/* Plays list */}
      {plays.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Sin jugadas añadidas. Escribe la primera arriba.
        </div>
      ) : (
        <div className="space-y-2">
          {plays.map((play, i) => (
            <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm group">
              <span className="text-[10px] font-black text-orange-500 bg-orange-50 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <span className="flex-1 text-sm text-gray-800 leading-snug">{play}</span>
              <button
                onClick={() => remove(i)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PlayerStatsRowLight (one hook per player, light-mode table row) ───────────
function PlayerStatsRowLight({ player }: {
  player: { id: number; name: string; position?: string | null; jerseyNumber?: number | null; photoUrl?: string | null };
}) {
  const { data: stats } = useGetPlayerStats(player.id, { query: { queryKey: getGetPlayerStatsQueryKey(player.id) } });
  const initials = player.name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const fmt = (v: number | string | null | undefined, dec = 1) => { const n = Number(v); return v != null && !isNaN(n) ? n.toFixed(dec) : "—"; };
  const fmtPct = (v: number | string | null | undefined) => { const n = Number(v); return v != null && !isNaN(n) ? `${(n * 100).toFixed(0)}%` : "—"; };
  return (
    <tr className="border-b border-gray-100 hover:bg-orange-50/40 transition">
      <td className="py-2.5 pl-0 pr-2 text-sm text-gray-400 font-mono text-center w-8">{player.jerseyNumber ?? "—"}</td>
      <td className="py-2.5 px-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
            {player.photoUrl
              ? <img src={player.photoUrl} alt={player.name} className="h-full w-full object-cover" />
              : <span className="text-[10px] font-black text-orange-500">{initials}</span>}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm leading-tight">{player.name}</p>
            <p className="text-[10px] text-gray-400">{player.position ?? ""}</p>
          </div>
        </div>
      </td>
      {stats ? (
        <>
          <td className="py-2.5 px-1.5 text-sm font-black text-orange-500 text-center">{fmt(stats.avgPoints)}</td>
          <td className="py-2.5 px-1.5 text-sm text-gray-500 text-center">{fmt(stats.avgRebounds)}</td>
          <td className="py-2.5 px-1.5 text-sm text-gray-500 text-center">{fmt(stats.avgAssists)}</td>
          <td className="py-2.5 px-1.5 text-sm text-gray-500 text-center">{fmt(stats.avgSteals)}</td>
          <td className="py-2.5 px-1.5 text-sm text-gray-400 text-center">{fmt(stats.avgBlocks)}</td>
          <td className="py-2.5 px-1.5 text-sm text-gray-400 text-center">{fmt(stats.avgMinutes, 0)}'</td>
          <td className="py-2.5 px-1.5 text-sm text-gray-400 text-center">{fmtPct(stats.avgFieldGoalPct)}</td>
          <td className="py-2.5 px-1.5 text-sm text-gray-400 text-center">{fmtPct(stats.avgThreePointPct)}</td>
          <td className="py-2.5 pr-0 text-sm text-gray-400 text-center">{fmtPct(stats.avgFreeThrowPct)}</td>
        </>
      ) : (
        <td colSpan={9} className="py-2.5 px-2 text-xs text-gray-300 italic">Sin estadísticas</td>
      )}
    </tr>
  );
}

// ── Plantilla section (synced with Centro de Partido) ─────────────────────────
export function PlantillaSection({ teamId, teamName }: { teamId: number; teamName: string }) {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("Todos");

  const { data: players, isLoading } = useListPlayers(
    { teamId },
    { query: { queryKey: getListPlayersQueryKey({ teamId }) } },
  );

  const filtered = useMemo(() => {
    let list = players ?? [];
    if (posFilter !== "Todos") list = list.filter(p => p.position === posFilter);
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99));
  }, [players, posFilter, search]);

  const statsHeaders = ["Pts", "Reb", "Ast", "Rob", "Tap", "Min", "%TC", "%3P", "%TL"];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["Todos", ...POS_ORDER].map(p => (
            <button key={p} onClick={() => setPosFilter(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${posFilter === p ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {(players ?? []).length === 0 ? `No hay jugadores en ${teamName}.` : "Sin resultados."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[10px] text-gray-400 uppercase tracking-widest font-black py-2 pr-2 pl-0 w-8">#</th>
                <th className="text-left text-[10px] text-gray-400 uppercase tracking-widest font-black py-2 px-2">Jugador</th>
                {statsHeaders.map(h => (
                  <th key={h} className="text-center text-[10px] text-gray-300 uppercase tracking-widest font-black py-2 px-1.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => <PlayerStatsRowLight key={p.id} player={p} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Estadísticas section (V/D/Pos + player stats table, synced with DB) ───────
export function EstadisticasSection({ teamId }: { teamId: number }) {
  const [editMode, setEditMode] = useState(false);
  const [wins, setWins] = useState("");
  const [losses, setLosses] = useState("");
  const [pos, setPos] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sf-team-stats-${teamId}`);
      if (raw) {
        const p = JSON.parse(raw) as { wins?: string; losses?: string; pos?: string };
        setWins(p.wins ?? ""); setLosses(p.losses ?? ""); setPos(p.pos ?? "");
      } else { setWins(""); setLosses(""); setPos(""); }
    } catch { /* ignore */ }
    setEditMode(false);
  }, [teamId]);

  const save = () => {
    localStorage.setItem(`sf-team-stats-${teamId}`, JSON.stringify({ wins, losses, pos }));
    setEditMode(false);
  };

  const { data: players, isLoading } = useListPlayers(
    { teamId },
    { query: { queryKey: getListPlayersQueryKey({ teamId }) } },
  );

  const statsHeaders = ["Pts", "Reb", "Ast", "Rob", "Tap", "Min", "%TC", "%3P", "%TL"];

  return (
    <div className="space-y-6">
      {/* Record V/D/Pos */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Clasificación de Temporada</span>
          {!editMode ? (
            <button onClick={() => setEditMode(true)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-orange-500 transition px-1.5 py-0.5 rounded">
              <Pencil className="h-2.5 w-2.5" /> Editar
            </button>
          ) : (
            <button onClick={save}
              className="flex items-center gap-1 text-[10px] text-orange-600 px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200">
              <Check className="h-2.5 w-2.5" /> Guardar
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Victorias", val: wins,   set: setWins,   cls: "text-green-600" },
            { label: "Derrotas",  val: losses,  set: setLosses, cls: "text-red-500"   },
            { label: "Posición",  val: pos,     set: setPos,    cls: "text-amber-600" },
          ].map(({ label, val, set, cls }) => (
            <div key={label} className="text-center">
              <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">{label}</div>
              {editMode ? (
                <input value={val} onChange={e => set(e.target.value)} placeholder="—"
                  className={`w-full text-center text-xl font-black bg-white border border-gray-200 rounded-lg py-1 outline-none focus:border-orange-400 ${cls}`} />
              ) : (
                <div className={`text-2xl font-black ${cls}`}>{val || "—"}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Player stats table */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Activity className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estadísticas Medias por Jugador</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
        ) : !players || players.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No hay jugadores registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[10px] text-gray-400 uppercase tracking-widest font-black py-2 pr-2 pl-0 w-8">#</th>
                  <th className="text-left text-[10px] text-gray-400 uppercase tracking-widest font-black py-2 px-2">Jugador</th>
                  {statsHeaders.map(h => (
                    <th key={h} className="text-center text-[10px] text-gray-300 uppercase tracking-widest font-black py-2 px-1.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map(p => <PlayerStatsRowLight key={p.id} player={p} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Logo upload in the header ─────────────────────────────────────────────────
function TeamLogoHeader({ team }: { team: { id: number; name: string; logoUrl?: string | null; teamType?: string | null } }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateTeam = useUpdateTeam();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const initials = team.name.substring(0, 2).toUpperCase();
  const isOwn = team.teamType === "own";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadFile(file);
      updateTeam.mutate({ id: team.id, data: { logoUrl: path } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          toast({ title: "Escudo actualizado" });
        },
        onError: () => toast({ title: "Error al subir escudo", variant: "destructive" }),
      });
    } catch { toast({ title: "Error al subir", variant: "destructive" }); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  return (
    <div
      className="relative h-20 w-20 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer group/logo border-2 border-gray-100"
      onClick={() => fileInputRef.current?.click()}>
      {team.logoUrl ? (
        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full flex items-center justify-center text-xl font-black ${isOwn ? "bg-blue-100 text-blue-500" : "bg-red-100 text-red-500"}`}>
          {initials}
        </div>
      )}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition rounded-2xl">
        {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}


// ── TeamScoutingView (main surface) ───────────────────────────────────────────
export function TeamScoutingView({
  team, section, onSectionChange,
}: {
  team: { id: number; name: string; logoUrl?: string | null; teamType?: string | null };
  section: TeamSection;
  onSectionChange: (s: TeamSection) => void;
}) {
  const category = SECTION_TO_CATEGORY[section] ?? null;

  return (
    <main className="flex-1 bg-white overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-100 px-8 pt-6 flex-shrink-0">
        <div className="flex items-start gap-5 mb-4">
          <TeamLogoHeader team={team} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
              {team.teamType === "own" ? "Mi Equipo" : "Equipo Rival"}
            </div>
            <div className="text-3xl font-black uppercase italic text-gray-900 leading-tight">{team.name}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {TEAM_SECTIONS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => onSectionChange(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition whitespace-nowrap ${section === t.key
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 flex-1">
        {section === "roster" && (
          <PlantillaSection teamId={team.id} teamName={team.name} />
        )}
        {section === "estadisticas" && (
          <EstadisticasSection teamId={team.id} />
        )}
        {section === "playbook" && (
          <PlaybookSection teamId={team.id} teamName={team.name} />
        )}
        {category && (
          <TeamMediaSection key={category} teamId={team.id} category={category} />
        )}
      </div>
    </main>
  );
}
