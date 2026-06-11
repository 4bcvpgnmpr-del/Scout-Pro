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
  Camera, Loader2, Star, Users, Swords, UserSearch,
} from "lucide-react";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const POSITION_LABELS: Record<string, string> = {
  PG: "Bases",
  SG: "Escoltas",
  SF: "Aleros",
  PF: "Ala-Pívots",
  C: "Pívots",
};

// ─── Sidebar nav sections ─────────────────────────────────────────────────────
type SidebarView =
  | { kind: "all" }
  | { kind: "own"; teamId?: number }
  | { kind: "rival"; teamId?: number }
  | { kind: "watchlist" };

// ─── Photo Avatar ──────────────────────────────────────────────────────────────
function PlayerAvatar({
  playerId,
  name,
  photoUrl,
  size = "md",
  editable = false,
}: {
  playerId: number;
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updatePlayer = useUpdatePlayer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const sizeClass = { sm: "h-10 w-10 text-sm", md: "h-14 w-14 text-lg", lg: "h-24 w-24 text-3xl" }[size];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!metaRes.ok) throw new Error("No se pudo obtener la URL de subida");
      const { uploadURL, objectPath } = await metaRes.json();
      const uploadRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadRes.ok) throw new Error("Fallo al subir la imagen");
      const serveUrl = `/api/storage${objectPath}`;
      await new Promise<void>((resolve, reject) => {
        updatePlayer.mutate(
          { id: playerId, data: { photoUrl: serveUrl } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
              toast({ title: "Foto actualizada" });
              resolve();
            },
            onError: reject,
          }
        );
      });
    } catch {
      toast({ title: "Error al subir foto", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition flex items-center justify-center rounded-full"
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </>
      )}
    </div>
  );
}

// ─── Add Team Modal ───────────────────────────────────────────────────────────
function AddTeamModal({ defaultType, onClose }: { defaultType: "own" | "rival"; onClose: () => void }) {
  const [name, setName] = useState("");
  const [league, setLeague] = useState("");
  const [type, setType] = useState<"own" | "rival">(defaultType);
  const createTeam = useCreateTeam();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const save = () => {
    if (!name.trim()) return;
    createTeam.mutate(
      { data: { name: name.trim(), league: league.trim() || undefined, teamType: type } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          toast({ title: "Equipo añadido" });
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Equipo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        {/* Type toggle */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setType("own")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${type === "own" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            <Users className="h-4 w-4" /> Mi Equipo
          </button>
          <button onClick={() => setType("rival")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${type === "rival" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            <Swords className="h-4 w-4" /> Rival
          </button>
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

// ─── Add Player Modal ─────────────────────────────────────────────────────────
function AddPlayerModal({
  teamId,
  forWatchlist,
  onClose,
}: { teamId?: number; forWatchlist?: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [pos, setPos] = useState("PG");
  const createPlayer = useCreatePlayer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const save = () => {
    if (!name.trim()) return;
    createPlayer.mutate(
      {
        data: {
          name: name.trim().toUpperCase(),
          position: pos,
          teamId: teamId ?? null,
          jerseyNumber: num ? parseInt(num) : null,
          watchlisted: forWatchlist ? true : false,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Jugador añadido" });
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nuevo Jugador</h2>
            {forWatchlist && (
              <p className="text-sm text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> Jugador a fichar
              </p>
            )}
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
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${pos === p ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {p}
            </button>
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

// ─── Report Panel ─────────────────────────────────────────────────────────────
function ReportPanel({ playerId, playerName, playerPos, playerPhotoUrl, isWatchlisted }: {
  playerId: number;
  playerName: string;
  playerPos: string;
  playerPhotoUrl?: string | null;
  isWatchlisted?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updatePlayer = useUpdatePlayer();
  const { data: reports } = useListReports(
    { playerId },
    { query: { enabled: true, queryKey: getListReportsQueryKey({ playerId }) } }
  );
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const report = selectedReportId ? reports?.find((r) => r.id === selectedReportId) : reports?.[0];

  const toggleWatchlist = () => {
    updatePlayer.mutate(
      { id: playerId, data: { watchlisted: !isWatchlisted } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
          toast({ title: isWatchlisted ? "Eliminado de fichar" : "Añadido a fichar" });
        },
      }
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Player header */}
      <div className="px-10 pt-8 pb-5 border-b border-gray-100 flex items-start gap-5">
        <PlayerAvatar playerId={playerId} name={playerName} photoUrl={playerPhotoUrl} size="lg" editable />
        <div className="flex-1 min-w-0 pt-1">
          <h1 className="text-5xl font-black uppercase italic text-gray-900 leading-none truncate">{playerName}</h1>
          <p className="text-orange-600 font-bold text-lg mt-1">{playerPos}</p>
          {reports && reports.length > 1 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {reports.map((r) => (
                <button key={r.id} onClick={() => setSelectedReportId(r.id)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
                    (selectedReportId ? r.id === selectedReportId : r.id === reports[0].id)
                      ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  {r.date} — {r.scoutName}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Watchlist toggle */}
        <button
          onClick={toggleWatchlist}
          disabled={updatePlayer.isPending}
          title={isWatchlisted ? "Quitar de fichar" : "Añadir a fichar"}
          className={`mt-1 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition flex-shrink-0 ${
            isWatchlisted
              ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
              : "bg-gray-100 text-gray-400 hover:bg-amber-50 hover:text-amber-500"
          }`}
        >
          <Star className={`h-4 w-4 ${isWatchlisted ? "fill-amber-400 text-amber-400" : ""}`} />
          {isWatchlisted ? "A Fichar" : "Fichar"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-7">
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

// ─── Main Scout Page ──────────────────────────────────────────────────────────
export default function Scout() {
  const [view, setView] = useState<SidebarView>({ kind: "all" });
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
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

  // Build player query params from current view
  const playerQueryParams =
    view.kind === "watchlist"
      ? { watchlisted: true }
      : view.kind === "own" && view.teamId
      ? { teamId: view.teamId }
      : view.kind === "rival" && view.teamId
      ? { teamId: view.teamId }
      : undefined;

  const { data: allPlayers } = useListPlayers(playerQueryParams, {
    query: { queryKey: getListPlayersQueryKey(playerQueryParams) },
  });

  const filteredPlayers = (allPlayers || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPlayer = allPlayers?.find((p) => p.id === selectedPlayerId);

  const handleDeletePlayer = (e: React.MouseEvent, playerId: number, playerName: string) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar a ${playerName}?`)) return;
    deletePlayer.mutate(
      { id: playerId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
          if (selectedPlayerId === playerId) setSelectedPlayerId(null);
          toast({ title: "Jugador eliminado" });
        },
      }
    );
  };

  const handleQuickWatchlist = (e: React.MouseEvent, playerId: number, current: boolean) => {
    e.stopPropagation();
    updatePlayer.mutate(
      { id: playerId, data: { watchlisted: !current } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
          toast({ title: current ? "Eliminado de fichar" : "Añadido a fichar" });
        },
      }
    );
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
    if ((v.kind === "own" || v.kind === "rival") && v.teamId != null) {
      return (view as typeof v).teamId === v.teamId;
    }
    return true;
  };

  const navBtn = (v: SidebarView, label: React.ReactNode, indent = false) => (
    <button
      onClick={() => { setView(v); setSelectedPlayerId(null); }}
      className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-2 transition-all text-sm ${indent ? "pl-6" : ""}
        ${isActive(v) ? "text-white border-l-4 border-orange-500 bg-white/10" : "text-gray-300 hover:bg-white/5"}`}
    >
      {label}
    </button>
  );

  const renderPlayerCard = (player: (typeof filteredPlayers)[0]) => (
    <div
      key={player.id}
      onClick={() => setSelectedPlayerId(player.id)}
      className={`w-full text-left px-3 py-3 rounded-xl border transition-all flex items-center gap-3 group cursor-pointer ${
        selectedPlayerId === player.id
          ? "border-orange-500 bg-orange-50 shadow-md shadow-orange-100"
          : "border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm"
      }`}
    >
      <PlayerAvatar playerId={player.id} name={player.name} photoUrl={player.photoUrl} size="sm" />
      <div className="flex-1 overflow-hidden">
        <div className={`font-bold text-sm truncate ${selectedPlayerId === player.id ? "text-gray-900" : "text-gray-800"}`}>
          {player.name}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {player.jerseyNumber != null ? `#${player.jerseyNumber}` : ""}
          {player.teamName ? ` · ${player.teamName}` : ""}
        </div>
      </div>
      {/* Watchlist star */}
      <button
        onClick={(e) => handleQuickWatchlist(e, player.id, player.watchlisted ?? false)}
        className={`opacity-0 group-hover:opacity-100 transition p-1 rounded flex-shrink-0 ${player.watchlisted ? "!opacity-100 text-amber-400" : "text-gray-300 hover:text-amber-400"}`}
        title={player.watchlisted ? "Quitar de fichar" : "Añadir a fichar"}
      >
        <Star className={`h-3.5 w-3.5 ${player.watchlisted ? "fill-amber-400" : ""}`} />
      </button>
      <button
        onClick={(e) => handleDeletePlayer(e, player.id, player.name)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition p-1 rounded flex-shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <ChevronRight className={`h-4 w-4 transition flex-shrink-0 ${selectedPlayerId === player.id ? "text-orange-500" : "text-gray-300"}`} />
    </div>
  );

  const sectionTitle = {
    all: "Todos los Jugadores",
    own: ownTeams.find((t) => view.kind === "own" && t.id === (view as { teamId?: number }).teamId)?.name ?? "Mi Equipo",
    rival: rivalTeams.find((t) => view.kind === "rival" && t.id === (view as { teamId?: number }).teamId)?.name ?? "Equipo Rival",
    watchlist: "Jugadores a Fichar",
  }[view.kind];

  return (
    <div className="flex h-screen bg-gray-100 font-sans antialiased overflow-hidden">

      {/* ── COL 1: SIDEBAR ─────────────────────────────────────────────────── */}
      <aside className="flex flex-col flex-shrink-0 overflow-y-auto" style={{ background: "#111827", width: 264 }}>
        {/* Logo */}
        <div className="px-6 py-5 text-orange-500 font-black text-2xl tracking-tighter flex items-center gap-2 flex-shrink-0">
          <Trophy className="h-6 w-6" />
          SCOUTPRO
        </div>

        {/* ── MI EQUIPO ── */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 px-1 mb-1">
            <Users className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Mi Equipo</span>
          </div>
          {ownTeams.length === 0 && (
            <p className="text-gray-600 text-xs px-2 py-1">Sin equipo propio</p>
          )}
          {ownTeams.map((team) => (
            <div key={team.id}>{navBtn({ kind: "own", teamId: team.id }, <><span className="text-blue-400">🏠</span> {team.name}</>, true)}</div>
          ))}
        </div>
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowAddTeam("own")}
            className="w-full text-left text-gray-500 text-xs py-1.5 px-2 hover:text-blue-400 transition flex items-center gap-1.5 rounded">
            <Plus className="h-3 w-3" /> Añadir mi equipo
          </button>
        </div>

        {/* ── EQUIPOS RIVALES ── */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center gap-2 px-1 mb-1">
            <Swords className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Equipos Rivales</span>
          </div>
          {rivalTeams.length === 0 && (
            <p className="text-gray-600 text-xs px-2 py-1">Sin rivales</p>
          )}
          {rivalTeams.map((team) => (
            <div key={team.id}>{navBtn({ kind: "rival", teamId: team.id }, <><span>🏀</span> {team.name}</>, true)}</div>
          ))}
        </div>
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowAddTeam("rival")}
            className="w-full text-left text-gray-500 text-xs py-1.5 px-2 hover:text-red-400 transition flex items-center gap-1.5 rounded">
            <Plus className="h-3 w-3" /> Añadir rival
          </button>
        </div>

        {/* ── JUGADORES A FICHAR ── */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center gap-2 px-1 mb-1">
            <UserSearch className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">A Fichar</span>
          </div>
          {navBtn({ kind: "watchlist" },
            <><Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /> Jugadores a Fichar</>
          )}
        </div>

        {/* ── SEPARADOR INFERIOR ── */}
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

      {/* ── COL 2: ROSTER ──────────────────────────────────────────────────── */}
      <section className="flex flex-col bg-white flex-shrink-0 border-r border-gray-200" style={{ width: 320 }}>
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest truncate pr-2">{sectionTitle}</h2>
            {view.kind !== "watchlist" && (
              <button
                onClick={() => setGroupByPosition(!groupByPosition)}
                className={`text-xs px-2 py-1 rounded-md font-semibold transition flex-shrink-0 ${groupByPosition ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                Por posición
              </button>
            )}
          </div>
          <button
            onClick={() => setShowAddPlayer(true)}
            className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition shadow-lg shadow-orange-100 mb-3 flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {view.kind === "watchlist" ? "AÑADIR A FICHAR" : "AÑADIR JUGADOR"}
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar jugador..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-orange-500 focus:ring-2 focus:ring-orange-100"
            />
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
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-2 py-0.5 rounded">
                      {pos}
                    </span>
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

      {/* ── COL 3: REPORT PANEL ────────────────────────────────────────────── */}
      <main className="flex-1 bg-white overflow-y-auto">
        {!selectedPlayer ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <span className="text-7xl mb-4">📋</span>
            <p className="text-lg font-medium">Selecciona un jugador</p>
            <p className="text-sm text-gray-300 mt-1">
              {filteredPlayers.length} jugador{filteredPlayers.length !== 1 ? "es" : ""} en esta vista
            </p>
          </div>
        ) : (
          <ReportPanel
            playerId={selectedPlayer.id}
            playerName={selectedPlayer.name}
            playerPos={selectedPlayer.position + (selectedPlayer.teamName ? ` · ${selectedPlayer.teamName}` : "")}
            playerPhotoUrl={selectedPlayer.photoUrl}
            isWatchlisted={selectedPlayer.watchlisted ?? false}
          />
        )}
      </main>

      {showAddTeam !== false && (
        <AddTeamModal defaultType={showAddTeam} onClose={() => setShowAddTeam(false)} />
      )}
      {showAddPlayer && (
        <AddPlayerModal
          teamId={
            (view.kind === "own" || view.kind === "rival") && view.teamId ? view.teamId : undefined
          }
          forWatchlist={view.kind === "watchlist"}
          onClose={() => setShowAddPlayer(false)}
        />
      )}
    </div>
  );
}
