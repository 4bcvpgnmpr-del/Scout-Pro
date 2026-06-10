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
import { Trophy, Plus, Search, Trash2, ClipboardList, X, ChevronRight, Camera, Loader2 } from "lucide-react";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const POSITION_LABELS: Record<string, string> = {
  PG: "Point Guards",
  SG: "Shooting Guards",
  SF: "Small Forwards",
  PF: "Power Forwards",
  C: "Centers",
};

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

  const sizeClass = {
    sm: "h-10 w-10 text-sm",
    md: "h-14 w-14 text-lg",
    lg: "h-24 w-24 text-3xl",
  }[size];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Only image files are allowed", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      // Step 1: request presigned URL
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!metaRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await metaRes.json();

      // Step 2: upload directly to GCS
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Failed to upload file");

      // Step 3: save objectPath as photoUrl on the player
      const serveUrl = `/api/storage${objectPath}`;
      await new Promise<void>((resolve, reject) => {
        updatePlayer.mutate(
          { id: playerId, data: { photoUrl: serveUrl } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
              toast({ title: "Photo updated!" });
              resolve();
            },
            onError: reject,
          }
        );
      });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
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
            {uploading ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </>
      )}
    </div>
  );
}

// ─── Add Team Modal ───────────────────────────────────────────────────────────
function AddTeamModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [league, setLeague] = useState("");
  const createTeam = useCreateTeam();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const save = () => {
    if (!name.trim()) return;
    createTeam.mutate(
      { data: { name: name.trim(), league: league.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          toast({ title: "Team added" });
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">New Rival Team</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name"
          className="w-full mb-4 p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900"
          onKeyDown={(e) => e.key === "Enter" && save()} />
        <input type="text" value={league} onChange={(e) => setLeague(e.target.value)} placeholder="League (e.g. EuroLeague)"
          className="w-full mb-6 p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900"
          onKeyDown={(e) => e.key === "Enter" && save()} />
        <div className="flex gap-3">
          <button onClick={save} disabled={createTeam.isPending}
            className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition disabled:opacity-60">
            {createTeam.isPending ? "Saving..." : "Add Team"}
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Player Modal ─────────────────────────────────────────────────────────
function AddPlayerModal({ teamId, onClose }: { teamId?: number; onClose: () => void }) {
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [pos, setPos] = useState("PG");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
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
          notes:
            [strengths && `Strengths: ${strengths}`, weaknesses && `Weaknesses: ${weaknesses}`]
              .filter(Boolean)
              .join("\n\n") || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Player added" });
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">New Player</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name"
          className="w-full mb-3 p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900" />
        <input type="text" value={num} onChange={(e) => setNum(e.target.value)} placeholder="Jersey Number"
          className="w-full mb-3 p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900" />
        {/* Position selector */}
        <div className="flex gap-2 mb-3">
          {POSITIONS.map((p) => (
            <button key={p} onClick={() => setPos(p)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${pos === p ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {p}
            </button>
          ))}
        </div>
        <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Strengths"
          className="w-full mb-3 p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900 h-20 resize-none" />
        <textarea value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} placeholder="Weaknesses"
          className="w-full mb-6 p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900 h-20 resize-none" />
        <div className="flex gap-3">
          <button onClick={save} disabled={createPlayer.isPending}
            className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition disabled:opacity-60">
            {createPlayer.isPending ? "Saving..." : "Save"}
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Report Panel ─────────────────────────────────────────────────────────────
function ReportPanel({ playerId, playerName, playerPos, playerPhotoUrl }: {
  playerId: number;
  playerName: string;
  playerPos: string;
  playerPhotoUrl?: string | null;
}) {
  const { data: reports } = useListReports(
    { playerId },
    { query: { enabled: true, queryKey: getListReportsQueryKey({ playerId }) } }
  );
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const report = selectedReportId ? reports?.find((r) => r.id === selectedReportId) : reports?.[0];

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
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  {r.date} — {r.scoutName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-7">
        {!reports || reports.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <ClipboardList className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-base">No scouting reports yet.</p>
            <Link href={`/reports/new?playerId=${playerId}`}>
              <button className="mt-4 bg-orange-500 text-white font-bold px-5 py-2.5 rounded-lg hover:bg-orange-600 transition text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" /> File First Report
              </button>
            </Link>
          </div>
        ) : report ? (
          <div className="space-y-5">
            {/* Rating row */}
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
                  <Plus className="h-3.5 w-3.5" /> New Report
                </button>
              </Link>
            </div>

            {/* Stats */}
            {(report.points != null || report.rebounds != null || report.assists != null) && (
              <div className="flex gap-5 bg-gray-50 rounded-xl px-6 py-4 border border-gray-100 flex-wrap">
                {([["PTS", report.points], ["REB", report.rebounds], ["AST", report.assists], ["STL", report.steals], ["BLK", report.blocks], ["MIN", report.minutesPlayed]] as [string, number | null | undefined][]).map(([label, val]) =>
                  val != null ? (
                    <div key={label} className="text-center">
                      <div className="text-2xl font-black text-gray-900">{val}</div>
                      <div className="text-xs text-gray-500 font-semibold uppercase tracking-widest">{label}</div>
                    </div>
                  ) : null
                )}
              </div>
            )}

            {/* Component ratings */}
            {(report.offensiveRating || report.defensiveRating || report.athleticismRating || report.iQRating) && (
              <div className="grid grid-cols-2 gap-3">
                {([["Offense", report.offensiveRating], ["Defense", report.defensiveRating], ["Athleticism", report.athleticismRating], ["IQ", report.iQRating]] as [string, number | null | undefined][]).map(([label, val]) =>
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

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-2 gap-4">
              {report.strengths && (
                <div className="bg-gray-50 p-6 rounded-xl border-l-8 border-gray-900 shadow-sm">
                  <h3 className="text-xs font-black text-gray-400 uppercase mb-3 tracking-widest">Strengths</h3>
                  <p className="text-gray-700 leading-relaxed text-sm">{report.strengths}</p>
                </div>
              )}
              {report.weaknesses && (
                <div className="bg-red-50 p-6 rounded-xl border-l-8 border-red-500 shadow-sm">
                  <h3 className="text-xs font-black text-red-400 uppercase mb-3 tracking-widest">Weaknesses</h3>
                  <p className="text-gray-700 leading-relaxed text-sm">{report.weaknesses}</p>
                </div>
              )}
            </div>

            {report.summary && (
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-xs font-black text-gray-400 uppercase mb-3 tracking-widest">Scout Summary</h3>
                <p className="text-gray-700 leading-relaxed text-sm">{report.summary}</p>
              </div>
            )}
            {report.recommendation && (
              <div className="bg-orange-50 p-6 rounded-xl border-l-8 border-orange-500">
                <h3 className="text-xs font-black text-orange-500 uppercase mb-2 tracking-widest">Recommendation</h3>
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
  const [selectedTeamId, setSelectedTeamId] = useState<number | "all">("all");
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [groupByPosition, setGroupByPosition] = useState(true);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deletePlayer = useDeletePlayer();

  const { data: teams } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });
  const { data: allPlayers } = useListPlayers(
    selectedTeamId !== "all" ? { teamId: selectedTeamId } : undefined,
    {
      query: {
        queryKey: getListPlayersQueryKey(selectedTeamId !== "all" ? { teamId: selectedTeamId } : undefined),
      },
    }
  );

  const filteredPlayers = (allPlayers || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPlayer = allPlayers?.find((p) => p.id === selectedPlayerId);

  const handleDeletePlayer = (e: React.MouseEvent, playerId: number, playerName: string) => {
    e.stopPropagation();
    if (!confirm(`Delete ${playerName}?`)) return;
    deletePlayer.mutate(
      { id: playerId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
          if (selectedPlayerId === playerId) setSelectedPlayerId(null);
          toast({ title: "Player removed" });
        },
      }
    );
  };

  // Group players by position
  const groupedPlayers = POSITIONS.reduce<Record<string, typeof filteredPlayers>>((acc, pos) => {
    const group = filteredPlayers.filter((p) => p.position === pos);
    if (group.length > 0) acc[pos] = group;
    return acc;
  }, {});
  // Any positions not in standard list
  const otherPlayers = filteredPlayers.filter((p) => !POSITIONS.includes(p.position));
  if (otherPlayers.length > 0) groupedPlayers["Other"] = otherPlayers;

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
          {player.jerseyNumber != null ? `#${player.jerseyNumber}` : ""}{player.teamName ? ` · ${player.teamName}` : ""}
        </div>
      </div>
      <div
        onClick={(e) => handleDeletePlayer(e, player.id, player.name)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition p-1 rounded flex-shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </div>
      <ChevronRight className={`h-4 w-4 transition flex-shrink-0 ${selectedPlayerId === player.id ? "text-orange-500" : "text-gray-300"}`} />
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 font-sans antialiased overflow-hidden">

      {/* ── COL 1: TEAMS ───────────────────────────────────────────────────── */}
      <aside className="flex flex-col flex-shrink-0" style={{ background: "#111827", width: 260 }}>
        <div className="px-6 py-5 text-orange-500 font-black text-2xl tracking-tighter flex items-center gap-2">
          <Trophy className="h-6 w-6" />
          SCOUTPRO
        </div>

        <div className="px-4 py-1 text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Scout View</div>
        <button
          onClick={() => { setSelectedTeamId("all"); setSelectedPlayerId(null); }}
          className={`mx-2 mb-1 px-3 py-2.5 rounded-md text-left text-sm flex items-center gap-2 transition-all ${
            selectedTeamId === "all" ? "text-white border-l-4 border-orange-500 bg-gray-700" : "text-gray-300 hover:bg-gray-800"
          }`}
        >
          🏠 All Players
        </button>

        <div className="mt-4 px-4 py-1 text-xs font-bold text-gray-500 uppercase tracking-widest">Teams</div>
        <div className="flex-1 overflow-y-auto space-y-0.5 px-2">
          {teams?.map((team) => (
            <button
              key={team.id}
              onClick={() => { setSelectedTeamId(team.id); setSelectedPlayerId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-2 transition-all text-sm ${
                selectedTeamId === team.id ? "text-white border-l-4 border-orange-500 bg-gray-700" : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              🏀 {team.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAddTeam(true)}
          className="mx-4 mt-2 mb-3 border border-gray-700 text-gray-400 px-3 py-2 rounded text-sm hover:text-white hover:border-orange-500 transition flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add Team
        </button>

        <div className="border-t border-gray-800 px-4 py-3 space-y-1">
          <Link href="/reports">
            <button className="w-full text-left text-gray-500 text-xs hover:text-gray-300 transition py-1 flex items-center gap-2">
              <ClipboardList className="h-3.5 w-3.5" /> All Reports
            </button>
          </Link>
          <Link href="/games">
            <button className="w-full text-left text-gray-500 text-xs hover:text-gray-300 transition py-1 flex items-center gap-2">
              🏆 Games
            </button>
          </Link>
        </div>
      </aside>

      {/* ── COL 2: ROSTER ──────────────────────────────────────────────────── */}
      <section className="flex flex-col bg-white flex-shrink-0 border-r border-gray-200" style={{ width: 320 }}>
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Players</h2>
            <button
              onClick={() => setGroupByPosition(!groupByPosition)}
              className={`text-xs px-2 py-1 rounded-md font-semibold transition ${groupByPosition ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >
              By Position
            </button>
          </div>
          <button
            onClick={() => setShowAddPlayer(true)}
            className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition shadow-lg shadow-orange-100 mb-3 flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" /> ADD PLAYER
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              {search ? "No players match your search." : "No players yet. Add one above."}
            </div>
          ) : groupByPosition ? (
            // Grouped by position
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
                  <div className="space-y-1.5">
                    {players.map(renderPlayerCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Flat list
            <div className="space-y-1.5">
              {filteredPlayers.map(renderPlayerCard)}
            </div>
          )}
        </div>
      </section>

      {/* ── COL 3: SCOUTING REPORT ─────────────────────────────────────────── */}
      <main className="flex-1 bg-white overflow-y-auto">
        {!selectedPlayer ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <span className="text-7xl mb-4">📋</span>
            <p className="text-lg font-medium">Select a player to view the scouting report</p>
            <p className="text-sm text-gray-300 mt-1">
              {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""} in current view
            </p>
          </div>
        ) : (
          <ReportPanel
            playerId={selectedPlayer.id}
            playerName={selectedPlayer.name}
            playerPos={selectedPlayer.position + (selectedPlayer.teamName ? ` · ${selectedPlayer.teamName}` : "")}
            playerPhotoUrl={selectedPlayer.photoUrl}
          />
        )}
      </main>

      {showAddTeam && <AddTeamModal onClose={() => setShowAddTeam(false)} />}
      {showAddPlayer && (
        <AddPlayerModal
          teamId={selectedTeamId !== "all" ? selectedTeamId : undefined}
          onClose={() => setShowAddPlayer(false)}
        />
      )}
    </div>
  );
}
