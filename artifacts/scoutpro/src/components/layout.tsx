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

// ─── Static season options (last 3 seasons + upcoming) ───────────────────────
function buildSeasonOptions() {
  const current = new Date().getFullYear();
  const options: { id: string; name: string }[] = [];
  for (let y = current - 3; y <= current; y++) {
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
        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all cursor-pointer select-none ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        }`}
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

async function fetchTeams(leagueId: string): Promise<StatTeam[]> {
  const res = await fetch(`/api/equipos/${encodeURIComponent(leagueId)}`, { credentials: "include" });
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

  const { data: teams = [], isLoading: teamsLoading } = useQuery<StatTeam[]>({
    queryKey: ["ws-teams", fLeague],
    queryFn: () => fetchTeams(fLeague),
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
    // Pre-select the most recent season option
    setFSeason(SEASON_OPTIONS[SEASON_OPTIONS.length - 1]?.id ?? "");
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
          <div className="bg-sidebar-accent/60 rounded-md px-2 py-1.5 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium truncate">{activeWs.teamName}</div>
              <div className="text-[9px] text-sidebar-foreground/40 truncate">
                {activeWs.seasonName} · {activeWs.leagueName}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded list */}
      {expanded && !adding && workspaces.length > 0 && (
        <div className="px-2 pb-2 space-y-0.5">
          {workspaces.map((ws) => {
            const isActive = ws.id === activeId;
            return (
              <div
                key={ws.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer group transition-colors ${
                  isActive
                    ? "bg-primary/15 text-sidebar-foreground"
                    : "hover:bg-sidebar-accent/60 text-sidebar-foreground/70"
                }`}
                onClick={() => { handleActivate(ws); setExpanded(false); }}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-primary" : "bg-sidebar-foreground/20"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium truncate">{ws.teamName}</div>
                  <div className="text-[9px] text-sidebar-foreground/40 truncate">
                    {ws.seasonName} · {ws.leagueName}
                  </div>
                </div>
                {isActive && <CheckCircle2 size={11} className="text-primary shrink-0" />}
                <button
                  onClick={(e) => { e.stopPropagation(); remove(ws.id); }}
                  title="Eliminar"
                  className="opacity-0 group-hover:opacity-100 text-sidebar-foreground/30 hover:text-red-400 transition-all shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!adding && workspaces.length === 0 && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-sidebar-foreground/30 italic">Sin contextos guardados</p>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="px-3 pb-3 space-y-1.5">
          {/* Season */}
          <select
            value={fSeason}
            onChange={(e) => setFSeason(e.target.value)}
            className="w-full text-xs bg-sidebar-accent/60 border border-sidebar-border rounded px-2 py-1 text-sidebar-foreground outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="">— Temporada —</option>
            {SEASON_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* League */}
          <select
            value={fLeague}
            onChange={(e) => { setFLeague(e.target.value); setFTeam(""); }}
            className="w-full text-xs bg-sidebar-accent/60 border border-sidebar-border rounded px-2 py-1 text-sidebar-foreground outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="">— Liga —</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          {/* Team */}
          <select
            value={fTeam}
            onChange={(e) => setFTeam(e.target.value)}
            disabled={!fLeague || teamsLoading}
            className="w-full text-xs bg-sidebar-accent/60 border border-sidebar-border rounded px-2 py-1 text-sidebar-foreground outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-40"
          >
            <option value="">
              {teamsLoading ? "Cargando…" : fLeague ? "— Equipo —" : "— Elige liga primero —"}
            </option>
            {teams.map((t) => {
              const id = t.id ?? t.nombre;
              return <option key={id} value={id}>{t.nombre}</option>;
            })}
          </select>

          {/* Buttons */}
          <div className="flex gap-1.5 pt-0.5">
            <button
              onClick={handleSave}
              disabled={!fSeason || !fLeague || !fTeam}
              className="flex-1 text-[11px] font-medium bg-primary text-primary-foreground rounded px-2 py-1 disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Guardar
            </button>
            <button
              onClick={() => setAdding(false)}
              className="flex-1 text-[11px] text-sidebar-foreground/60 border border-sidebar-border rounded px-2 py-1 hover:bg-sidebar-accent/40 transition-colors"
            >
              Cancelar
            </button>
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
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">
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
