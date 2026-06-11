import { useState, useRef } from "react";
import { Link } from "wouter";
import {
  useListTeams,
  useListPlayers,
  useListReports,
  useCreateTeam,
  useCreatePlayer,
  useDeletePlayer,
  useUpdatePlayer,
  getListTeamsQueryKey,
  getListPlayersQueryKey,
  getListReportsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy, Plus, Search, Trash2, ClipboardList, X, ChevronRight,
  Camera, Loader2, Star, Users, Swords, UserSearch, GitCompare,
  TrendingUp, TrendingDown, Minus, Download,
} from "lucide-react";
import { useExportPdf } from "@/hooks/use-export-pdf";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const POSITION_LABELS: Record<string, string> = {
  PG: "Bases", SG: "Escoltas", SF: "Aleros", PF: "Ala-Pívots", C: "Pívots",
};

type SidebarView =
  | { kind: "all" }
  | { kind: "own"; teamId?: number }
  | { kind: "rival"; teamId?: number }
  | { kind: "watchlist" };

// ─── Player Avatar ─────────────────────────────────────────────────────────────
function PlayerAvatar({
  playerId, name, photoUrl, size = "md", editable = false,
}: {
  playerId: number; name: string; photoUrl?: string | null;
  size?: "sm" | "md" | "lg"; editable?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updatePlayer = useUpdatePlayer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  const sizeClass = { sm: "h-10 w-10 text-sm", md: "h-14 w-14 text-lg", lg: "h-20 w-20 text-2xl" }[size];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Solo se permiten imágenes", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!metaRes.ok) throw new Error();
      const { uploadURL, objectPath } = await metaRes.json();
      const uploadRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadRes.ok) throw new Error();
      await new Promise<void>((resolve, reject) => {
        updatePlayer.mutate({ id: playerId, data: { photoUrl: `/api/storage${objectPath}` } }, {
          onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() }); toast({ title: "Foto actualizada" }); resolve(); },
          onError: reject,
        });
      });
    } catch { toast({ title: "Error al subir foto", variant: "destructive" }); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  return (
    <div className={`relative flex-shrink-0 ${sizeClass} rounded-full overflow-hidden`}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-orange-100 flex items-center justify-center">
          <span className="font-black text-orange-500">{initials}</span>
        </div>
      )}
      {editable && (
        <>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition flex items-center justify-center rounded-full">
            {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </>
      )}
    </div>
  );
}

// ─── Add Team Modal ────────────────────────────────────────────────────────────
function AddTeamModal({ defaultType, onClose }: { defaultType: "own" | "rival"; onClose: () => void }) {
  const [name, setName] = useState("");
  const [league, setLeague] = useState("");
  const [type, setType] = useState<"own" | "rival">(defaultType);
  const createTeam = useCreateTeam();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const save = () => {
    if (!name.trim()) return;
    createTeam.mutate({ data: { name: name.trim(), league: league.trim() || undefined, teamType: type } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() }); toast({ title: "Equipo añadido" }); onClose(); },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Equipo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-2 mb-4">
          {(["own", "rival"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
                type === t ? (t === "own" ? "bg-blue-500 text-white" : "bg-red-500 text-white") : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {t === "own" ? <><Users className="h-4 w-4" /> Mi Equipo</> : <><Swords className="h-4 w-4" /> Rival</>}
            </button>
          ))}
        </div>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del equipo"
          className="w-full mb-4 p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900"
          onKeyDown={(e) => e.key === "Enter" && save()} />
        <input type="text" value={league} onChange={(e) => setLeague(e.target.value)} placeholder="Liga (ej. ACB, EuroLeague)"
          className="w-full mb-6 p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900"
          onKeyDown={(e) => e.key === "Enter" && save()} />
        <div className="flex gap-3">
          <button onClick={save} disabled={createTeam.isPending}
            className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition disabled:opacity-60">
            {createTeam.isPending ? "Guardando..." : "Añadir Equipo"}
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Player Modal ──────────────────────────────────────────────────────────
function AddPlayerModal({ teamId, forWatchlist, onClose }: { teamId?: number; forWatchlist?: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [pos, setPos] = useState("PG");
  const createPlayer = useCreatePlayer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const save = () => {
    if (!name.trim()) return;
    createPlayer.mutate({
      data: { name: name.trim().toUpperCase(), position: pos, teamId: teamId ?? null, jerseyNumber: num ? parseInt(num) : null, watchlisted: forWatchlist ?? false },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Jugador añadido" });
        onClose();
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nuevo Jugador</h2>
            {forWatchlist && <p className="text-sm text-amber-600 font-medium mt-0.5 flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> A fichar</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo"
          className="w-full mb-3 p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900" />
        <input type="text" value={num} onChange={(e) => setNum(e.target.value)} placeholder="Número de dorsal"
          className="w-full mb-3 p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900" />
        <div className="flex gap-2 mb-6">
          {POSITIONS.map((p) => (
            <button key={p} onClick={() => setPos(p)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${pos === p ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{p}</button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={createPlayer.isPending}
            className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition disabled:opacity-60">
            {createPlayer.isPending ? "Guardando..." : "Guardar"}
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Player Picker Modal ───────────────────────────────────────────────────────
function PlayerPickerModal({ excludeId, onSelect, onClose }: {
  excludeId: number; onSelect: (id: number) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const { data: allPlayers } = useListPlayers(undefined, { query: { queryKey: getListPlayersQueryKey() } });

  const filtered = (allPlayers ?? []).filter(
    (p) => p.id !== excludeId && p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Seleccionar jugador</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar jugador..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-orange-500" />
          </div>
        </div>
        <div className="overflow-y-auto max-h-80">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">Sin jugadores</p>
          ) : filtered.map((p) => (
            <button key={p.id} onClick={() => onSelect(p.id)}
              className="w-full flex items-center gap-3 px-6 py-3 hover:bg-orange-50 transition text-left">
              <PlayerAvatar playerId={p.id} name={p.name} photoUrl={p.photoUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{p.name}</div>
                <div className="text-xs text-gray-400">{p.position}{p.teamName ? ` · ${p.teamName}` : ""}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Comparison View ───────────────────────────────────────────────────────────
type PlayerData = {
  id: number; name: string; position: string;
  teamName?: string | null; photoUrl?: string | null; watchlisted?: boolean | null;
};

function CompareBar({ labelA, labelB, valA, valB, max = 10 }: {
  labelA: string; labelB: string; valA: number | null | undefined; valB: number | null | undefined; max?: number;
}) {
  if (valA == null && valB == null) return null;
  const a = valA ?? 0;
  const b = valB ?? 0;
  const winner = a > b ? "a" : b > a ? "b" : "tie";

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
      {/* Left bar */}
      <div className="flex items-center gap-2 justify-end">
        <span className={`text-sm font-black ${winner === "a" ? "text-orange-500" : "text-gray-400"}`}>{valA ?? "–"}</span>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
          <div className={`h-full rounded-full transition-all ${winner === "a" ? "bg-orange-500" : "bg-gray-300"}`}
            style={{ width: `${(a / max) * 100}%`, marginLeft: "auto" }} />
        </div>
      </div>
      {/* Label */}
      <div className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-20">{labelA}</div>
      {/* Right bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
          <div className={`h-full rounded-full transition-all ${winner === "b" ? "bg-blue-500" : "bg-gray-300"}`}
            style={{ width: `${(b / max) * 100}%` }} />
        </div>
        <span className={`text-sm font-black ${winner === "b" ? "text-blue-500" : "text-gray-400"}`}>{valB ?? "–"}</span>
      </div>
    </div>
  );
}

function ComparisonView({ playerA, playerB, onClose }: {
  playerA: PlayerData; playerB: PlayerData; onClose: () => void;
}) {
  const { contentRef, exportPdf, exporting } = useExportPdf(`comparativa-${playerA.name}-vs-${playerB.name}`);
  const { data: reportsA } = useListReports({ playerId: playerA.id }, { query: { queryKey: getListReportsQueryKey({ playerId: playerA.id }) } });
  const { data: reportsB } = useListReports({ playerId: playerB.id }, { query: { queryKey: getListReportsQueryKey({ playerId: playerB.id }) } });

  const reportA = reportsA?.[0];
  const reportB = reportsB?.[0];

  const ratingDiff = (reportA?.rating ?? 0) - (reportB?.rating ?? 0);
  const ratingWinner = ratingDiff > 0 ? "a" : ratingDiff < 0 ? "b" : "tie";

  const statRows: [string, number | null | undefined, number | null | undefined, number][] = [
    ["PTS", reportA?.points, reportB?.points, 40],
    ["REB", reportA?.rebounds, reportB?.rebounds, 20],
    ["AST", reportA?.assists, reportB?.assists, 15],
    ["ROB", reportA?.steals, reportB?.steals, 10],
    ["TAP", reportA?.blocks, reportB?.blocks, 10],
    ["MIN", reportA?.minutesPlayed, reportB?.minutesPlayed, 40],
  ];

  const ratingRows: [string, number | null | undefined, number | null | undefined][] = [
    ["Ataque", reportA?.offensiveRating, reportB?.offensiveRating],
    ["Defensa", reportA?.defensiveRating, reportB?.defensiveRating],
    ["Atletismo", reportA?.athleticismRating, reportB?.athleticismRating],
    ["IQ", reportA?.iQRating, reportB?.iQRating],
  ];

  const hasStats = statRows.some(([, a, b]) => a != null || b != null);
  const hasRatings = ratingRows.some(([, a, b]) => a != null || b != null);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2 text-orange-500 font-black text-sm uppercase tracking-widest">
          <GitCompare className="h-4 w-4" /> Comparativa
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportPdf} disabled={exporting}
            className="text-xs text-gray-500 hover:text-orange-600 flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-lg hover:bg-orange-50 transition disabled:opacity-50">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? "Exportando..." : "Exportar PDF"}
          </button>
          <button onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">
            <X className="h-3.5 w-3.5" /> Cerrar
          </button>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto">
        {/* Player headers — side by side */}
        <div className="grid grid-cols-2 border-b border-gray-100">
          {[{ player: playerA, report: reportA, color: "orange" }, { player: playerB, report: reportB, color: "blue" }].map(({ player, report, color }, idx) => (
            <div key={player.id} className={`px-8 pt-6 pb-5 flex items-start gap-4 ${idx === 0 ? "border-r border-gray-100" : ""}`}>
              <PlayerAvatar playerId={player.id} name={player.name} photoUrl={player.photoUrl} size="md" editable />
              <div className="min-w-0">
                <h2 className="text-2xl font-black uppercase italic text-gray-900 leading-tight truncate">{player.name}</h2>
                <p className={`font-bold text-sm mt-0.5 ${color === "orange" ? "text-orange-500" : "text-blue-500"}`}>
                  {player.position}{player.teamName ? ` · ${player.teamName}` : ""}
                </p>
                {report ? (
                  <div className={`mt-2 inline-flex items-baseline gap-1 ${color === "orange" ? "text-orange-500" : "text-blue-500"}`}>
                    <span className="text-3xl font-black">{report.rating}</span>
                    <span className="text-sm font-bold text-gray-400">/10</span>
                    {ratingWinner !== "tie" && (
                      <span className="ml-1">
                        {(ratingWinner === "a" && color === "orange") || (ratingWinner === "b" && color === "blue")
                          ? <TrendingUp className="h-4 w-4 inline" />
                          : <TrendingDown className="h-4 w-4 text-gray-300 inline" />
                        }
                      </span>
                    )}
                    {ratingWinner === "tie" && <Minus className="h-3 w-3 ml-1 text-gray-400 inline" />}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">Sin informe</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* Overall rating comparison */}
          {(reportA?.rating != null || reportB?.rating != null) && (
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Valoración General</h3>
              <CompareBar labelA="Rating" labelB={""} valA={reportA?.rating} valB={reportB?.rating} max={10} />
            </div>
          )}

          {/* Stats */}
          {hasStats && (
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Estadísticas</h3>
              <div className="divide-y divide-gray-50">
                {statRows.map(([label, a, b, max]) =>
                  (a != null || b != null) ? (
                    <CompareBar key={label} labelA={label} labelB={""} valA={a} valB={b} max={max} />
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Skill ratings */}
          {hasRatings && (
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Habilidades</h3>
              <div className="divide-y divide-gray-50">
                {ratingRows.map(([label, a, b]) =>
                  (a != null || b != null) ? (
                    <CompareBar key={label} labelA={label} labelB={""} valA={a} valB={b} max={10} />
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses side by side */}
          {(reportA?.strengths || reportB?.strengths) && (
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Fortalezas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-orange-400 min-h-[80px]">
                  <p className="text-sm text-gray-700 leading-relaxed">{reportA?.strengths ?? <span className="text-gray-300">–</span>}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-blue-400 min-h-[80px]">
                  <p className="text-sm text-gray-700 leading-relaxed">{reportB?.strengths ?? <span className="text-gray-300">–</span>}</p>
                </div>
              </div>
            </div>
          )}

          {(reportA?.weaknesses || reportB?.weaknesses) && (
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Debilidades</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 rounded-xl p-4 border-l-4 border-red-400 min-h-[80px]">
                  <p className="text-sm text-gray-700 leading-relaxed">{reportA?.weaknesses ?? <span className="text-gray-300">–</span>}</p>
                </div>
                <div className="bg-red-50/60 rounded-xl p-4 border-l-4 border-red-300 min-h-[80px]">
                  <p className="text-sm text-gray-700 leading-relaxed">{reportB?.weaknesses ?? <span className="text-gray-300">–</span>}</p>
                </div>
              </div>
            </div>
          )}

          {(reportA?.recommendation || reportB?.recommendation) && (
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Recomendación</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500">
                  <p className="text-sm font-bold text-gray-900">{reportA?.recommendation ?? <span className="text-gray-300 font-normal">–</span>}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
                  <p className="text-sm font-bold text-gray-900">{reportB?.recommendation ?? <span className="text-gray-300 font-normal">–</span>}</p>
                </div>
              </div>
            </div>
          )}

          {!reportA && !reportB && (
            <div className="text-center py-10 text-gray-400">
              <GitCompare className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Ninguno de los jugadores tiene informe todavía.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Report Panel (single player) ─────────────────────────────────────────────
function ReportPanel({ playerId, playerName, playerPos, playerPhotoUrl, isWatchlisted, onCompare }: {
  playerId: number; playerName: string; playerPos: string;
  playerPhotoUrl?: string | null; isWatchlisted?: boolean; onCompare: () => void;
}) {
  const { contentRef, exportPdf, exporting } = useExportPdf(`informe-${playerName}`);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updatePlayer = useUpdatePlayer();
  const { data: reports } = useListReports({ playerId }, { query: { queryKey: getListReportsQueryKey({ playerId }) } });
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const report = selectedReportId ? reports?.find((r) => r.id === selectedReportId) : reports?.[0];

  const toggleWatchlist = () => {
    updatePlayer.mutate({ id: playerId, data: { watchlisted: !isWatchlisted } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() }); toast({ title: isWatchlisted ? "Eliminado de fichar" : "Añadido a fichar" }); },
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-6 pb-5 border-b border-gray-100 flex items-start gap-5">
        <PlayerAvatar playerId={playerId} name={playerName} photoUrl={playerPhotoUrl} size="md" editable />
        <div className="flex-1 min-w-0 pt-0.5">
          <h1 className="text-4xl font-black uppercase italic text-gray-900 leading-none truncate">{playerName}</h1>
          <p className="text-orange-600 font-bold text-base mt-1">{playerPos}</p>
          {reports && reports.length > 1 && (
            <div className="flex gap-2 mt-2.5 flex-wrap">
              {reports.map((r) => (
                <button key={r.id} onClick={() => setSelectedReportId(r.id)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
                    (selectedReportId ? r.id === selectedReportId : r.id === reports[0].id) ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>{r.date} — {r.scoutName}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
          <button onClick={exportPdf} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-600 transition disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "..." : "PDF"}
          </button>
          <button onClick={onCompare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-600 transition">
            <GitCompare className="h-4 w-4" /> Comparar
          </button>
          <button onClick={toggleWatchlist} disabled={updatePlayer.isPending}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
              isWatchlisted ? "bg-amber-100 text-amber-600 hover:bg-amber-200" : "bg-gray-100 text-gray-400 hover:bg-amber-50 hover:text-amber-500"
            }`}>
            <Star className={`h-4 w-4 ${isWatchlisted ? "fill-amber-400 text-amber-400" : ""}`} />
            {isWatchlisted ? "A Fichar" : "Fichar"}
          </button>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto px-8 py-6">
        {!reports || reports.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <ClipboardList className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-base">Sin informes de scouting.</p>
            <Link href={`/reports/new?playerId=${playerId}`}>
              <button className="mt-4 bg-orange-500 text-white font-bold px-5 py-2.5 rounded-lg hover:bg-orange-600 transition text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" /> Crear Primer Informe
              </button>
            </Link>
          </div>
        ) : report ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-5xl font-black text-orange-500">{report.rating}/10</div>
                <div className="text-sm text-gray-500">
                  <div className="font-semibold text-gray-700">{report.scoutName}</div>
                  <div>{report.date}</div>
                </div>
              </div>
              <Link href={`/reports/new?playerId=${playerId}`}>
                <button className="bg-orange-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-orange-600 transition text-sm flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Nuevo Informe
                </button>
              </Link>
            </div>

            {(report.points != null || report.rebounds != null || report.assists != null) && (
              <div className="flex gap-5 bg-gray-50 rounded-xl px-6 py-4 border border-gray-100 flex-wrap">
                {([["PTS", report.points], ["REB", report.rebounds], ["AST", report.assists], ["ROB", report.steals], ["TAP", report.blocks], ["MIN", report.minutesPlayed]] as [string, number | null | undefined][]).map(([label, val]) =>
                  val != null ? (
                    <div key={label} className="text-center">
                      <div className="text-2xl font-black text-gray-900">{val}</div>
                      <div className="text-xs text-gray-500 font-semibold uppercase tracking-widest">{label}</div>
                    </div>
                  ) : null
                )}
              </div>
            )}

            {(report.offensiveRating || report.defensiveRating || report.athleticismRating || report.iQRating) && (
              <div className="grid grid-cols-2 gap-3">
                {([["Ataque", report.offensiveRating], ["Defensa", report.defensiveRating], ["Atletismo", report.athleticismRating], ["IQ Baloncesto", report.iQRating]] as [string, number | null | undefined][]).map(([label, val]) =>
                  val != null ? (
                    <div key={label} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</span>
                        <span className="text-orange-500 font-black">{val}/10</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(val as number) * 10}%` }} />
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {report.strengths && (
                <div className="bg-gray-50 p-6 rounded-xl border-l-8 border-gray-900">
                  <h3 className="text-xs font-black text-gray-400 uppercase mb-3 tracking-widest">Fortalezas</h3>
                  <p className="text-gray-700 leading-relaxed text-sm">{report.strengths}</p>
                </div>
              )}
              {report.weaknesses && (
                <div className="bg-red-50 p-6 rounded-xl border-l-8 border-red-500">
                  <h3 className="text-xs font-black text-red-400 uppercase mb-3 tracking-widest">Debilidades</h3>
                  <p className="text-gray-700 leading-relaxed text-sm">{report.weaknesses}</p>
                </div>
              )}
            </div>

            {report.summary && (
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-xs font-black text-gray-400 uppercase mb-3 tracking-widest">Resumen del Scout</h3>
                <p className="text-gray-700 leading-relaxed text-sm">{report.summary}</p>
              </div>
            )}
            {report.recommendation && (
              <div className="bg-orange-50 p-6 rounded-xl border-l-8 border-orange-500">
                <h3 className="text-xs font-black text-orange-500 uppercase mb-2 tracking-widest">Recomendación</h3>
                <p className="text-gray-900 font-bold">{report.recommendation}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Scout Page ───────────────────────────────────────────────────────────
export default function Scout() {
  const [view, setView] = useState<SidebarView>({ kind: "all" });
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [comparePlayerId, setComparePlayerId] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [groupByPosition, setGroupByPosition] = useState(true);
  const [showAddTeam, setShowAddTeam] = useState<false | "own" | "rival">(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deletePlayer = useDeletePlayer();
  const updatePlayer = useUpdatePlayer();

  const { data: teams } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });
  const ownTeams = teams?.filter((t) => t.teamType === "own") ?? [];
  const rivalTeams = teams?.filter((t) => t.teamType === "rival") ?? [];

  const playerQueryParams =
    view.kind === "watchlist" ? { watchlisted: true }
    : (view.kind === "own" || view.kind === "rival") && view.teamId ? { teamId: view.teamId }
    : undefined;

  const { data: allPlayers } = useListPlayers(playerQueryParams, {
    query: { queryKey: getListPlayersQueryKey(playerQueryParams) },
  });

  const filteredPlayers = (allPlayers || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPlayer = allPlayers?.find((p) => p.id === selectedPlayerId);
  const comparePlayer = allPlayers?.find((p) => p.id === comparePlayerId)
    ?? (comparePlayerId ? { id: comparePlayerId } as PlayerData : null);

  // Need full player list for compare (not filtered by view)
  const { data: allPlayersGlobal } = useListPlayers(undefined, { query: { queryKey: getListPlayersQueryKey() } });
  const comparePlayerData = allPlayersGlobal?.find((p) => p.id === comparePlayerId) ?? null;

  const handleDeletePlayer = (e: React.MouseEvent, playerId: number, playerName: string) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar a ${playerName}?`)) return;
    deletePlayer.mutate({ id: playerId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        if (selectedPlayerId === playerId) { setSelectedPlayerId(null); setComparePlayerId(null); }
        toast({ title: "Jugador eliminado" });
      },
    });
  };

  const handleQuickWatchlist = (e: React.MouseEvent, playerId: number, current: boolean) => {
    e.stopPropagation();
    updatePlayer.mutate({ id: playerId, data: { watchlisted: !current } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() }); toast({ title: current ? "Eliminado de fichar" : "Añadido a fichar" }); },
    });
  };

  const groupedPlayers = POSITIONS.reduce<Record<string, typeof filteredPlayers>>((acc, pos) => {
    const group = filteredPlayers.filter((p) => p.position === pos);
    if (group.length > 0) acc[pos] = group;
    return acc;
  }, {});
  const otherPlayers = filteredPlayers.filter((p) => !POSITIONS.includes(p.position));
  if (otherPlayers.length > 0) groupedPlayers["Otro"] = otherPlayers;

  const isActive = (v: SidebarView) => {
    if (view.kind !== v.kind) return false;
    if ((v.kind === "own" || v.kind === "rival") && v.teamId != null)
      return (view as typeof v).teamId === v.teamId;
    return true;
  };

  const navBtn = (v: SidebarView, label: React.ReactNode, indent = false) => (
    <button onClick={() => { setView(v); setSelectedPlayerId(null); setComparePlayerId(null); }}
      className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-2 transition-all text-sm ${indent ? "pl-6" : ""}
        ${isActive(v) ? "text-white border-l-4 border-orange-500 bg-white/10" : "text-gray-300 hover:bg-white/5"}`}>
      {label}
    </button>
  );

  const renderPlayerCard = (player: (typeof filteredPlayers)[0]) => {
    const isSelected = selectedPlayerId === player.id;
    const isCompare = comparePlayerId === player.id;
    return (
      <div key={player.id} onClick={() => { setSelectedPlayerId(player.id); setComparePlayerId(null); }}
        className={`w-full text-left px-3 py-3 rounded-xl border transition-all flex items-center gap-3 group cursor-pointer ${
          isSelected ? "border-orange-500 bg-orange-50 shadow-md shadow-orange-100"
          : isCompare ? "border-blue-400 bg-blue-50"
          : "border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm"
        }`}>
        <PlayerAvatar playerId={player.id} name={player.name} photoUrl={player.photoUrl} size="sm" />
        <div className="flex-1 overflow-hidden">
          <div className={`font-bold text-sm truncate ${isSelected ? "text-gray-900" : "text-gray-800"}`}>{player.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {player.jerseyNumber != null ? `#${player.jerseyNumber}` : ""}{player.teamName ? ` · ${player.teamName}` : ""}
          </div>
        </div>
        {isCompare && <span className="text-[10px] font-black text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded flex-shrink-0">VS</span>}
        <button onClick={(e) => handleQuickWatchlist(e, player.id, player.watchlisted ?? false)}
          className={`opacity-0 group-hover:opacity-100 transition p-1 rounded flex-shrink-0 ${player.watchlisted ? "!opacity-100 text-amber-400" : "text-gray-300 hover:text-amber-400"}`}>
          <Star className={`h-3.5 w-3.5 ${player.watchlisted ? "fill-amber-400" : ""}`} />
        </button>
        <button onClick={(e) => handleDeletePlayer(e, player.id, player.name)}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition p-1 rounded flex-shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <ChevronRight className={`h-4 w-4 transition flex-shrink-0 ${isSelected ? "text-orange-500" : "text-gray-300"}`} />
      </div>
    );
  };

  const sectionTitle = {
    all: "Todos los Jugadores",
    own: ownTeams.find((t) => view.kind === "own" && t.id === (view as { teamId?: number }).teamId)?.name ?? "Mi Equipo",
    rival: rivalTeams.find((t) => view.kind === "rival" && t.id === (view as { teamId?: number }).teamId)?.name ?? "Equipo Rival",
    watchlist: "Jugadores a Fichar",
  }[view.kind];

  const showComparison = !!(selectedPlayer && comparePlayerData);

  return (
    <div className="flex h-screen bg-gray-100 font-sans antialiased overflow-hidden">

      {/* ── COL 1: SIDEBAR ────────────────────────────────────────────────── */}
      <aside className="flex flex-col flex-shrink-0 overflow-y-auto" style={{ background: "#111827", width: 264 }}>
        <div className="px-6 py-5 text-orange-500 font-black text-2xl tracking-tighter flex items-center gap-2 flex-shrink-0">
          <Trophy className="h-6 w-6" /> SCOUTPRO
        </div>

        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 px-1 mb-1">
            <Users className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Mi Equipo</span>
          </div>
          {ownTeams.length === 0 && <p className="text-gray-600 text-xs px-2 py-1">Sin equipo propio</p>}
          {ownTeams.map((team) => (
            <div key={team.id}>{navBtn({ kind: "own", teamId: team.id }, <><span className="text-blue-400">🏠</span> {team.name}</>, true)}</div>
          ))}
        </div>
        <div className="px-4 pb-2">
          <button onClick={() => setShowAddTeam("own")}
            className="w-full text-left text-gray-500 text-xs py-1.5 px-2 hover:text-blue-400 transition flex items-center gap-1.5 rounded">
            <Plus className="h-3 w-3" /> Añadir mi equipo
          </button>
        </div>

        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center gap-2 px-1 mb-1">
            <Swords className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Equipos Rivales</span>
          </div>
          {rivalTeams.length === 0 && <p className="text-gray-600 text-xs px-2 py-1">Sin rivales</p>}
          {rivalTeams.map((team) => (
            <div key={team.id}>{navBtn({ kind: "rival", teamId: team.id }, <><span>🏀</span> {team.name}</>, true)}</div>
          ))}
        </div>
        <div className="px-4 pb-2">
          <button onClick={() => setShowAddTeam("rival")}
            className="w-full text-left text-gray-500 text-xs py-1.5 px-2 hover:text-red-400 transition flex items-center gap-1.5 rounded">
            <Plus className="h-3 w-3" /> Añadir rival
          </button>
        </div>

        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center gap-2 px-1 mb-1">
            <UserSearch className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">A Fichar</span>
          </div>
          {navBtn({ kind: "watchlist" }, <><Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /> Jugadores a Fichar</>)}
        </div>

        <div className="flex-1" />
        <div className="border-t border-gray-800 px-4 py-3 space-y-1">
          <Link href="/reports">
            <button className="w-full text-left text-gray-500 text-xs hover:text-gray-300 transition py-1 flex items-center gap-2">
              <ClipboardList className="h-3.5 w-3.5" /> Todos los informes
            </button>
          </Link>
          <Link href="/games">
            <button className="w-full text-left text-gray-500 text-xs hover:text-gray-300 transition py-1 flex items-center gap-2">
              🏆 Partidos
            </button>
          </Link>
        </div>
      </aside>

      {/* ── COL 2: ROSTER ─────────────────────────────────────────────────── */}
      <section className="flex flex-col bg-white flex-shrink-0 border-r border-gray-200" style={{ width: 320 }}>
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest truncate pr-2">{sectionTitle}</h2>
            {view.kind !== "watchlist" && (
              <button onClick={() => setGroupByPosition(!groupByPosition)}
                className={`text-xs px-2 py-1 rounded-md font-semibold transition flex-shrink-0 ${groupByPosition ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                Por posición
              </button>
            )}
          </div>
          <button onClick={() => setShowAddPlayer(true)}
            className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition shadow-lg shadow-orange-100 mb-3 flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            {view.kind === "watchlist" ? "AÑADIR A FICHAR" : "AÑADIR JUGADOR"}
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-orange-500 focus:ring-2 focus:ring-orange-100" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              {search ? "Sin resultados." : view.kind === "watchlist" ? "Añade jugadores a fichar con ★" : "Sin jugadores. Añade uno arriba."}
            </div>
          ) : groupByPosition && view.kind !== "watchlist" ? (
            <div className="space-y-4">
              {Object.entries(groupedPlayers).map(([pos, players]) => (
                <div key={pos}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-2 py-0.5 rounded">{pos}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{POSITION_LABELS[pos] || pos}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[10px] text-gray-300">{players.length}</span>
                  </div>
                  <div className="space-y-1.5">{players.map(renderPlayerCard)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">{filteredPlayers.map(renderPlayerCard)}</div>
          )}
        </div>
      </section>

      {/* ── COL 3: REPORT / COMPARISON ────────────────────────────────────── */}
      <main className="flex-1 bg-white overflow-hidden flex flex-col">
        {!selectedPlayer ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <span className="text-7xl mb-4">📋</span>
            <p className="text-lg font-medium">Selecciona un jugador</p>
            <p className="text-sm text-gray-300 mt-1">
              {filteredPlayers.length} jugador{filteredPlayers.length !== 1 ? "es" : ""} en esta vista
            </p>
          </div>
        ) : showComparison ? (
          <ComparisonView
            playerA={selectedPlayer}
            playerB={comparePlayerData!}
            onClose={() => setComparePlayerId(null)}
          />
        ) : (
          <ReportPanel
            playerId={selectedPlayer.id}
            playerName={selectedPlayer.name}
            playerPos={selectedPlayer.position + (selectedPlayer.teamName ? ` · ${selectedPlayer.teamName}` : "")}
            playerPhotoUrl={selectedPlayer.photoUrl}
            isWatchlisted={selectedPlayer.watchlisted ?? false}
            onCompare={() => setShowPicker(true)}
          />
        )}
      </main>

      {showAddTeam !== false && <AddTeamModal defaultType={showAddTeam} onClose={() => setShowAddTeam(false)} />}
      {showAddPlayer && (
        <AddPlayerModal
          teamId={(view.kind === "own" || view.kind === "rival") && view.teamId ? view.teamId : undefined}
          forWatchlist={view.kind === "watchlist"}
          onClose={() => setShowAddPlayer(false)}
        />
      )}
      {showPicker && selectedPlayer && (
        <PlayerPickerModal
          excludeId={selectedPlayer.id}
          onSelect={(id) => { setComparePlayerId(id); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
