import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Shield, Users, Trophy, FileText, Calendar,
  Star, Video, BookOpen, UserCog, Settings, Menu, X, Crosshair,
  Swords, RefreshCw, LogOut, Zap, Plus,
  CheckCircle2, ChevronDown, ChevronUp, Trash2, Database,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScoutFlowLogo, ScoutFlowMark } from "@/components/logo";
import { useAuth } from "@/contexts/AuthContext";
import { useSeason, type Season } from "@/contexts/SeasonContext";
import { useWorkspace, type Workspace } from "@/contexts/WorkspaceContext";

// ─── Static season options (previous + current + 2 upcoming) ─────────────────
function buildSeasonOptions() {
  const current = new Date().getFullYear();
  const options: { id: string; name: string }[] = [];
  // current-2 = temporada pasada, current-1 = esta temporada, current/current+1 = futuras
  for (let y = current - 2; y <= current + 1; y++) {
    const short = String(y + 1).slice(2);
    options.push({ id: `${y}-${short}`, name: `${y}/${y + 1}` });
  }
  return options;
}
const SEASON_OPTIONS = buildSeasonOptions();

// ─── Nav groups ───────────────────────────────────────────────────────────────

const navGroups = [
  {
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Gestión",
    items: [
      { name: "Equipos",   href: "/equipos",   icon: Shield },
      { name: "Jugadores",   href: "/jugadores",       icon: Users },
      { name: "Base FEB",    href: "/liga-jugadores",  icon: Database },
      { name: "Fichajes",    href: "/fichajes",        icon: Star },
    ],
  },
  {
    label: "Contenido",
    items: [
      { name: "Vídeos",    href: "/videos",  icon: Video },
      { name: "Biblioteca", href: "/jugadas", icon: BookOpen },
    ],
  },
  {
    label: "Planificación",
    items: [
      { name: "Centro de Partido", href: "/match-center", icon: Crosshair },
      { name: "Partidos",          href: "/games",        icon: Trophy },
      { name: "Calendario",        href: "/calendar",     icon: Calendar },
    ],
  },
  {
    label: "Análisis",
    items: [
      { name: "Hub de Scouting", href: "/scouting", icon: Swords },
      { name: "Informes",        href: "/reports",  icon: FileText },
    ],
  },
  {
    label: "Admin",
    items: [
      { name: "Usuarios",       href: "/usuarios",   icon: UserCog },
      { name: "Sincronización", href: "/admin/sync", icon: RefreshCw },
      { name: "Ajustes",        href: "/ajustes",    icon: Settings },
    ],
  },
];

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
  item,
  location,
  onClick,
}: {
  item: { name: string; href: string; icon: React.ElementType; exact?: boolean };
  location: string;
  onClick?: () => void;
}) {
  const isActive = item.exact ? location === item.href : location.startsWith(item.href);
  return (
    <Link href={item.href}>
      <div
        onClick={onClick}
        className="flex gap-3 px-3 py-2 rounded-md transition-all cursor-pointer select-none justify-start items-start flex-row text-[color:var(--color-zinc-100)] bg-[color:var(--color-orange-600)]"
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">{item.name}</span>
      </div>
    </Link>
  );
}

// ─── API helpers (reuse from select-team logic) ───────────────────────────────

interface League { id: string; name: string; }
interface StatTeam { id: string | null; nombre: string; shortName: string | null; }

async function fetchLeagues(): Promise<League[]> {
  const res = await fetch("/api/ligas", { credentials: "include" });
  if (!res.ok) return [];
  const rows = await res.json() as Array<{ shortName: string; name: string }>;
  return rows.map((r) => ({ id: r.shortName, name: r.name }));
}

async function fetchTeams(leagueId: string, year?: number): Promise<StatTeam[]> {
  const url = year
    ? `/api/equipos/${encodeURIComponent(leagueId)}?year=${year}`
    : `/api/equipos/${encodeURIComponent(leagueId)}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json() as { equipos: StatTeam[] };
  return data.equipos;
}

// ─── WorkspaceBar ─────────────────────────────────────────────────────────────

// Calls PATCH /api/auth/select-team so stat_teams → teams table is synced
async function syncTeamContext(teamId: string, leagueShortName: string, qc: ReturnType<typeof useQueryClient>) {
  try {
    await fetch("/api/auth/select-team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ teamId, leagueShortName }),
    });
    // Refresh the Equipos page data
    await qc.invalidateQueries({ queryKey: ["/api/teams"] });
  } catch {
    // non-fatal
  }
}

function WorkspaceBar() {
  const { seasons, selectedSeason, setSelectedSeason } = useSeason();
  const { workspaces, activeId, activate, add, remove } = useWorkspace();
  const queryClient = useQueryClient();

  const [expanded, setExpanded]     = useState(false);
  const [adding,   setAdding]       = useState(false);

  // Form state
  const [fSeason,  setFSeason]  = useState("");
  const [fLeague,  setFLeague]  = useState("");
  const [fTeam,    setFTeam]    = useState("");

  const { data: leagues = [] } = useQuery<League[]>({
    queryKey: ["ws-leagues"],
    queryFn: fetchLeagues,
    enabled: adding,
    staleTime: 60_000,
  });

  const fSeasonYear = fSeason ? parseInt(fSeason.split("-")[0] ?? "0", 10) || undefined : undefined;

  const { data: teams = [], isLoading: teamsLoading } = useQuery<StatTeam[]>({
    queryKey: ["ws-teams", fLeague, fSeasonYear],
    queryFn: () => fetchTeams(fLeague, fSeasonYear),
    enabled: adding && fLeague !== "",
    staleTime: 60_000,
  });

  function handleActivate(ws: Workspace) {
    activate(ws.id);
    // Try API seasons first; fall back to a synthetic Season so SeasonContext always syncs
    const startYear = parseInt(ws.seasonId.split("-")[0] ?? "0") || 0;
    const s: Season =
      seasons.find((x) => x.id === ws.seasonId) ??
      seasons.find((x) => x.name === ws.seasonName) ??
      { id: ws.seasonId, name: ws.seasonName, isCurrent: false, startYear, endYear: startYear + 1 };
    setSelectedSeason(s);
    // Sync stat_teams → teams table so Equipos page updates
    void syncTeamContext(ws.teamId, ws.leagueId, queryClient);
  }

  function openAdd() {
    // Pre-select "esta temporada" = startYear of currentYear - 1 (e.g. 2025 → 2025/26)
    const currentYear = new Date().getFullYear();
    const defaultSeason =
      SEASON_OPTIONS.find((s) => s.id.startsWith(`${currentYear - 1}-`)) ??
      SEASON_OPTIONS[1] ??
      SEASON_OPTIONS[0];
    setFSeason(defaultSeason?.id ?? "");
    setFLeague("");
    setFTeam("");
    setAdding(true);
  }

  function handleSave() {
    if (!fSeason || !fLeague || !fTeam) return;
    const season = SEASON_OPTIONS.find((s) => s.id === fSeason);
    const league = leagues.find((l) => l.id === fLeague);
    const team   = teams.find((t) => (t.id ?? t.nombre) === fTeam);
    if (!season || !league || !team) return;
    const teamId = team.id ?? team.nombre;
    add({
      seasonId:   season.id,
      seasonName: season.name,
      leagueId:   league.id,
      leagueName: league.name,
      teamId,
      teamName:   team.nombre,
    });
    // Sync stat_teams → teams table so Equipos page updates immediately
    void syncTeamContext(teamId, league.id, queryClient);
    setAdding(false);
  }

  const activeWs = workspaces.find((w) => w.id === activeId);

  return (
    <div className="border-b border-sidebar-border">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
          Contexto de trabajo
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={openAdd}
            title="Añadir contexto"
            className="text-sidebar-foreground/40 hover:text-primary transition-colors"
          >
            <Plus size={13} />
          </button>
          {workspaces.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-sidebar-foreground/30 hover:text-sidebar-foreground/60 transition-colors"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Active workspace pill */}
      {activeWs && !expanded && !adding && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setExpanded(true)}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2.5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all text-left group"
          >
            <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-gray-800 truncate">{activeWs.teamName}</div>
              <div className="text-[10px] text-gray-400 truncate">
                {activeWs.seasonName} · {activeWs.leagueName}
              </div>
            </div>
            <ChevronDown size={12} className="text-gray-400 group-hover:text-primary transition-colors shrink-0" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {!adding && workspaces.length === 0 && (
        <div className="px-3 pb-2">
          <button
            onClick={openAdd}
            className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2.5 flex items-center gap-2 text-gray-400 hover:border-primary/50 hover:text-primary transition-all text-[11px] font-medium"
          >
            <Plus size={12} /> Añadir contexto de trabajo
          </button>
        </div>
      )}

      {/* Expanded list */}
      {expanded && !adding && workspaces.length > 0 && (
        <div className="mx-3 mb-2 bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cambiar contexto</span>
            <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronUp size={12} />
            </button>
          </div>
          <div className="py-1">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeId;
              return (
                <div
                  key={ws.id}
                  className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer group transition-colors ${
                    isActive ? "bg-primary/5" : "hover:bg-gray-50"
                  }`}
                  onClick={() => { handleActivate(ws); setExpanded(false); }}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-primary" : "bg-gray-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] font-bold truncate ${isActive ? "text-primary" : "text-gray-700"}`}>{ws.teamName}</div>
                    <div className="text-[10px] text-gray-400 truncate">{ws.seasonName} · {ws.leagueName}</div>
                  </div>
                  {isActive && <CheckCircle2 size={13} className="text-primary shrink-0" />}
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(ws.id); }}
                    title="Eliminar"
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0 ml-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-gray-100">
            <button
              onClick={() => { setExpanded(false); openAdd(); }}
              className="w-full flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={12} /> Nuevo contexto
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="mx-3 mb-3 bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Nuevo contexto</span>
          </div>
          <div className="p-3 space-y-2">
            {/* Season */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Temporada</label>
              <select
                value={fSeason}
                onChange={(e) => { setFSeason(e.target.value); setFTeam(""); }}
                className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              >
                <option value="">— Temporada —</option>
                {SEASON_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* League */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Liga</label>
              <select
                value={fLeague}
                onChange={(e) => { setFLeague(e.target.value); setFTeam(""); }}
                className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              >
                <option value="">— Liga —</option>
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Team */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Equipo</label>
              <select
                value={fTeam}
                onChange={(e) => setFTeam(e.target.value)}
                disabled={!fLeague || teamsLoading || !fSeason}
                className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">
                  {teamsLoading ? "Cargando…" : !fSeason ? "— Elige temporada primero —" : fLeague ? "— Equipo —" : "— Elige liga primero —"}
                </option>
                {teams.map((t) => {
                  const id = t.id ?? t.nombre;
                  return <option key={id} value={id}>{t.nombre}</option>;
                })}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={!fSeason || !fLeague || !fTeam}
                className="flex-1 text-[12px] font-bold bg-primary text-white rounded-lg px-3 py-2 disabled:opacity-40 hover:bg-primary/90 transition-colors shadow-sm"
              >
                Guardar
              </button>
              <button
                onClick={() => setAdding(false)}
                className="flex-1 text-[12px] font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UserFooter ───────────────────────────────────────────────────────────────

function UserFooter({ onNavClick }: { onNavClick?: () => void }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = (user.name ?? user.email)
    .split(" ")
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <div className="px-3 py-3 border-t border-sidebar-border">
      <div className="flex items-center gap-2.5">
        <Link href="/mi-cuenta">
          <div
            onClick={onNavClick}
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="text-xs font-medium truncate">{user.name ?? user.email}</div>
                {user.subscriptionTier === "professional" && (
                  <Zap size={10} className="text-amber-400 shrink-0" />
                )}
              </div>
              <div className="text-[10px] text-sidebar-foreground/50 truncate capitalize">
                {user.subscriptionTier === "professional" ? "Profesional" : "Amateur"}
              </div>
            </div>
          </div>
        </Link>
        <button
          onClick={() => logout()}
          title="Cerrar sesión"
          className="text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-colors shrink-0"
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── SidebarContent ───────────────────────────────────────────────────────────

function SidebarContent({ location, onNavClick }: { location: string; onNavClick?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center px-5 border-b border-sidebar-border shrink-0">
        <Link href="/">
          <div className="cursor-pointer">
            <ScoutFlowLogo size="md" />
          </div>
        </Link>
      </div>
      <WorkspaceBar />
      <div className="flex-1 overflow-y-auto py-3">
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && (
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest bg-[color:var(--color-orange-600)] text-[color:var(--color-zinc-100)] border-t-[color:var(--color-zinc-100)] border-r-[color:var(--color-zinc-100)] border-b-[color:var(--color-zinc-100)] border-l-[color:var(--color-zinc-100)]">
                {group.label}
              </div>
            )}
            <div className="px-2 space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.href} item={item} location={location} onClick={onNavClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <UserFooter onNavClick={onNavClick} />
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <ScoutFlowMark size={26} />
          <span className="text-lg font-black tracking-tight leading-none">
            <span className="text-foreground">Scout</span><span className="text-primary">Flow</span>
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-sidebar z-40 overflow-y-auto">
          <SidebarContent location={location} onNavClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="hidden md:flex w-52 flex-col fixed inset-y-0 left-0 bg-sidebar border-r border-sidebar-border z-30">
        <SidebarContent location={location} />
      </div>

      <div className="flex-1 md:ml-52 mt-14 md:mt-0">
        <main className="min-h-screen p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
