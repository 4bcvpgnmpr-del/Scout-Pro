import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useListTeams,
  useListPlayers,
  useListReports,
  useCreateTeam,
  useCreatePlayer,
  useDeletePlayer,
  useUpdatePlayer,
  useUpdateTeam,
  getListTeamsQueryKey,
  getListPlayersQueryKey,
  getListReportsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy, Plus, Search, Trash2, ClipboardList, X, ChevronRight, ChevronDown,
  Camera, Loader2, Star, Users, Swords, UserSearch, GitCompare,
  TrendingUp, TrendingDown, Minus, Settings, Download, SlidersHorizontal,
  Eye, EyeOff, Calendar, Home, Target, Shirt, UserCog,
} from "lucide-react";
import { ScoutFlowLogo } from "@/components/logo";
import { useTheme } from "@/hooks/use-theme";
import { TeamScoutingView } from "@/components/team-scouting";
import { TEAM_SECTIONS, type TeamSection } from "@/lib/team-sections";
import { THEMES, FONTS } from "@/lib/themes";
import { useExportPdf } from "@/hooks/use-export-pdf";
import { useReportPrefs, REPORT_SECTIONS } from "@/hooks/use-report-prefs";
import { ShotMap } from "@/components/shot-map";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const POSITION_LABELS: Record<string, string> = {
  PG: "Bases", SG: "Escoltas", SF: "Aleros", PF: "Ala-Pívots", C: "Pívots",
};

type SidebarView =
  | { kind: "scouts-rivales" }
  | { kind: "mapa-tiros"; filterPlayerId?: number }
  | { kind: "own"; teamId?: number; section?: TeamSection }
  | { kind: "rival"; teamId?: number; section?: TeamSection }
  | { kind: "watchlist" };

// ─── Importancia helpers ───────────────────────────────────────────────────────
type ImportanciaVal = "clave" | "medio" | "normal";

function getImportancia(playerId: number): ImportanciaVal | null {
  try {
    const raw = localStorage.getItem(`sp-profile-${playerId}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const imp = p.importancia;
    if (imp === "clave" || imp === "medio" || imp === "normal") return imp;
    return null;
  } catch { return null; }
}

function setImportanciaLocal(playerId: number, imp: ImportanciaVal) {
  try {
    const key = `sp-profile-${playerId}`;
    const raw = localStorage.getItem(key);
    const p: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(key, JSON.stringify({ ...p, importancia: imp }));
  } catch { /* noop */ }
}

const IMP_OPTIONS: { value: ImportanciaVal; label: string; dot: string }[] = [
  { value: "clave",  label: "Clave",  dot: "bg-red-500" },
  { value: "medio",  label: "Medio",  dot: "bg-amber-500" },
  { value: "normal", label: "Normal", dot: "bg-gray-400" },
];

// ─── Player Avatar ─────────────────────────────────────────────────────────────
function PlayerAvatar({
  playerId, name, photoUrl, size = "md", editable = false, shape = "circle",
}: {
  playerId: number; name: string; photoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl"; editable?: boolean; shape?: "circle" | "square";
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updatePlayer = useUpdatePlayer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  const sizeClass = { sm: "h-10 w-10 text-sm", md: "h-14 w-14 text-lg", lg: "h-20 w-20 text-2xl", xl: "h-28 w-28 text-3xl" }[size];
  const roundClass = shape === "square" ? "rounded-2xl" : "rounded-full";

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
    <div className={`relative flex-shrink-0 ${sizeClass} ${roundClass} overflow-hidden`}>
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
            className={`absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition flex items-center justify-center ${roundClass}`}>
            {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </>
      )}
    </div>
  );
}

// ─── Team Logo Upload ──────────────────────────────────────────────────────────
function TeamLogoUpload({ team }: { team: { id: number; name: string; logoUrl?: string | null; teamType?: string | null } }) {
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
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!metaRes.ok) throw new Error();
      const { uploadURL, objectPath } = await metaRes.json();
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      updateTeam.mutate({ id: team.id, data: { logoUrl: `/api/storage${objectPath}` } }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() }); toast({ title: "Logo actualizado" }); },
        onError: () => toast({ title: "Error al subir logo", variant: "destructive" }),
      });
    } catch { toast({ title: "Error al subir", variant: "destructive" }); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  return (
    <div className="relative h-10 w-10 rounded-xl overflow-hidden flex-shrink-0 group/logo cursor-pointer border border-white/10"
      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
      {team.logoUrl ? (
        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full flex items-center justify-center text-[11px] font-black ${isOwn ? "bg-blue-500/30 text-blue-300" : "bg-red-500/30 text-red-300"}`}>
          {initials}
        </div>
      )}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition">
        {uploading ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" /> : <Camera className="h-3.5 w-3.5 text-white" />}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// ─── Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { themeId, setTheme, fontId, setFont } = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-start" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 m-4 w-60 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Personalizar</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Color</p>
        <div className="flex gap-2 mb-4">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => setTheme(t.id)} title={t.name}
              className={`h-7 w-7 rounded-full transition ring-2 ring-offset-2 ring-offset-gray-900 ${themeId === t.id ? "ring-white scale-110" : "ring-transparent hover:scale-105"}`}
              style={{ background: t.swatch }} />
          ))}
        </div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Tipografía</p>
        <div className="flex flex-col gap-1">
          {FONTS.map((f) => (
            <button key={f.id} onClick={() => setFont(f.id)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition ${fontId === f.id ? "bg-white/10 text-white font-bold" : "text-gray-400 hover:bg-white/5"}`}
              style={{ fontFamily: f.family }}>
              {f.label} — <span className="text-gray-500 text-xs normal-case font-normal">{f.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── FastScout letter grade helper ─────────────────────────────────────────────
function letterGrade(val: number | null | undefined): string {
  if (val == null) return "—";
  if (val >= 9.5) return "A+";
  if (val >= 8.5) return "A";
  if (val >= 8)   return "A−";
  if (val >= 7)   return "B+";
  if (val >= 6)   return "B";
  if (val >= 5)   return "B−";
  if (val >= 4)   return "C+";
  if (val >= 3)   return "C";
  if (val >= 2)   return "D";
  return "F";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-green-500";
  if (grade.startsWith("B")) return "text-blue-500";
  if (grade.startsWith("C")) return "text-yellow-500";
  if (grade === "D") return "text-orange-500";
  return "text-red-500";
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
function AddPlayerModal({ teamId, forWatchlist, rivalTeams, ownTeam, onClose }: {
  teamId?: number; forWatchlist?: boolean;
  rivalTeams?: { id: number; name: string }[];
  ownTeam?: { id: number; name: string } | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [pos, setPos] = useState("PG");
  const [importancia, setImportancia] = useState<ImportanciaVal>("normal");
  const [rivalTeamId, setRivalTeamId] = useState<string>(teamId ? String(teamId) : "");
  const [partDate, setPartDate] = useState("");
  const [competition, setCompetition] = useState("liga");
  const createPlayer = useCreatePlayer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const save = () => {
    if (!name.trim()) return;
    const resolvedTeamId = teamId ?? (rivalTeamId ? parseInt(rivalTeamId) : null);
    createPlayer.mutate({
      data: { name: name.trim().toUpperCase(), position: pos, teamId: resolvedTeamId, jerseyNumber: num ? parseInt(num) : null, watchlisted: forWatchlist ?? false },
    }, {
      onSuccess: (newPlayer) => {
        const profile: Record<string, unknown> = { importancia };
        if (partDate || rivalTeamId) {
          profile.partido = {
            rivalTeamId: rivalTeamId ? parseInt(rivalTeamId) : null,
            rivalTeamName: rivalTeams?.find((t) => t.id === parseInt(rivalTeamId))?.name ?? "",
            date: partDate,
            competition,
          };
        }
        localStorage.setItem(`sp-profile-${newPlayer.id}`, JSON.stringify(profile));
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Scout añadido" });
        onClose();
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Nuevo Scout</h2>
              {forWatchlist && <p className="text-sm text-amber-600 font-medium mt-0.5 flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> A fichar</p>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Partido escouteado */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Partido escouteado</p>
            {ownTeam && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 font-medium w-20 flex-shrink-0">Mi equipo</span>
                <span className="font-bold text-gray-700">{ownTeam.name}</span>
              </div>
            )}
            {(rivalTeams && rivalTeams.length > 0) && !teamId && (
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Equipo rival</label>
                <select value={rivalTeamId} onChange={(e) => setRivalTeamId(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white outline-orange-500">
                  <option value="">Sin especificar</option>
                  {rivalTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Fecha</label>
                <input type="date" value={partDate} onChange={(e) => setPartDate(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Competición</label>
                <select value={competition} onChange={(e) => setCompetition(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white outline-orange-500">
                  <option value="liga">Liga</option>
                  <option value="copa">Copa</option>
                  <option value="europeo">Europeo</option>
                  <option value="amistoso">Amistoso</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
          </div>

          {/* Jugador */}
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1 block">Nombre completo</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="NOMBRE APELLIDO"
              className="w-full p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900 font-medium" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1 block">Dorsal</label>
            <input type="text" value={num} onChange={(e) => setNum(e.target.value)} placeholder="#00"
              className="w-full p-3 border border-gray-200 rounded-lg outline-orange-500 text-gray-900" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1 block">Posición</label>
            <div className="flex gap-2">
              {POSITIONS.map((p) => (
                <button key={p} onClick={() => setPos(p)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${pos === p ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1 block">Importancia</label>
            <div className="flex gap-2">
              {IMP_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setImportancia(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    importancia === opt.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-8 pb-7 flex gap-3">
          <button onClick={save} disabled={createPlayer.isPending}
            className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition disabled:opacity-60">
            {createPlayer.isPending ? "Guardando..." : "Guardar scout"}
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
  teamId?: number | null; teamName?: string | null; teamLogoUrl?: string | null;
  handedness?: string | null; photoUrl?: string | null; watchlisted?: boolean | null;
};

function nameSizeClass(name: string): string {
  const len = name.length;
  if (len > 24) return "text-base";
  if (len > 18) return "text-lg";
  if (len > 13) return "text-xl";
  return "text-2xl";
}

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
              <PlayerAvatar playerId={player.id} name={player.name} photoUrl={player.photoUrl} size="md" shape="square" editable />
              <div className="min-w-0">
                <h2 className={`font-black uppercase italic text-gray-900 leading-tight break-words ${nameSizeClass(player.name)}`}>{player.name}</h2>
                <p className={`font-bold text-sm mt-0.5 flex items-center gap-2 ${color === "orange" ? "text-orange-500" : "text-blue-500"}`}>
                  {player.teamLogoUrl && <img src={player.teamLogoUrl} alt={player.teamName ?? ""} className="h-5 w-5 rounded object-cover" />}
                  <span>{player.position}{player.teamName ? ` · ${player.teamName}` : ""}</span>
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

// ─── Box Score (complete pro stats) ────────────────────────────────────────────
type BoxScoreReport = {
  minutesPlayed?: number | null; points?: number | null;
  rebounds?: number | null; offensiveRebounds?: number | null; defensiveRebounds?: number | null;
  assists?: number | null; steals?: number | null; blocks?: number | null; turnovers?: number | null;
  fieldGoalsMade?: number | null; fieldGoalsAttempted?: number | null;
  threesMade?: number | null; threesAttempted?: number | null;
  freeThrowsMade?: number | null; freeThrowsAttempted?: number | null;
};
function shootingPct(made?: number | null, att?: number | null): string | null {
  if (made == null || att == null || att === 0) return null;
  return ((made / att) * 100).toFixed(1) + "%";
}
function valoracion(r: BoxScoreReport): number | null {
  const reb = r.rebounds ?? (r.offensiveRebounds != null || r.defensiveRebounds != null ? (r.offensiveRebounds ?? 0) + (r.defensiveRebounds ?? 0) : null);
  const any = [r.points, r.assists, r.steals, r.blocks, r.turnovers, reb, r.fieldGoalsAttempted, r.freeThrowsAttempted].some((v) => v != null);
  if (!any) return null;
  const missedFG = (r.fieldGoalsAttempted ?? 0) - (r.fieldGoalsMade ?? 0);
  const missedFT = (r.freeThrowsAttempted ?? 0) - (r.freeThrowsMade ?? 0);
  return (r.points ?? 0) + (reb ?? 0) + (r.assists ?? 0) + (r.steals ?? 0) + (r.blocks ?? 0) - missedFG - missedFT - (r.turnovers ?? 0);
}
function BoxScore({ report }: { report: BoxScoreReport }) {
  const oreb = report.offensiveRebounds;
  const dreb = report.defensiveRebounds;
  const totalReb = report.rebounds ?? (oreb != null || dreb != null ? (oreb ?? 0) + (dreb ?? 0) : null);
  const fgm = report.fieldGoalsMade, fga = report.fieldGoalsAttempted;
  const t3m = report.threesMade, t3a = report.threesAttempted;
  const t2m = fgm != null && t3m != null ? fgm - t3m : null;
  const t2a = fga != null && t3a != null ? fga - t3a : null;
  const val = valoracion(report);

  const primary: [string, number | null | undefined, boolean][] = [
    ["MIN", report.minutesPlayed, false],
    ["PTS", report.points, false],
    ["REB", totalReb, false],
    ["AST", report.assists, false],
    ["ROB", report.steals, false],
    ["TAP", report.blocks, false],
    ["PÉR", report.turnovers, false],
    ["VAL", val, true],
  ];
  const hasPrimary = primary.some(([, v]) => v != null);

  const shooting: [string, string, number | null | undefined, number | null | undefined][] = [
    ["T2", "Tiros de 2", t2m, t2a],
    ["T3", "Triples", t3m, t3a],
    ["TL", "Tiros libres", report.freeThrowsMade, report.freeThrowsAttempted],
    ["TC", "Tiros de campo", fgm, fga],
  ];
  const hasShooting = shooting.some(([, , m, a]) => m != null || a != null);

  if (!hasPrimary && !hasShooting) return null;

  return (
    <div className="space-y-3">
      {hasPrimary && (
        <div className="grid grid-cols-4 gap-2">
          {primary.map(([label, v, accent]) => (
            <div key={label} className={`rounded-xl p-3 text-center border ${accent ? "bg-primary/10 border-primary/30" : "bg-gray-50 border-gray-100"}`}>
              <div className={`text-xl font-black ${accent ? "text-primary" : "text-gray-900"}`}>{v ?? "—"}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{label}</div>
              {label === "REB" && (oreb != null || dreb != null) && (
                <div className="text-[9px] text-gray-400 font-semibold mt-0.5">OF {oreb ?? 0} · DEF {dreb ?? 0}</div>
              )}
            </div>
          ))}
        </div>
      )}
      {hasShooting && (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-[1fr_5rem_4rem] bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
            <div className="px-3 py-2">Tiro</div>
            <div className="px-3 py-2 text-center">C–I</div>
            <div className="px-3 py-2 text-center">%</div>
          </div>
          {shooting.map(([key, label, m, a]) => (
            <div key={key} className="grid grid-cols-[1fr_5rem_4rem] border-t border-gray-100 text-sm">
              <div className="px-3 py-2 font-semibold text-gray-700">{label}</div>
              <div className="px-3 py-2 text-center font-black text-gray-900">{m != null || a != null ? `${m ?? 0}–${a ?? 0}` : "—"}</div>
              <div className="px-3 py-2 text-center font-bold text-primary">{shootingPct(m, a) ?? "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Report Panel (single player) ─────────────────────────────────────────────
function ReportPanel({ playerId, playerName, playerPos, playerPhotoUrl, playerHandedness, playerTeamName, playerTeamLogoUrl, isWatchlisted, onCompare, onViewShotMap }: {
  playerId: number; playerName: string; playerPos: string;
  playerHandedness?: string | null; playerTeamName?: string | null; playerTeamLogoUrl?: string | null;
  playerPhotoUrl?: string | null; isWatchlisted?: boolean; onCompare: () => void; onViewShotMap?: () => void;
}) {
  const { contentRef, exportPdf, exporting } = useExportPdf(`informe-${playerName}`);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updatePlayer = useUpdatePlayer();
  const [format, setFormat] = useState<"estandar" | "pro">("estandar");
  const { themeId, setTheme, fontId, setFont } = useTheme();
  const { sections, toggleSection } = useReportPrefs();
  const [showCustomize, setShowCustomize] = useState(false);
  const customizeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showCustomize) return;
    const onDown = (e: MouseEvent) => {
      if (customizeRef.current && !customizeRef.current.contains(e.target as Node)) setShowCustomize(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowCustomize(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [showCustomize]);
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
          <p className="text-primary font-bold text-base mt-1">{playerPos}</p>
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
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
            <button onClick={() => setFormat("estandar")} className={`px-3 py-2 transition ${format === "estandar" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>Estándar</button>
            <button onClick={() => setFormat("pro")} className={`px-3 py-2 transition border-l border-gray-200 ${format === "pro" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>PRO</button>
          </div>
          <div className="relative" ref={customizeRef}>
            <button onClick={() => setShowCustomize((v) => !v)} aria-expanded={showCustomize}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${showCustomize ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-600 hover:bg-primary/10 hover:text-primary"}`}>
              <SlidersHorizontal className="h-4 w-4" /> Personalizar
            </button>
            {showCustomize && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 p-5">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Color de acento</p>
                  <div className="flex gap-2 mb-5">
                    {THEMES.map((t) => (
                      <button key={t.id} onClick={() => setTheme(t.id)} title={t.name}
                        className={`h-7 w-7 rounded-full transition ring-2 ring-offset-2 ${themeId === t.id ? "ring-gray-900 scale-110" : "ring-transparent hover:scale-105"}`}
                        style={{ background: t.swatch }} />
                    ))}
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tipografía</p>
                  <div className="flex flex-col gap-1 mb-5">
                    {FONTS.map((f) => (
                      <button key={f.id} onClick={() => setFont(f.id)}
                        className={`text-left px-3 py-2 rounded-lg text-sm transition ${fontId === f.id ? "bg-primary/10 text-primary font-bold" : "text-gray-600 hover:bg-gray-100"}`}
                        style={{ fontFamily: f.family }}>
                        {f.label} — <span className="text-gray-400 text-xs normal-case font-normal">{f.name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Secciones visibles</p>
                  <div className="flex flex-col gap-1">
                    {REPORT_SECTIONS.map((s) => (
                      <button key={s.key} onClick={() => toggleSection(s.key)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition ${sections[s.key] ? "bg-gray-50 text-gray-900" : "text-gray-400 hover:bg-gray-50"}`}>
                        {s.label}
                        {sections[s.key] ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
            )}
          </div>
          <button onClick={exportPdf} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-600 transition disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "..." : "PDF"}
          </button>
          {onViewShotMap && (
            <button onClick={onViewShotMap}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-600 transition">
              <Target className="h-4 w-4" /> Tiros
            </button>
          )}
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

      <div ref={contentRef} className="flex-1 overflow-y-auto px-8 py-6" style={{ fontFamily: "var(--app-font-display)" }}>
        {!reports || reports.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <ClipboardList className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-base">Sin informes de scouting.</p>
            <Link href={`/reports/new?playerId=${playerId}`}>
              <button className="mt-4 bg-primary text-white font-bold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" /> Crear Primer Informe
              </button>
            </Link>
          </div>
        ) : report ? (
          format === "pro" ? (
            /* ─ PRO compact format ─ */
            <div className="space-y-4">
              {/* Overall grade header */}
              <div className="flex items-center gap-6 p-5 bg-gray-900 text-white rounded-2xl">
                <PlayerAvatar playerId={playerId} name={playerName} photoUrl={playerPhotoUrl} size="xl" shape="square" editable />
                <div className="flex-1 min-w-0">
                  <div className="text-3xl font-black uppercase italic leading-tight text-primary">{playerName}</div>
                  <div className="text-sm text-gray-400 mt-0.5">{playerPos}</div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {playerTeamLogoUrl && <img src={playerTeamLogoUrl} alt={playerTeamName ?? ""} className="h-7 w-7 rounded object-cover bg-white/10" />}
                    {playerHandedness && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 bg-white/10 px-2 py-1 rounded-full">Mano: {playerHandedness}</span>
                    )}
                    <span className="text-xs text-gray-500">{report.date}</span>
                  </div>
                </div>
                <div className="text-center flex-shrink-0">
                  <div className={`text-6xl font-black leading-none ${gradeColor(letterGrade(report.rating))}`}>{letterGrade(report.rating)}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Overall</div>
                </div>
              </div>

              {/* Stats — complete box score */}
              {sections.estadisticas && <BoxScore report={report} />}

              {/* Skill grades */}
              {sections.valoraciones && (report.offensiveRating || report.defensiveRating || report.athleticismRating || report.iQRating) && (
                <div className="grid grid-cols-4 gap-2">
                  {([["Ataque", report.offensiveRating], ["Defensa", report.defensiveRating], ["Atletismo", report.athleticismRating], ["IQ", report.iQRating]] as [string, number | null | undefined][]).map(([label, val]) => (
                    <div key={label} className="bg-white rounded-xl p-4 border border-gray-200 text-center shadow-sm">
                      <div className={`text-3xl font-black ${gradeColor(letterGrade(val))}`}>{letterGrade(val)}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Strengths & Weaknesses */}
              {((sections.fortalezas && report.strengths) || (sections.debilidades && report.weaknesses)) && (
                <div className="grid grid-cols-2 gap-3">
                  {sections.fortalezas && report.strengths && (
                    <div className="bg-green-50 p-4 rounded-xl border-l-4 border-green-500">
                      <div className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">✓ Fortalezas</div>
                      <p className="text-gray-700 text-sm leading-relaxed">{report.strengths}</p>
                    </div>
                  )}
                  {sections.debilidades && report.weaknesses && (
                    <div className="bg-red-50 p-4 rounded-xl border-l-4 border-red-500">
                      <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">✗ Debilidades</div>
                      <p className="text-gray-700 text-sm leading-relaxed">{report.weaknesses}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Summary & Rec */}
              {sections.resumen && report.summary && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed">{report.summary}</div>
              )}
              {sections.recomendacion && report.recommendation && (
                <div className="bg-gray-900 text-white p-4 rounded-xl flex items-start gap-3">
                  <span className="text-primary font-black text-xs uppercase tracking-widest flex-shrink-0 mt-0.5">REC.</span>
                  <p className="font-semibold text-sm leading-relaxed">{report.recommendation}</p>
                </div>
              )}

              <Link href={`/reports/new?playerId=${playerId}`}>
                <button className="w-full bg-primary text-white font-bold py-2.5 rounded-xl hover:bg-primary/90 transition text-sm flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" /> Nuevo Informe
                </button>
              </Link>
            </div>
          ) : (
            /* ─ Standard format ─ */
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <PlayerAvatar playerId={playerId} name={playerName} photoUrl={playerPhotoUrl} size="lg" shape="square" editable />
                <div className="flex-1 min-w-0">
                  <div className="text-3xl font-black uppercase italic text-gray-900 leading-tight">{playerName}</div>
                  <div className="text-primary font-bold text-sm mt-0.5">{playerPos}</div>
                  {(playerTeamLogoUrl || playerHandedness) && (
                    <div className="flex items-center gap-3 mt-1.5">
                      {playerTeamLogoUrl && <img src={playerTeamLogoUrl} alt={playerTeamName ?? ""} className="h-7 w-7 rounded object-cover" />}
                      {playerHandedness && <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Mano: {playerHandedness}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-5xl font-black text-primary">{report.rating}/10</div>
                  <div className="text-sm text-gray-500">
                    <div className="font-semibold text-gray-700">{report.scoutName}</div>
                    <div>{report.date}</div>
                  </div>
                </div>
                <Link href={`/reports/new?playerId=${playerId}`}>
                  <button className="bg-primary text-white font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition text-sm flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Nuevo Informe
                  </button>
                </Link>
              </div>

              {sections.estadisticas && <BoxScore report={report} />}

              {sections.valoraciones && (report.offensiveRating || report.defensiveRating || report.athleticismRating || report.iQRating) && (
                <div className="grid grid-cols-2 gap-3">
                  {([["Ataque", report.offensiveRating], ["Defensa", report.defensiveRating], ["Atletismo", report.athleticismRating], ["IQ Baloncesto", report.iQRating]] as [string, number | null | undefined][]).map(([label, val]) =>
                    val != null ? (
                      <div key={label} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</span>
                          <span className="text-primary font-black">{val}/10</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(val as number) * 10}%` }} />
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {((sections.fortalezas && report.strengths) || (sections.debilidades && report.weaknesses)) && (
              <div className="grid grid-cols-2 gap-4">
                {sections.fortalezas && report.strengths && (
                  <div className="bg-gray-50 p-6 rounded-xl border-l-8 border-gray-900">
                    <h3 className="text-xs font-black text-gray-400 uppercase mb-3 tracking-widest">Fortalezas</h3>
                    <p className="text-gray-700 leading-relaxed text-sm">{report.strengths}</p>
                  </div>
                )}
                {sections.debilidades && report.weaknesses && (
                  <div className="bg-red-50 p-6 rounded-xl border-l-8 border-red-500">
                    <h3 className="text-xs font-black text-red-400 uppercase mb-3 tracking-widest">Debilidades</h3>
                    <p className="text-gray-700 leading-relaxed text-sm">{report.weaknesses}</p>
                  </div>
                )}
              </div>
              )}

              {sections.resumen && report.summary && (
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <h3 className="text-xs font-black text-gray-400 uppercase mb-3 tracking-widest">Resumen del Scout</h3>
                  <p className="text-gray-700 leading-relaxed text-sm">{report.summary}</p>
                </div>
              )}
              {sections.recomendacion && report.recommendation && (
                <div className="bg-primary/10 p-6 rounded-xl border-l-8 border-primary">
                  <h3 className="text-xs font-black text-primary uppercase mb-2 tracking-widest">Recomendación</h3>
                  <p className="text-gray-900 font-bold">{report.recommendation}</p>
                </div>
              )}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Scout Page ───────────────────────────────────────────────────────────
export default function Scout() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<SidebarView>({ kind: "scouts-rivales" });
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [comparePlayerId, setComparePlayerId] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTeamId, setFilterTeamId] = useState<number | null>(null);
  const [filterImportancia, setFilterImportancia] = useState<string>("");
  const [groupByPosition, setGroupByPosition] = useState(true);
  const [showAddTeam, setShowAddTeam] = useState<false | "own" | "rival">(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  useTheme();
  const deletePlayer = useDeletePlayer();
  const updatePlayer = useUpdatePlayer();

  const { data: teams } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });
  const ownTeams = teams?.filter((t) => t.teamType === "own") ?? [];
  const rivalTeams = teams?.filter((t) => t.teamType === "rival") ?? [];
  const ownTeam = ownTeams[0] ?? null;
  const ownLeague = ownTeam?.league ?? null;
  const leagueRivalTeams = ownLeague
    ? rivalTeams.filter((t) => t.league === ownLeague)
    : rivalTeams;

  const playerQueryParams =
    view.kind === "watchlist" ? { watchlisted: true }
    : (view.kind === "own" || view.kind === "rival") && view.teamId ? { teamId: view.teamId }
    : undefined;

  const { data: allPlayers } = useListPlayers(playerQueryParams, {
    query: { queryKey: getListPlayersQueryKey(playerQueryParams) },
  });

  const filteredPlayers = (allPlayers || []).filter((p) => {
    if (!p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (view.kind === "scouts-rivales" || view.kind === "rival") {
      if (!rivalTeams.some((t) => t.id === p.teamId)) return false;
    }
    if ((view.kind === "scouts-rivales" || view.kind === "rival") && filterTeamId !== null && p.teamId !== filterTeamId) return false;
    if (view.kind === "scouts-rivales" && filterImportancia) {
      if (getImportancia(p.id) !== filterImportancia) return false;
    }
    return true;
  });

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
      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm font-medium ${indent ? "pl-6" : ""}
        ${isActive(v) ? "text-orange-300 bg-orange-500/10" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}>
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

  const sectionTitle =
    view.kind === "scouts-rivales" ? "Scouts de Rivales"
    : view.kind === "mapa-tiros" ? "Mapa de Tiros"
    : view.kind === "watchlist" ? "Mis Objetivos"
    : view.kind === "own"
      ? (ownTeams.find((t) => t.id === (view as { teamId?: number }).teamId)?.name ?? "Mi Plantilla")
    : view.kind === "rival"
      ? (rivalTeams.find((t) => t.id === (view as { teamId?: number }).teamId)?.name ?? "Plantilla Rival")
    : "Jugadores";

  const showComparison = !!(selectedPlayer && comparePlayerData);

  const teamKind: "own" | "rival" = view.kind === "rival" ? "rival" : "own";
  const activeTeam =
    (view.kind === "own" || view.kind === "rival") && view.teamId != null
      ? teams?.find((t) => t.id === view.teamId)
      : undefined;
  const teamMediaSection: TeamSection | null =
    (view.kind === "own" || view.kind === "rival") && view.section
      ? view.section
      : null;
  const showTeamScouting = !!(activeTeam && teamMediaSection && view.kind === "own");

  return (
    <div className="flex h-screen bg-gray-100 font-sans antialiased overflow-hidden">

      {/* ── COL 1: SIDEBAR ────────────────────────────────────────────────── */}
      <aside className="flex flex-col flex-shrink-0 overflow-hidden" style={{ background: "#0f172a", width: 272 }}>
        <div className="px-5 py-5 flex-shrink-0 border-b border-white/5">
          <ScoutFlowLogo size="md" />
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── DASHBOARD ── */}
          <div className="pt-4 pb-2 px-3">
            <Link href="/">
              <button className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5">
                <Home className="h-3.5 w-3.5" /> Dashboard
              </button>
            </Link>
          </div>

          <div className="mx-5 h-px bg-white/5" />

          {/* ── MI EQUIPO ── */}
          <div className="pt-4 pb-2">
            <div className="px-5 mb-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.14em]">Mi Equipo</span>
            </div>
            <div className="px-3 space-y-0.5">
              <button
                onClick={() => {
                  if (ownTeam) setView({ kind: "own", teamId: ownTeam.id, section: "roster" });
                  else setView({ kind: "own" });
                  setSelectedPlayerId(null); setComparePlayerId(null);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm font-medium ${
                  view.kind === "own" ? "text-blue-300 bg-blue-500/10" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <Users className="h-3.5 w-3.5" /> Mi plantilla
              </button>
              {ownTeams.length === 0 && (
                <button onClick={() => setShowAddTeam("own")}
                  className="w-full text-left text-gray-600 text-[11px] py-2 px-3 hover:text-blue-400 transition-all flex items-center gap-2 rounded-lg hover:bg-white/5">
                  <Plus className="h-3 w-3" /> Añadir mi equipo
                </button>
              )}
            </div>
          </div>

          <div className="mx-5 h-px bg-white/5" />

          {/* ── RIVALES ── */}
          <div className="pt-4 pb-2">
            <div className="px-5 mb-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.14em]">Rivales</span>
            </div>
            <div className="px-3 space-y-0.5">
              {navBtn({ kind: "scouts-rivales" }, <><Eye className="h-3.5 w-3.5" /> Scouts rivales</>)}
              <button
                onClick={() => { setShowAddPlayer(true); }}
                className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5"
              >
                <Plus className="h-3.5 w-3.5" /> Nuevo scout
              </button>
              <button
                onClick={() => { setView({ kind: "rival" }); setSelectedPlayerId(null); setComparePlayerId(null); setFilterTeamId(null); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm font-medium ${
                  view.kind === "rival" ? "text-orange-300 bg-orange-500/10" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <Shirt className="h-3.5 w-3.5" /> Plantilla rival
              </button>
              {navBtn({ kind: "mapa-tiros" }, <><Target className="h-3.5 w-3.5" /> Mapa de tiros</>)}
            </div>
          </div>

          <div className="mx-5 h-px bg-white/5" />

          {/* ── FICHAJES ── */}
          <div className="pt-4 pb-2">
            <div className="px-5 mb-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.14em]">Fichajes</span>
            </div>
            <div className="px-3 space-y-0.5">
              <Link href="/fichajes">
                <button className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5">
                  <Search className="h-3.5 w-3.5" /> Explorar ligas
                </button>
              </Link>
              {navBtn({ kind: "watchlist" }, <><Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /> Mis objetivos</>)}
            </div>
          </div>

          <div className="mx-5 h-px bg-white/5" />

          {/* ── SISTEMA ── */}
          <div className="pt-4 pb-5">
            <div className="px-5 mb-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.14em]">Sistema</span>
            </div>
            <div className="px-3 space-y-0.5">
              <button onClick={() => setShowSettings(true)}
                className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm font-medium text-gray-400 hover:text-orange-300 hover:bg-orange-500/5">
                <Settings className="h-3.5 w-3.5" /> Personalizar
              </button>
              <button onClick={() => setLocation("/mi-cuenta")}
                className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5">
                <UserCog className="h-3.5 w-3.5" /> Mi configuración
              </button>
            </div>
          </div>

        </div>
      </aside>

      {showTeamScouting ? (
        <TeamScoutingView
          team={activeTeam!}
          section={teamMediaSection!}
          onSectionChange={(s) => { setView({ kind: teamKind, teamId: activeTeam!.id, section: s }); setSelectedPlayerId(null); setComparePlayerId(null); }}
        />
      ) : view.kind === "mapa-tiros" ? (
        <div className="flex-1 overflow-hidden">
          <ShotMap
            players={(allPlayers ?? []).filter((p) => rivalTeams.some((t) => t.id === p.teamId)).map((p) => ({
              id: p.id, name: p.name, teamName: p.teamName,
            }))}
            initialPlayerId={(view as { filterPlayerId?: number }).filterPlayerId ?? null}
            onViewScout={(pid) => {
              setView({ kind: "scouts-rivales" });
              setSelectedPlayerId(pid);
              setComparePlayerId(null);
            }}
          />
        </div>
      ) : (
      <>
      {/* ── COL 2: ROSTER ─────────────────────────────────────────────────── */}
      <section className="flex flex-col bg-white flex-shrink-0 border-r border-gray-200" style={{ width: 320 }}>
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          {/* ── Title row ── */}
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest truncate pr-2">{sectionTitle}</h2>
            {view.kind !== "watchlist" && view.kind !== "rival" && (
              <button onClick={() => setGroupByPosition(!groupByPosition)}
                className={`text-xs px-2 py-1 rounded-md font-semibold transition flex-shrink-0 ${groupByPosition ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                Por posición
              </button>
            )}
          </div>

          {/* Mi liga subtitle */}
          {(view.kind === "scouts-rivales" || view.kind === "rival") && ownLeague && (
            <p className="text-[10px] text-blue-400 font-semibold mb-3">Mi liga: {ownLeague}</p>
          )}

          {/* ── WATCHLIST: add button ── */}
          {view.kind === "watchlist" && (
            <button onClick={() => setShowAddPlayer(true)}
              className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition shadow-lg shadow-orange-100 mb-3 flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> AÑADIR A FICHAR
            </button>
          )}

          {/* ── PLANTILLA RIVAL: team selector + add button ── */}
          {view.kind === "rival" && (
            <div className="mb-3 space-y-2">
              <select
                value={filterTeamId ?? ""}
                onChange={(e) => { setFilterTeamId(e.target.value ? Number(e.target.value) : null); setSelectedPlayerId(null); }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white outline-orange-500 cursor-pointer font-medium"
              >
                <option value="">Seleccionar equipo rival...</option>
                {(leagueRivalTeams.length > 0 ? leagueRivalTeams : rivalTeams).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddPlayer(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Crear scout
                </button>
                {rivalTeams.length === 0 && (
                  <button onClick={() => setShowAddTeam("rival")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition">
                    <Plus className="h-3.5 w-3.5" /> Añadir rival
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── SCOUTS RIVALES: quick team chips ── */}
          {view.kind === "scouts-rivales" && leagueRivalTeams.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => { setFilterTeamId(null); setSelectedPlayerId(null); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition border ${filterTeamId === null ? "bg-gray-900 text-white border-gray-900" : "text-gray-500 border-gray-200 hover:border-gray-400 bg-white"}`}
              >
                Todos
              </button>
              {leagueRivalTeams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setFilterTeamId(filterTeamId === t.id ? null : t.id); setSelectedPlayerId(null); }}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition border truncate max-w-[90px] ${filterTeamId === t.id ? "bg-orange-500 text-white border-orange-500" : "text-gray-500 border-gray-200 hover:border-orange-300 bg-white"}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {/* ── SEARCH ── */}
          {view.kind !== "rival" && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-orange-500 focus:ring-2 focus:ring-orange-100" />
            </div>
          )}
          {view.kind === "rival" && filterTeamId !== null && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugadora..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-orange-500 focus:ring-2 focus:ring-orange-100" />
            </div>
          )}

          {/* ── SCOUTS RIVALES: fallback team dropdown + importance ── */}
          {view.kind === "scouts-rivales" && !leagueRivalTeams.length && rivalTeams.length > 0 && (
            <select
              value={filterTeamId ?? ""}
              onChange={(e) => { setFilterTeamId(e.target.value ? Number(e.target.value) : null); setSelectedPlayerId(null); }}
              className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white outline-orange-500 cursor-pointer"
            >
              <option value="">Equipo rival</option>
              {rivalTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {view.kind === "scouts-rivales" && (
            <select
              value={filterImportancia}
              onChange={(e) => { setFilterImportancia(e.target.value); setSelectedPlayerId(null); }}
              className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white outline-orange-500 cursor-pointer"
            >
              <option value="">Importancia</option>
              {IMP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {view.kind === "rival" && filterTeamId === null ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <span className="text-4xl mb-3 block">👕</span>
              Selecciona un equipo rival<br />para ver su plantilla
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              {search ? "Sin resultados."
               : view.kind === "watchlist" ? "Añade jugadores a fichar con ★"
               : view.kind === "scouts-rivales" ? "Sin scouts. Usa ➕ Nuevo scout."
               : view.kind === "rival" ? "Sin jugadoras en este equipo. Usa ➕ Crear scout."
               : "Sin jugadores en esta vista."}
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
            playerHandedness={selectedPlayer.handedness}
            playerTeamName={selectedPlayer.teamName}
            playerTeamLogoUrl={selectedPlayer.teamLogoUrl}
            isWatchlisted={selectedPlayer.watchlisted ?? false}
            onCompare={() => setShowPicker(true)}
            onViewShotMap={() => { setView({ kind: "mapa-tiros", filterPlayerId: selectedPlayer.id }); setSelectedPlayerId(null); }}
          />
        )}
      </main>
      </>
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showAddTeam !== false && <AddTeamModal defaultType={showAddTeam} onClose={() => setShowAddTeam(false)} />}
      {showAddPlayer && (
        <AddPlayerModal
          teamId={
            (view.kind === "own" || view.kind === "rival") && view.teamId ? view.teamId
            : view.kind === "rival" && filterTeamId ? filterTeamId
            : undefined
          }
          forWatchlist={view.kind === "watchlist"}
          rivalTeams={rivalTeams}
          ownTeam={ownTeam}
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
