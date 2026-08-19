import { useState, useMemo } from "react";
import { Grid3X3, Layers, Zap, Plus, Trash2, BookOpen, Search, X, Loader2, Edit2, Play as PlayIcon, Save, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { playsApi, Play, PlayCategory, PlayFrame } from "@/lib/plays-api";
import { CourtEditor } from "@/components/scouting/court-editor";
import { useToast } from "@/hooks/use-toast";

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
  ataque: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  defensa: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  especiales: "bg-purple-500/15 text-purple-500 border-purple-500/20",
};

const CAT_LABEL: Record<PlayCategory, string> = {
  ataque: "Ataque",
  defensa: "Defensa",
  especiales: "Especiales",
};

// ── Add/Edit Play Dialog ───────────────────────────────────────────────────────
function PlayDialog({
  play,
  onClose,
  onCreated,
}: {
  play?: Play;
  onClose: () => void;
  onCreated?: (play: Play) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState(play?.title || "");
  const [category, setCategory] = useState<PlayCategory>(play?.category || "ataque");
  const [description, setDescription] = useState(play?.description || "");

  const isEditing = !!play;
  const canSubmit = title.trim().length > 0;

  const mutation = useMutation({
    mutationFn: (data: Partial<Play>) => 
      isEditing ? playsApi.update(play.id, data) : playsApi.create({ ...data, isLibrary: true }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["plays"] });
      toast({ title: isEditing ? "Jugada actualizada" : "Jugada creada" });
      if (!isEditing) onCreated?.(created);
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10 shrink-0">
          <h2 className="font-display text-xl tracking-wide uppercase">{isEditing ? "Editar Detalles" : "Nueva Jugada"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 flex-1">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Nombre de la jugada *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ej. Pick & Roll básico, Defensa 2-3..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60 transition"
              autoFocus
            />
          </div>

          {/* Category */}
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

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Descripción / Instrucciones
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional. Describe cómo se ejecuta, opciones de pase..."
              rows={4}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60 resize-none transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (canSubmit) {
                mutation.mutate({ title: title.trim(), category, description: description.trim() || null });
              }
            }}
            disabled={!canSubmit || mutation.isPending}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition disabled:opacity-40 flex items-center gap-2"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? "Guardar" : "Crear Jugada"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Full Editor Modal ──────────────────────────────────────────────────────────
function FullEditorModal({ play, onClose }: { play: Play; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const updateFramesMutation = useMutation({
    mutationFn: (frames: PlayFrame[]) => playsApi.updateFrames(play.id, frames),
    onSuccess: (updated) => {
      qc.setQueryData(["plays"], (old: Play[] | undefined) => 
        old ? old.map(p => p.id === play.id ? updated : p) : old
      );
      toast({ title: "Diagrama guardado" });
    },
    onError: (e: Error) => toast({ title: "Error al guardar", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CAT_BADGE[play.category]}`}>
            {CAT_LABEL[play.category]}
          </span>
          <h2 className="font-display text-2xl tracking-wide m-0">{play.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
      <div className="flex-1 p-4 lg:p-8 flex items-start justify-center overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto">
          <CourtEditor 
            play={play} 
            onSave={(frames) => updateFramesMutation.mutate(frames)} 
            isSaving={updateFramesMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}


// ── Play Card ─────────────────────────────────────────────────────────────────
function PlayCard({ 
  play, 
  onEdit, 
  onDraw,
  onDuplicate,
  onDelete 
}: { 
  play: Play; 
  onEdit: () => void; 
  onDraw: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors group flex flex-col h-full shadow-sm">
      {/* Preview area - SVG */}
      <div 
        className="aspect-video bg-[#f8f5f0] dark:bg-[#1a1614] shrink-0 border-b border-border/50 relative cursor-pointer group/preview"
        onClick={onDraw}
      >
        <div className="absolute inset-0 pointer-events-none">
          <CourtEditor play={play} readOnly={true} />
        </div>
        <div className="absolute inset-0 bg-background/0 group-hover/preview:bg-background/20 backdrop-blur-[0px] group-hover/preview:backdrop-blur-[1px] transition-all flex items-center justify-center">
          <div className="opacity-0 group-hover/preview:opacity-100 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider px-3 py-1.5 rounded-full transform translate-y-2 group-hover/preview:translate-y-0 transition-all shadow-lg flex items-center gap-1.5">
            <Edit2 className="h-3.5 w-3.5" /> Editar Diagrama
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <span className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border mb-1.5 ${CAT_BADGE[play.category]}`}>
              {CAT_LABEL[play.category]}
            </span>
            <h3 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors cursor-pointer" onClick={onEdit}>
              {play.title}
            </h3>
          </div>
        </div>
        
        {play.description ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1 mb-3">
            {play.description}
          </p>
        ) : (
          <div className="flex-1 mb-3" />
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-auto pt-3 border-t border-border/50 justify-between opacity-50 group-hover:opacity-100 transition-opacity">
          <div className="text-[10px] text-muted-foreground font-mono">
            {play.frames?.length || 1} frame{(play.frames?.length || 1) !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Editar detalles">
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate} title="Duplicar">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => {
              if (confirm(`¿Eliminar la jugada "${play.title}"?`)) onDelete();
            }} title="Eliminar">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
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
    <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl shadow-sm">
      <div className="text-3xl font-display font-bold tabular-nums tracking-tight">{total}</div>
      <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest leading-tight">
        jugadas<br />en total
      </div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex ml-4">
        {total > 0 && cats.map((cat) => {
          const pct = (plays.filter((p) => p.category === cat).length / total) * 100;
          return pct > 0 ? (
            <div key={cat} className={`h-full ${colors[cat]} transition-all`} style={{ width: `${pct}%` }} />
          ) : null;
        })}
      </div>
      <div className="flex items-center gap-4 ml-4 hidden sm:flex">
        {cats.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
            <span className={`h-2 w-2 rounded-full ${colors[cat]}`} />
            <span className="text-muted-foreground">{CAT_LABEL[cat]}</span>
            <span>{plays.filter((p) => p.category === cat).length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Jugadas() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<PlayCategory | "todos">("todos");
  const [search, setSearch] = useState("");
  
  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [editingPlay, setEditingPlay] = useState<Play | null>(null);
  const [drawingPlay, setDrawingPlay] = useState<Play | null>(null);

  const { data: plays = [], isLoading } = useQuery({
    queryKey: ["plays", activeCategory, search],
    queryFn: () => playsApi.list(activeCategory, search),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => playsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plays"] });
      toast({ title: "Jugada eliminada" });
    },
    onError: (e: Error) => toast({ title: "Error al eliminar", description: e.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => playsApi.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plays"] });
      toast({ title: "Jugada duplicada" });
    },
    onError: (e: Error) => toast({ title: "Error al duplicar", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return plays.filter(p => p.isLibrary);
  }, [plays]);

  const countFor = (cat: PlayCategory | "todos") => {
    const libs = plays.filter(p => p.isLibrary);
    return cat === "todos" ? libs.length : libs.filter((p) => p.category === cat).length;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {showAdd && (
        <PlayDialog
          onClose={() => setShowAdd(false)}
          onCreated={(created) => setDrawingPlay(created)}
        />
      )}
      {editingPlay && <PlayDialog play={editingPlay} onClose={() => setEditingPlay(null)} />}
      {drawingPlay && <FullEditorModal play={drawingPlay} onClose={() => setDrawingPlay(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-wide uppercase">Pizarra Táctica</h1>
          <p className="text-muted-foreground text-sm">Biblioteca de sistemas, jugadas y esquemas tácticos dibujados.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="font-display font-bold tracking-wide uppercase shrink-0 shadow-sm h-11 px-6">
          <Plus className="mr-2 h-4 w-4" /> Nueva Jugada
        </Button>
      </div>

      {/* Stats bar */}
      {!isLoading && plays.filter(p => p.isLibrary).length > 0 && <StatsBar plays={plays.filter(p => p.isLibrary)} />}

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-card p-2 rounded-xl border border-border">
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = countFor(cat.id);
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "" : cat.color}`} />
                {cat.label}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${isActive ? "bg-black/20" : "bg-muted-foreground/10"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="pl-9 pr-8 py-2 w-full bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Grid or empty state */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
          <p className="text-sm font-bold uppercase tracking-widest">Cargando pizarra...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/30 flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground/50" />
          </div>
          {plays.length === 0 ? (
            <>
              <h3 className="text-xl font-display font-bold uppercase tracking-wide mb-2">Pizarra en blanco</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Comienza a dibujar tus sistemas, bloqueos y defensas para compartirlos con el cuerpo técnico.
              </p>
              <Button onClick={() => setShowAdd(true)} className="font-bold uppercase tracking-wide px-8">
                <Plus className="h-4 w-4 mr-2" /> Dibujar Primera Jugada
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold mb-1">Sin resultados</h3>
              <p className="text-sm text-muted-foreground">Prueba con otra búsqueda o categoría.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((play) => (
            <PlayCard 
              key={play.id} 
              play={play} 
              onEdit={() => setEditingPlay(play)}
              onDraw={() => setDrawingPlay(play)}
              onDuplicate={() => duplicateMutation.mutate(play.id)}
              onDelete={() => deleteMutation.mutate(play.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
