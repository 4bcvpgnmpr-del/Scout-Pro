import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Database,
  Upload,
  Play,
  Eye,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncStatus = "success" | "running" | "error" | "pending";
type LeagueSource = "feb" | "euroleague" | "eurocup" | "acb" | "manual";

interface SyncSource {
  id: LeagueSource;
  name: string;
  url: string;
  schedule: string;
  nextSync: string;
  lastSync: string | null;
  status: SyncStatus;
  leagues: string[];
  recordsLast: number;
  isManual?: boolean;
}

interface SyncLogEntry {
  id: string;
  source: LeagueSource;
  status: SyncStatus;
  recordsProcessed: number;
  durationSeconds: number;
  errorMessage: string | null;
  startedAt: string;
}

interface SyncStats {
  activeSources: number;
  recordsToday: number;
  lastSyncTime: string;
  errorsToday: number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function fetchSyncStatus(): Promise<SyncSource[]> {
  const res = await fetch("/api/admin/sync/status");
  if (!res.ok) throw new Error("Error cargando estado de sincronización");
  return res.json();
}

async function fetchSyncLog(): Promise<SyncLogEntry[]> {
  const res = await fetch("/api/admin/sync/log");
  if (!res.ok) throw new Error("Error cargando logs");
  return res.json();
}

async function fetchSyncStats(): Promise<SyncStats> {
  const res = await fetch("/api/admin/sync/stats");
  if (!res.ok) throw new Error("Error cargando estadísticas");
  return res.json();
}

async function triggerSync(source: string): Promise<void> {
  const res = await fetch(`/api/admin/sync/${source}`, { method: "POST" });
  if (!res.ok) throw new Error(`Error al sincronizar ${source}`);
}

async function triggerSyncAll(): Promise<void> {
  const res = await fetch("/api/admin/sync/all", { method: "POST" });
  if (!res.ok) throw new Error("Error al sincronizar todas las fuentes");
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_SOURCES: SyncSource[] = [
  {
    id: "feb",
    name: "FEB",
    url: "baloncestoenvivo.feb.es",
    schedule: "Cada 6 horas",
    nextSync: "03:00",
    lastSync: "hace 2h",
    status: "success",
    leagues: ["LF Endesa", "LF2", "LF Challenge", "1ª FEB", "2ª FEB", "3ª FEB"],
    recordsLast: 1430,
  },
  {
    id: "euroleague",
    name: "EuroLeague",
    url: "api-live.euroleague.net",
    schedule: "Cada 2 horas",
    nextSync: "23:00",
    lastSync: "hace 30min",
    status: "success",
    leagues: ["EuroLeague", "EuroCup"],
    recordsLast: 412,
  },
  {
    id: "acb",
    name: "ACB",
    url: "acb.com",
    schedule: "Cada 4 horas",
    nextSync: "—",
    lastSync: "hace 45min",
    status: "error",
    leagues: ["Liga Endesa"],
    recordsLast: 0,
  },
  {
    id: "manual",
    name: "Ligas propias",
    url: "Importación CSV",
    schedule: "Manual",
    nextSync: "—",
    lastSync: "hace 3 días",
    status: "pending",
    leagues: ["Liga propia"],
    recordsLast: 48,
    isManual: true,
  },
];

const MOCK_LOG: SyncLogEntry[] = [
  { id: "1", source: "euroleague", status: "success", recordsProcessed: 412,  durationSeconds: 18,  errorMessage: null,                                startedAt: "2024-01-15T21:00:00Z" },
  { id: "2", source: "acb",        status: "error",   recordsProcessed: 0,    durationSeconds: 30,  errorMessage: "Timeout al conectar con acb.com",   startedAt: "2024-01-15T20:15:00Z" },
  { id: "3", source: "feb",        status: "success", recordsProcessed: 1430, durationSeconds: 262, errorMessage: null,                                startedAt: "2024-01-15T18:00:00Z" },
  { id: "4", source: "euroleague", status: "success", recordsProcessed: 409,  durationSeconds: 21,  errorMessage: null,                                startedAt: "2024-01-15T19:00:00Z" },
  { id: "5", source: "feb",        status: "success", recordsProcessed: 1428, durationSeconds: 248, errorMessage: null,                                startedAt: "2024-01-15T12:00:00Z" },
  { id: "6", source: "manual",     status: "success", recordsProcessed: 48,   durationSeconds: 2,   errorMessage: null,                                startedAt: "2024-01-12T10:30:00Z" },
];

const MOCK_STATS: SyncStats = {
  activeSources: 3,
  recordsToday: 1842,
  lastSyncTime: "hace 30 min",
  errorsToday: 1,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SyncStatus }) {
  const config: Record<SyncStatus, { label: string; className: string }> = {
    success: { label: "Activo",  className: "bg-green-900/40 text-green-400 border border-green-800/50" },
    running: { label: "Syncing", className: "bg-yellow-900/40 text-yellow-400 border border-yellow-800/50" },
    error:   { label: "Error",   className: "bg-red-900/40 text-red-400 border border-red-800/50" },
    pending: { label: "Manual",  className: "bg-indigo-900/40 text-indigo-400 border border-indigo-800/50" },
  };
  const c = config[status];
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${c.className}`}>
      {c.label}
    </span>
  );
}

function StatusDot({ status }: { status: SyncStatus }) {
  const colors: Record<SyncStatus, string> = {
    success: "bg-green-400",
    running: "bg-yellow-400 animate-pulse",
    error:   "bg-red-400",
    pending: "bg-zinc-500",
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[status]} mr-1.5`} />;
}

function MetricCard({ label, value, sub, valueColor = "text-white" }: {
  label: string; value: string; sub: string; valueColor?: string;
}) {
  return (
    <div className="bg-zinc-800/60 rounded-lg px-4 py-3 border border-zinc-700/40">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-medium ${valueColor}`}>{value}</p>
      <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>
    </div>
  );
}

function SourceCard({
  source,
  onSync,
  isSyncing,
}: {
  source: SyncSource;
  onSync: (id: LeagueSource) => void;
  isSyncing: boolean;
}) {
  const [showError, setShowError] = useState(false);

  return (
    <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/40 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-300 text-sm font-medium">
          {source.isManual ? (
            <Upload size={14} className="text-zinc-500" />
          ) : (
            <Database size={14} className="text-zinc-500" />
          )}
          {source.name}
        </div>
        <StatusBadge status={source.status} />
      </div>

      <div>
        <p className="text-[11px] text-zinc-500">{source.url}</p>
        <p className="text-[11px] text-zinc-600">{source.schedule}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {source.leagues.map((l) => (
          <span key={l} className="text-[10px] px-2 py-0.5 bg-zinc-700/60 text-zinc-400 rounded">
            {l}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-600">
        <span>
          {source.recordsLast > 0 ? `${source.recordsLast.toLocaleString()} registros` : "Sin datos"}
        </span>
        <span>
          {source.status !== "error" ? `Próxima: ${source.nextSync}` : source.lastSync}
        </span>
      </div>

      {source.status === "error" && showError && (
        <div className="text-[11px] text-red-400 bg-red-900/20 rounded px-2 py-1.5 border border-red-800/30">
          Timeout al conectar con {source.url}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {source.isManual ? (
          <label className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-zinc-600/50 text-zinc-400 cursor-pointer hover:bg-zinc-700/40 transition-colors">
            <Upload size={12} />
            Subir CSV
            <input type="file" accept=".csv" className="hidden" />
          </label>
        ) : (
          <button
            onClick={() => onSync(source.id)}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border transition-colors ${
              source.status === "error"
                ? "bg-red-600 border-red-600 text-white hover:bg-red-700"
                : "border-zinc-600/50 text-zinc-400 hover:bg-zinc-700/40"
            }`}
          >
            {isSyncing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : source.status === "error" ? (
              <RefreshCw size={12} />
            ) : (
              <Play size={12} />
            )}
            {source.status === "error" ? "Reintentar" : "Ejecutar ahora"}
          </button>
        )}
        {source.status === "error" && (
          <button
            onClick={() => setShowError((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-zinc-600/50 text-zinc-400 hover:bg-zinc-700/40 transition-colors"
          >
            <Eye size={12} />
            {showError ? "Ocultar" : "Ver error"}
          </button>
        )}
      </div>
    </div>
  );
}

const SOURCE_LABELS: Record<LeagueSource, string> = {
  feb:        "FEB",
  euroleague: "EuroLeague",
  eurocup:    "EuroCup",
  acb:        "ACB",
  manual:     "CSV",
};

function formatDuration(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SyncPage() {
  const queryClient = useQueryClient();
  const [syncingSource, setSyncingSource] = useState<LeagueSource | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "ok" | "err" } | null>(null);

  const showToast = (message: string, type: "ok" | "err") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const useMock = true;

  const { data: sources = MOCK_SOURCES } = useQuery({
    queryKey: ["sync-status"],
    queryFn: fetchSyncStatus,
    refetchInterval: 30_000,
    enabled: !useMock,
  });

  const { data: log = MOCK_LOG } = useQuery({
    queryKey: ["sync-log"],
    queryFn: fetchSyncLog,
    refetchInterval: 15_000,
    enabled: !useMock,
  });

  const { data: stats = MOCK_STATS } = useQuery({
    queryKey: ["sync-stats"],
    queryFn: fetchSyncStats,
    refetchInterval: 30_000,
    enabled: !useMock,
  });

  const syncMutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: (_, source) => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["sync-log"] });
      showToast(`Sincronización de ${SOURCE_LABELS[source as LeagueSource]} iniciada`, "ok");
    },
    onError: (_, source) => {
      showToast(`Error al sincronizar ${SOURCE_LABELS[source as LeagueSource]}`, "err");
    },
    onSettled: () => setSyncingSource(null),
  });

  const syncAllMutation = useMutation({
    mutationFn: triggerSyncAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["sync-log"] });
      showToast("Sincronización completa iniciada", "ok");
    },
    onError: () => showToast("Error al sincronizar todo", "err"),
    onSettled: () => setIsSyncingAll(false),
  });

  const handleSync = (source: LeagueSource) => {
    setSyncingSource(source);
    syncMutation.mutate(source);
  };

  const handleSyncAll = () => {
    setIsSyncingAll(true);
    syncAllMutation.mutate();
  };

  return (
    <div className="min-h-full bg-[#111] text-zinc-200 p-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === "ok"
            ? "bg-green-900/90 text-green-300 border border-green-700/50"
            : "bg-red-900/90 text-red-300 border border-red-700/50"
        }`}>
          {toast.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-white tracking-tight mb-1">Sincronización</h1>
          <p className="text-sm text-zinc-500">Estado de las fuentes de datos automáticas</p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={isSyncingAll}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isSyncingAll ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sincronizar todo
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Fuentes activas"  value={String(stats.activeSources)} sub="FEB · EuroLeague · CSV" />
        <MetricCard label="Registros hoy"    value={stats.recordsToday.toLocaleString()} sub="jugadores + clasificaciones" />
        <MetricCard label="Última sync"      value={stats.lastSyncTime} sub="EuroLeague" />
        <MetricCard
          label="Errores hoy"
          value={String(stats.errorsToday)}
          sub="ACB · timeout"
          valueColor={stats.errorsToday > 0 ? "text-red-400" : "text-white"}
        />
      </div>

      {/* Source cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            onSync={handleSync}
            isSyncing={syncingSource === source.id}
          />
        ))}
      </div>

      {/* Log table */}
      <div className="bg-zinc-800/60 rounded-xl border border-zinc-700/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/40">
          <h2 className="text-sm font-medium text-zinc-300">Log de sincronizaciones recientes</h2>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["sync-log"] })}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-zinc-600/50 text-zinc-500 hover:bg-zinc-700/40 transition-colors"
          >
            <RefreshCw size={11} />
            Actualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700/40 text-zinc-500">
                <th className="text-left py-2 px-4 font-medium">Estado</th>
                <th className="text-left py-2 px-4 font-medium">Fuente</th>
                <th className="text-right py-2 px-4 font-medium">Registros</th>
                <th className="text-right py-2 px-4 font-medium">Duración</th>
                <th className="text-right py-2 px-4 font-medium">Hora</th>
                <th className="py-2 px-4 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-zinc-700/20 last:border-0 hover:bg-zinc-700/20 transition-colors"
                >
                  <td className="py-2.5 px-4">
                    <span className="flex items-center gap-1">
                      <StatusDot status={entry.status} />
                      <span className={
                        entry.status === "success" ? "text-green-400"
                        : entry.status === "error"  ? "text-red-400"
                        : entry.status === "running"? "text-yellow-400"
                        : "text-zinc-500"
                      }>
                        {entry.status === "success" ? "OK"
                          : entry.status === "error"  ? "Error"
                          : entry.status === "running"? "Syncing"
                          : "—"}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-zinc-300">{SOURCE_LABELS[entry.source]}</td>
                  <td className="py-2.5 px-4 text-right text-zinc-400">
                    {entry.recordsProcessed > 0 ? entry.recordsProcessed.toLocaleString() : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-right text-zinc-500">{formatDuration(entry.durationSeconds)}</td>
                  <td className="py-2.5 px-4 text-right text-zinc-500">{formatTime(entry.startedAt)}</td>
                  <td className="py-2.5 px-4">
                    {entry.status === "error" && <ChevronRight size={12} className="text-zinc-600" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
