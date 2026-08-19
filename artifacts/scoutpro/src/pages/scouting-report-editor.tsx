import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  Zap,
  Users,
  FileText,
} from "lucide-react";
import {
  scoutingReportsApi,
  SECTION_TYPE_LABELS,
  LIVE_DATA_TYPES,
  type ScoutingReportFull,
  type ReportSectionDto,
} from "@/lib/scouting-reports-api";
import { useToast } from "@/hooks/use-toast";
import {
  TeamOverviewBlock,
  MatchStatsBlock,
  PlayerStatsBlock,
  TrendsBlock,
  TeamVsLeagueBlock,
  InsightsBlock,
  ShotChartBlock,
  CoachAnalysis,
} from "@/components/scouting/stat-blocks";

interface PlayerRow {
  id: number;
  name: string;
  position: string | null;
  jerseyNumber: number | null;
  teamId: number | null;
}

const ADDABLE_SECTIONS: Array<{ type: string; title: string }> = [
  { type: "trends", title: "Tendencias" },
  { type: "team_vs_league", title: "Equipo vs Liga" },
  { type: "insights", title: "Insights Automáticos" },
  { type: "shot_chart", title: "Carta de Tiro" },
  { type: "tactical", title: "Análisis Táctico" },
  { type: "plays", title: "Jugadas" },
  { type: "videos", title: "Vídeos" },
  { type: "game_plan", title: "Game Plan" },
  { type: "custom", title: "Sección Personalizada" },
];

function LiveBadge() {
  return (
    <Badge className="bg-green-500/15 text-green-500 border-0 gap-1 text-[10px]">
      <Zap className="h-3 w-3" /> LIVE DATA
    </Badge>
  );
}

function SectionPreview({ section, report }: { section: ReportSectionDto; report: ScoutingReportFull; players: PlayerRow[] }) {
  switch (section.type) {
    case "team_overview":
      return <TeamOverviewBlock report={report} />;
    case "match_stats":
      return <MatchStatsBlock report={report} />;
    case "player_stats":
      return <PlayerStatsBlock report={report} />;
    case "trends":
      return <TrendsBlock report={report} />;
    case "team_vs_league":
      return <TeamVsLeagueBlock report={report} />;
    case "insights":
      return <InsightsBlock report={report} section={section} />;
    case "shot_chart":
      return <ShotChartBlock report={report} />;
    default:
      return (
        <p className="text-sm text-muted-foreground italic">
          {section.coachNote || "Sección vacía — añade una nota del entrenador en el panel derecho."}
        </p>
      );
  }
}

export default function ScoutingReportEditor() {
  const [, params] = useRoute("/scouting/reports/:id");
  const id = params?.id ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: report, isLoading } = useQuery({
    queryKey: ["scouting-report", id],
    queryFn: () => scoutingReportsApi.get(id),
    enabled: !!id,
  });

  const { data: players } = useQuery<PlayerRow[]>({
    queryKey: ["players-for-editor"],
    queryFn: () => fetch("/api/players", { credentials: "include" }).then((r) => r.json()),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saving" | "saved">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (report) setTitle(report.title);
  }, [report?.id, report?.title]);

  const sections = useMemo(
    () => (report?.sections ?? []).slice().sort((a, b) => a.position - b.position),
    [report?.sections],
  );
  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["scouting-report", id] });
    qc.invalidateQueries({ queryKey: ["scouting-reports"] });
  };

  const markSaved = () => {
    setSaveState("saved");
    setSavedAt(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
  };

  const updateReport = useMutation({
    mutationFn: (data: Record<string, unknown>) => scoutingReportsApi.update(id, data),
    onMutate: () => setSaveState("saving"),
    onSuccess: (updated) => {
      markSaved();
      qc.setQueryData<ScoutingReportFull>(["scouting-report", id], (prev) =>
        prev ? { ...prev, ...updated } : prev,
      );
      qc.invalidateQueries({ queryKey: ["scouting-reports"] });
    },
    onError: (e: Error) => { setSaveState("idle"); toast({ title: "Error al guardar", description: e.message, variant: "destructive" }); },
  });

  const updateSection = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: Partial<ReportSectionDto> }) =>
      scoutingReportsApi.updateSection(id, sectionId, data),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => { markSaved(); invalidate(); },
    onError: (e: Error) => { setSaveState("idle"); toast({ title: "Error al guardar", description: e.message, variant: "destructive" }); },
  });

  const addSection = useMutation({
    mutationFn: (s: { type: string; title: string }) => scoutingReportsApi.createSection(id, s),
    onSuccess: (created) => { invalidate(); setSelectedId(created.id); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeSection = useMutation({
    mutationFn: (sectionId: string) => scoutingReportsApi.removeSection(id, sectionId),
    onSuccess: () => { invalidate(); setSelectedId(null); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addBlock = useMutation({
    mutationFn: ({ sectionId }: { sectionId: string }) =>
      scoutingReportsApi.createBlock(id, sectionId, { blockType: "text", content: { text: "" } }),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => { markSaved(); invalidate(); },
    onError: (e: Error) => { setSaveState("idle"); toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const updateBlock = useMutation({
    mutationFn: ({ sectionId, blockId, text }: { sectionId: string; blockId: string; text: string }) =>
      scoutingReportsApi.updateBlock(id, sectionId, blockId, { content: { text } }),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => { markSaved(); invalidate(); },
    onError: (e: Error) => { setSaveState("idle"); toast({ title: "Error al guardar", description: e.message, variant: "destructive" }); },
  });

  const removeBlock = useMutation({
    mutationFn: ({ sectionId, blockId }: { sectionId: string; blockId: string }) =>
      scoutingReportsApi.removeBlock(id, sectionId, blockId),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refreshData = useMutation({
    mutationFn: () => scoutingReportsApi.refreshData(id),
    onSuccess: () => { invalidate(); toast({ title: "Datos actualizados" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Debounced title autosave (flushes pending edit on unmount)
  const pendingTitle = useRef<string | null>(null);
  const onTitleChange = (v: string) => {
    setTitle(v);
    setSaveState("pending");
    pendingTitle.current = v;
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      pendingTitle.current = null;
      updateReport.mutate({ title: v });
    }, 1500);
  };
  useEffect(
    () => () => {
      if (titleTimer.current) clearTimeout(titleTimer.current);
      if (pendingTitle.current != null) {
        // Flush unsaved title edit so navigation doesn't lose it
        scoutingReportsApi.update(id, { title: pendingTitle.current }).catch(() => {});
      }
    },
    [id],
  );

  const reorderMutation = useMutation({
    mutationFn: (sectionIds: string[]) => scoutingReportsApi.reorderSections(id, sectionIds),
    onMutate: () => setSaveState("saving"),
    onSuccess: (full) => {
      markSaved();
      qc.setQueryData(["scouting-report", id], full);
      qc.invalidateQueries({ queryKey: ["scouting-reports"] });
    },
    onError: (e: Error) => { setSaveState("idle"); toast({ title: "Error al reordenar", description: e.message, variant: "destructive" }); },
  });

  const move = (section: ReportSectionDto, dir: -1 | 1) => {
    const idx = sections.findIndex((s) => s.id === section.id);
    const target = idx + dir;
    if (target < 0 || target >= sections.length || reorderMutation.isPending) return;
    const ids = sections.map((s) => s.id);
    [ids[idx], ids[target]] = [ids[target]!, ids[idx]!];
    reorderMutation.mutate(ids);
  };

  if (isLoading || !report) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/2 rounded-xl" />
        <div className="grid grid-cols-12 gap-4">
          <Skeleton className="col-span-3 h-96 rounded-xl" />
          <Skeleton className="col-span-6 h-96 rounded-xl" />
          <Skeleton className="col-span-3 h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex-1 min-w-0">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="text-2xl font-display h-12 bg-transparent border-transparent hover:border-border focus:border-border px-2 -ml-2"
            data-testid="input-report-title"
          />
          <p className="text-xs text-muted-foreground px-0.5">
            {report.team?.name ?? "—"} vs {report.opponent?.name ?? "—"}
            {report.game ? ` · ${report.game.date}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground" data-testid="text-save-status">
            {saveState === "saving" || saveState === "pending"
              ? "Guardando…"
              : savedAt
                ? `Guardado · ${savedAt}`
                : ""}
          </span>
          <Button variant="outline" size="sm" onClick={() => refreshData.mutate()} disabled={refreshData.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshData.isPending ? "animate-spin" : ""}`} />
            Actualizar datos
          </Button>
          <select
            value={report.status}
            onChange={(e) => updateReport.mutate({ status: e.target.value })}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            data-testid="select-report-status"
          >
            <option value="draft">Borrador</option>
            <option value="in_progress">En progreso</option>
            <option value="finalized">Finalizado</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        {/* Sections sidebar */}
        <div className="col-span-12 md:col-span-3 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Secciones</h3>
          {sections.map((s, i) => (
            <div
              key={s.id}
              className={`rounded-lg border p-2.5 cursor-pointer transition flex items-center gap-2 ${
                selectedId === s.id ? "border-primary bg-primary/5" : "border-border bg-card"
              } ${!s.isVisible ? "opacity-50" : ""}`}
              onClick={() => setSelectedId(s.id)}
              data-testid={`section-item-${s.id}`}
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium flex-1 truncate">{s.title}</span>
              <div className="flex flex-col">
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === 0}
                  onClick={(e) => { e.stopPropagation(); move(s, -1); }}
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === sections.length - 1}
                  onClick={(e) => { e.stopPropagation(); move(s, 1); }}
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          <div className="pt-2 space-y-1">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Añadir sección</h4>
            {ADDABLE_SECTIONS.map((s) => (
              <button
                key={s.type}
                onClick={() => addSection.mutate(s)}
                className="w-full text-left text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 px-1 py-1 transition"
                data-testid={`button-add-section-${s.type}`}
              >
                <Plus className="h-3 w-3" /> {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="col-span-12 md:col-span-6 space-y-4">
          {sections.filter((s) => s.isVisible).map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`rounded-xl border bg-card p-5 cursor-pointer transition ${
                selectedId === s.id ? "border-primary" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg">{s.title}</h3>
                {LIVE_DATA_TYPES.has(s.type) && <LiveBadge />}
              </div>
              <SectionPreview section={s} report={report} players={players ?? []} />
              {LIVE_DATA_TYPES.has(s.type) && <CoachAnalysis reportId={id} section={s} />}
              {/* Blocks */}
              {s.blocks.filter((b) => b.blockType === "text").length > 0 && (
                <div className="mt-4 space-y-2">
                  {s.blocks.filter((b) => b.blockType === "text").map((b) => (
                    <div key={b.id} className="group/block relative rounded-lg border border-border/60 bg-background/40 p-2">
                      <Textarea
                        key={`${b.id}-${b.updatedAt}`}
                        defaultValue={typeof b.content?.["text"] === "string" ? (b.content["text"] as string) : ""}
                        rows={2}
                        placeholder="Escribe una nota…"
                        className="border-0 bg-transparent resize-none focus-visible:ring-0 text-sm min-h-0"
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          const prev = typeof b.content?.["text"] === "string" ? b.content["text"] : "";
                          if (e.target.value !== prev) {
                            updateBlock.mutate({ sectionId: s.id, blockId: b.id, text: e.target.value });
                          }
                        }}
                        data-testid={`textarea-block-${b.id}`}
                      />
                      <button
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover/block:opacity-100 text-muted-foreground hover:text-destructive transition"
                        onClick={(e) => { e.stopPropagation(); removeBlock.mutate({ sectionId: s.id, blockId: b.id }); }}
                        data-testid={`button-delete-block-${b.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                className="mt-3 text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition"
                onClick={(e) => { e.stopPropagation(); addBlock.mutate({ sectionId: s.id }); }}
                data-testid={`button-add-block-${s.id}`}
              >
                <Plus className="h-3 w-3" /> Añadir bloque de texto
              </button>
            </div>
          ))}
          {sections.filter((s) => s.isVisible).length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No hay secciones visibles.
            </div>
          )}
        </div>

        {/* Properties panel */}
        <div className="col-span-12 md:col-span-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">Propiedades</h3>
          {!selected ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
              <Users className="h-5 w-5 mx-auto mb-2 opacity-40" />
              Selecciona una sección para editarla.
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Título</label>
                <Input
                  key={selected.id}
                  defaultValue={selected.title}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== selected.title) {
                      updateSection.mutate({ sectionId: selected.id, data: { title: e.target.value.trim() } });
                    }
                  }}
                  data-testid="input-section-title"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Tipo: {SECTION_TYPE_LABELS[selected.type] ?? selected.type}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nota del entrenador</label>
                <Textarea
                  key={`note-${selected.id}`}
                  defaultValue={selected.coachNote ?? ""}
                  rows={5}
                  placeholder="Observaciones tácticas, avisos, claves del partido…"
                  onBlur={(e) => {
                    const v = e.target.value.trim() || null;
                    if (v !== (selected.coachNote ?? null)) {
                      updateSection.mutate({ sectionId: selected.id, data: { coachNote: v } });
                    }
                  }}
                  data-testid="textarea-coach-note"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-1.5">
                  {selected.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} Visible
                </span>
                <Switch
                  checked={selected.isVisible}
                  onCheckedChange={(v) => updateSection.mutate({ sectionId: selected.id, data: { isVisible: v } })}
                  data-testid="switch-section-visible"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm(`¿Eliminar la sección "${selected.title}"?`)) removeSection.mutate(selected.id);
                }}
                data-testid="button-delete-section"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar sección
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
