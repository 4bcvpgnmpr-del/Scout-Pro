import { useState } from "react";
import { Grid3X3, Layers, Zap, Plus, Trash2, Play, BookOpen, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────
type PlayCategory = "ataque" | "defensa" | "especiales";

type Play = {
  id: string;
  title: string;
  category: PlayCategory;
  description: string;
  videoUrl: string;
  createdAt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES: {
  id: PlayCategory | "todos"; label: string; icon: React.ElementType; color: string; activeColor: string;
}[] = [
  { id: "todos", label: "Todas", icon: BookOpen, color: "text-muted-foreground", activeColor: "" },
  { id: "ataque", label: "Ataque", icon: Grid3X3, color: "text-amber-400", activeColor: "text-amber-400" },
  { id: "defensa", label: "Defensa", icon: Layers, color: "text-blue-400", activeColor: "text-blue-400" },
  { id: "especiales", label: "Especiales", icon: Zap, color: "text-purple-400", activeColor: "text-purple-400" },
];

const CAT_BADGE: Record<PlayCategory, string> = {
  ataque: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  defensa: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  especiales: "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

const CAT_LABEL: Record<PlayCategory, string> = {
  ataque: "Ataque",
  defensa: "Defensa",
  especiales: "Especiales",
};

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadPlays(): Play[] {
  try { return JSON.parse(localStorage.getItem("sf-jugadas") ?? "[]"); }
  catch { return []; }
}

function savePlays(plays: Play[]) {
  localStorage.setItem("sf-jugadas", JSON.stringify(plays));
}

// ── Video helpers ─────────────────────────────────────────────────────────────
function getVideoEmbed(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
  const vimMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimMatch) return `https://player.vimeo.com/video/${vimMatch[1]}?autoplay=1`;
  return null;
}

function getYoutubeThumbnail(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
  return null;
}

// ── Add Play Dialog ───────────────────────────────────────────────────────────
function AddPlayDialog({
  onAdd, onClose,
}: {
  onAdd: (p: Omit<Play, "id" | "createdAt">) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PlayCategory>("ataque");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const canSubmit = title.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-black uppercase tracking-tight text-base">Nueva Jugada</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Nombre de la jugada *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ej. Pick & Roll básico, Defensa 2-3, Saque de banda..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60 transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Categoría
            </label>
            <div className="flex gap-2">
              {(["ataque", "defensa", "especiales"] as PlayCategory[]).map((cat) => {
                const meta = CATEGORIES.find((c) => c.id === cat)!;
                const Icon = meta.icon;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition uppercase tracking-wide ${category === cat
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${category === cat ? "" : meta.color}`} />
                    {CAT_LABEL[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Descripción / Instrucciones
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe cómo se ejecuta la jugada, posiciones, opciones de pase, bloqueos..."
              rows={3}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60 resize-none transition"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Enlace de vídeo <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">(YouTube o Vimeo, opcional)</span>
            </label>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60 transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (canSubmit) {
                onAdd({ title: title.trim(), category, description: description.trim(), videoUrl: videoUrl.trim() });
                onClose();
              }
            }}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Añadir Jugada
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Play Card ─────────────────────────────────────────────────────────────────
function PlayCard({ play, onDelete }: { play: Play; onDelete: () => void }) {
  const [showVideo, setShowVideo] = useState(false);
  const embedUrl = getVideoEmbed(play.videoUrl);
  const thumbnail = play.videoUrl ? getYoutubeThumbnail(play.videoUrl) : null;
  const hasVideo = !!play.videoUrl;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 transition group flex flex-col">
      {/* Media area */}
      {hasVideo ? (
        <div className="relative aspect-video bg-black shrink-0">
          {showVideo && embedUrl ? (
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={play.title}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={() => setShowVideo(true)}
            >
              {thumbnail && (
                <img src={thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="" />
              )}
              <div className="relative z-10 h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/60 transition shadow-xl">
                <Play className="h-5 w-5 text-white fill-white ml-0.5" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-muted/40 to-muted/10 flex items-center justify-center shrink-0">
          {play.category === "ataque" && <Grid3X3 className="h-10 w-10 text-amber-400/20" />}
          {play.category === "defensa" && <Layers className="h-10 w-10 text-blue-400/20" />}
          {play.category === "especiales" && <Zap className="h-10 w-10 text-purple-400/20" />}
        </div>
      )}

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <span className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border mb-1.5 ${CAT_BADGE[play.category]}`}>
              {CAT_LABEL[play.category]}
            </span>
            <h3 className="font-bold text-sm leading-tight">{play.title}</h3>
          </div>
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition shrink-0 mt-0.5"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {play.description && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed flex-1">
            {play.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Stats bar (category summary) ──────────────────────────────────────────────
function StatsBar({ plays }: { plays: Play[] }) {
  const cats: PlayCategory[] = ["ataque", "defensa", "especiales"];
  const colors: Record<PlayCategory, string> = {
    ataque: "bg-amber-500", defensa: "bg-blue-500", especiales: "bg-purple-500",
  };
  const total = plays.length;
  return (
    <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl">
      <div className="text-2xl font-black tabular-nums">{total}</div>
      <div className="text-xs text-muted-foreground leading-tight">
        jugadas<br />en total
      </div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex ml-2">
        {total > 0 && cats.map((cat) => {
          const pct = (plays.filter((p) => p.category === cat).length / total) * 100;
          return pct > 0 ? (
            <div key={cat} className={`h-full ${colors[cat]} transition-all`} style={{ width: `${pct}%` }} />
          ) : null;
        })}
      </div>
      <div className="flex items-center gap-3 ml-2">
        {cats.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 text-[10px]">
            <span className={`h-1.5 w-1.5 rounded-full ${colors[cat]}`} />
            <span className="text-muted-foreground">{CAT_LABEL[cat]}</span>
            <span className="font-bold">{plays.filter((p) => p.category === cat).length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Jugadas() {
  const [plays, setPlays] = useState<Play[]>(loadPlays);
  const [activeCategory, setActiveCategory] = useState<PlayCategory | "todos">("todos");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const addPlay = (data: Omit<Play, "id" | "createdAt">) => {
    const newPlay: Play = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const updated = [newPlay, ...plays];
    setPlays(updated);
    savePlays(updated);
  };

  const deletePlay = (id: string) => {
    const updated = plays.filter((p) => p.id !== id);
    setPlays(updated);
    savePlays(updated);
  };

  const filtered = plays.filter((p) => {
    if (activeCategory !== "todos" && p.category !== activeCategory) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
      !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countFor = (cat: PlayCategory | "todos") =>
    cat === "todos" ? plays.length : plays.filter((p) => p.category === cat).length;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {showAdd && <AddPlayDialog onAdd={addPlay} onClose={() => setShowAdd(false)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-4xl font-display tracking-wide">Biblioteca de Jugadas</h1>
          <p className="text-muted-foreground text-sm">Repositorio de sistemas, jugadas y esquemas tácticos del equipo.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="font-display tracking-wide uppercase shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Nueva Jugada
        </Button>
      </div>

      {/* Stats bar — only when there are plays */}
      {plays.length > 0 && <StatsBar plays={plays} />}

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = countFor(cat.id);
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "" : cat.color}`} />
                {cat.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-muted"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugada..."
            className="pl-8 pr-3 py-2 bg-card border border-border rounded-xl text-sm outline-none focus:border-primary/60 transition w-full sm:w-52"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-14 w-14 mb-4 text-muted-foreground/20" />
          {plays.length === 0 ? (
            <>
              <h3 className="text-lg font-semibold mb-2">Sin jugadas aún</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-5">
                Añade jugadas, sistemas y esquemas tácticos para compartirlos con tu cuerpo técnico.
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition"
              >
                <Plus className="h-4 w-4" /> Añadir primera jugada
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold mb-1">Sin resultados</h3>
              <p className="text-sm text-muted-foreground">Prueba con otra búsqueda o categoría diferente.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((play) => (
            <PlayCard key={play.id} play={play} onDelete={() => deletePlay(play.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
