import { useMemo, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useListGames, getListGamesQueryKey,
  useListReports, getListReportsQueryKey,
  useListTeams, getListTeamsQueryKey,
} from "@workspace/api-client-react";
import {
  Bell, Trophy, ChevronRight, Clock, Video, FileText, Shield, Users,
  Star, Zap, CheckCircle2, Circle, Target, Calendar, ArrowRight, Plus,
  Swords, BarChart2, MapPin, TrendingUp,
} from "lucide-react";
import { DIFFICULTY_LABEL } from "@/lib/difficulty";

// ── Circular progress ring ────────────────────────────────────────────────────
function CircularProgress({ percent }: { percent: number }) {
  const r = 50;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  const color = percent >= 75 ? "#22c55e" : percent >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center">
      <svg width="130" height="130" viewBox="0 0 130 130" className="-rotate-90">
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={r} fill="none" stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.7s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white">{percent}%</span>
        <span className="text-[9px] text-white/40 uppercase tracking-widest">General</span>
      </div>
    </div>
  );
}

// ── Difficulty chip ───────────────────────────────────────────────────────────
function DiffChip({ diff }: { diff: string | null | undefined }) {
  if (!diff) return null;
  const map: Record<string, string> = {
    facil: "bg-green-500/20 text-green-400 border-green-500/30",
    medio: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    importante: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const labels: Record<string, string> = { facil: "Fácil", medio: "Media", importante: "Difícil" };
  return (
    <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${map[diff] ?? "bg-white/5 text-white/40 border-white/10"}`}>
      {labels[diff] ?? diff}
    </span>
  );
}

// ── Team badge ────────────────────────────────────────────────────────────────
function TeamBadge({
  name, logoUrl, sub, size = "lg",
}: { name: string; logoUrl?: string | null; sub: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const sz = size === "lg" ? "h-20 w-20 text-xl" : size === "md" ? "h-14 w-14 text-base" : "h-9 w-9 text-xs";
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <div className={`${sz} rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0`}>
        {logoUrl
          ? <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
          : <span className="font-black text-primary">{initials}</span>}
      </div>
      <div className="text-center">
        <div className="font-black text-white text-sm uppercase leading-tight truncate max-w-[80px]">{name}</div>
        <div className="text-[10px] text-white/30 uppercase tracking-widest">{sub}</div>
      </div>
    </div>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function daysUntil(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.max(0, Math.floor((new Date(y, m - 1, d, 23, 59, 59).getTime() - Date.now()) / 86_400_000));
}
function fmtLong(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtShort(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// ── Preparation checklist (localStorage) ─────────────────────────────────────
const CHECK_KEY = "sf-prep-checklist-v2";
type Checks = { scouting: boolean; videos: boolean; informe: boolean; charla: boolean };
const DEFAULT_CHECKS: Checks = { scouting: false, videos: false, informe: false, charla: false };

function useChecklist() {
  const [checks, setChecks] = useState<Checks>(() => {
    try { return { ...DEFAULT_CHECKS, ...(JSON.parse(localStorage.getItem(CHECK_KEY) ?? "{}") as Partial<Checks>) }; }
    catch { return DEFAULT_CHECKS; }
  });
  const toggle = useCallback((k: keyof Checks) => {
    setChecks((c) => {
      const next = { ...c, [k]: !c[k] };
      localStorage.setItem(CHECK_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const percent = Math.round((Object.values(checks).filter(Boolean).length / 4) * 100);
  return { checks, toggle, percent };
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────
const P = "rounded-2xl border border-white/[0.07] p-5";
function SectionLabel({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 mb-4`}>
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      <span className={`text-[11px] font-black uppercase tracking-widest ${color}`}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: games } = useListGames({ query: { queryKey: getListGamesQueryKey() } });
  const { data: reports } = useListReports(undefined, { query: { queryKey: getListReportsQueryKey() } });
  const { data: teams } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });
  const { checks, toggle, percent } = useChecklist();

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const ownTeam = useMemo(() => (teams ?? []).find((t) => t.teamType === "own"), [teams]);
  const ownNameLower = ownTeam?.name.toLowerCase() ?? "";

  const teamByName = useMemo(() => {
    const m: Record<string, NonNullable<typeof teams>[0]> = {};
    (teams ?? []).forEach((t) => { m[t.name.toLowerCase()] = t; });
    return m;
  }, [teams]);

  const upcomingGames = useMemo(
    () => (games ?? []).filter((g) => g.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date)),
    [games, todayKey],
  );
  const nextGame = upcomingGames[0] ?? null;

  const rivalInfo = useMemo(() => {
    if (!nextGame) return null;
    const homeL = nextGame.homeTeam.toLowerCase();
    const awayL = nextGame.awayTeam.toLowerCase();
    const rivalName = homeL === ownNameLower ? nextGame.awayTeam : nextGame.homeTeam;
    const rivalL = homeL === ownNameLower ? awayL : homeL;
    const rival = teamByName[rivalL] ?? null;
    return { name: rivalName, id: rival?.id ?? null, logoUrl: rival?.logoUrl ?? null, team: rival };
  }, [nextGame, ownNameLower, teamByName]);

  // Season stats
  const season = useMemo(() => {
    if (!ownNameLower) return { wins: 0, losses: 0, streak: "" as "W" | "L" | "", streakN: 0, pct: 0, lastFive: [] as ("W" | "L")[] };
    const past = (games ?? [])
      .filter((g) => g.date < todayKey && g.homeScore != null && g.awayScore != null
        && (g.homeTeam.toLowerCase() === ownNameLower || g.awayTeam.toLowerCase() === ownNameLower))
      .sort((a, b) => b.date.localeCompare(a.date));
    let wins = 0, losses = 0;
    const res: ("W" | "L")[] = [];
    for (const g of past) {
      const isHome = g.homeTeam.toLowerCase() === ownNameLower;
      const mine = isHome ? g.homeScore! : g.awayScore!;
      const theirs = isHome ? g.awayScore! : g.homeScore!;
      const w = mine > theirs;
      if (w) wins++; else losses++;
      res.push(w ? "W" : "L");
    }
    let streak: "W" | "L" | "" = "", streakN = 0;
    for (const r of res) {
      if (!streak) { streak = r; streakN = 1; }
      else if (r === streak) streakN++;
      else break;
    }
    const total = wins + losses;
    return { wins, losses, streak, streakN, pct: total > 0 ? Math.round((wins / total) * 100) : 0, lastFive: res.slice(0, 5) };
  }, [games, todayKey, ownNameLower]);

  // Rival recent results
  const rivalResults = useMemo(() => {
    if (!rivalInfo) return [];
    const rL = rivalInfo.name.toLowerCase();
    return (games ?? [])
      .filter((g) => g.date < todayKey && g.homeScore != null
        && (g.homeTeam.toLowerCase() === rL || g.awayTeam.toLowerCase() === rL))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map((g) => {
        const isHome = g.homeTeam.toLowerCase() === rL;
        return (isHome ? g.homeScore! : g.awayScore!) > (isHome ? g.awayScore! : g.homeScore!) ? "W" as const : "L" as const;
      });
  }, [games, todayKey, rivalInfo]);

  // Alerts
  const alerts = useMemo(() => {
    const list: { icon: React.ElementType; title: string; desc: string; cls: string; href: string }[] = [];
    if (!checks.informe && nextGame) {
      const d = daysUntil(nextGame.date);
      if (d <= 5) list.push({ icon: FileText, title: "Informe pendiente", desc: `${nextGame.homeTeam} vs ${nextGame.awayTeam}`, cls: "text-orange-400", href: "/reports/new" });
    }
    if (!checks.videos && nextGame && daysUntil(nextGame.date) <= 5) {
      list.push({ icon: Video, title: "Vídeos pendientes", desc: "2 vídeos sin revisar", cls: "text-purple-400", href: "/videos" });
    }
    if (!ownTeam) {
      list.push({ icon: Shield, title: "Sin equipo propio", desc: "Marca un equipo como Mi Equipo", cls: "text-blue-400", href: "/equipos" });
    }
    if ((reports ?? []).length === 0) {
      list.push({ icon: TrendingUp, title: "Sin informes", desc: "Crea el primer informe de scouting", cls: "text-green-400", href: "/reports/new" });
    }
    return list;
  }, [checks, nextGame, ownTeam, reports]);

  const checkItems: { key: keyof Checks; label: string }[] = [
    { key: "scouting", label: "Scouting completado" },
    { key: "videos", label: "Vídeos revisados" },
    { key: "informe", label: "Informe generado" },
    { key: "charla", label: "Charla preparada" },
  ];

  const quickLinks = [
    { href: "/scout", icon: Target, label: "Nuevo Scouting", sub: "Analiza a tu rival", iconCls: "text-orange-400", bg: "bg-orange-500/10" },
    { href: "/videos", icon: Video, label: "Vídeos", sub: "Gestiona tus vídeos", iconCls: "text-purple-400", bg: "bg-purple-500/10" },
    { href: "/jugadores", icon: Users, label: "Jugadores", sub: "Gestiona jugadores", iconCls: "text-blue-400", bg: "bg-blue-500/10" },
    { href: "/fichajes", icon: Star, label: "Fichajes", sub: "Busca y sigue talento", iconCls: "text-amber-400", bg: "bg-amber-500/10" },
    { href: "/calendar", icon: Calendar, label: "Calendario", sub: "Partidos y eventos", iconCls: "text-cyan-400", bg: "bg-cyan-500/10" },
    { href: "/reports", icon: FileText, label: "Informes", sub: "Genera tus informes", iconCls: "text-green-400", bg: "bg-green-500/10" },
  ];

  return (
    <div className="space-y-4 max-w-[1440px]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">¡Hola, Entrenador!</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Todo listo para preparar el próximo partido</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition">
              <Bell className="h-4 w-4" />
            </button>
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full text-[9px] font-black text-primary-foreground flex items-center justify-center leading-none">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> Temporada 2024/25
          </div>
        </div>
      </div>

      {/* ── ROW 1: Próximo Partido · Preparación · Alertas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">

        {/* ── Próximo Partido (4/10) ── */}
        <div className={`${P} lg:col-span-4 bg-card`}>
          <SectionLabel icon={Trophy} label="Próximo Partido" color="text-primary" />
          {!nextGame ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <Trophy className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No hay partidos próximos programados</p>
              <Link href="/games/new">
                <button className="text-xs bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl hover:bg-primary/90 transition flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Registrar partido
                </button>
              </Link>
            </div>
          ) : (
            <>
              {/* Team logos */}
              <div className="flex items-center justify-around gap-2 mb-5">
                <TeamBadge name={nextGame.homeTeam} logoUrl={teamByName[nextGame.homeTeam.toLowerCase()]?.logoUrl ?? null} sub="Local" />
                <div className="text-center shrink-0">
                  <div className="text-xl font-black text-muted-foreground/20 tracking-widest">VS</div>
                </div>
                <TeamBadge name={nextGame.awayTeam} logoUrl={teamByName[nextGame.awayTeam.toLowerCase()]?.logoUrl ?? null} sub="Visitante" />
              </div>

              {/* Game meta */}
              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                  <span className="capitalize">{fmtLong(nextGame.date)}</span>
                </div>
                {nextGame.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                    {nextGame.location}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                    <span className="text-foreground">
                      <span className="text-2xl font-black text-primary">{daysUntil(nextGame.date)}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">días restantes</span>
                    </span>
                  </div>
                  <DiffChip diff={nextGame.difficulty} />
                </div>
              </div>

              {/* Difficulty stars */}
              {nextGame.difficulty && (
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const lvls: Record<string, number> = { facil: 2, medio: 3, importante: 5 };
                    const filled = lvls[nextGame.difficulty!] ?? 0;
                    return <Star key={i} className={`h-3.5 w-3.5 ${i <= filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />;
                  })}
                  <span className="ml-1 text-xs text-muted-foreground capitalize">
                    {DIFFICULTY_LABEL[nextGame.difficulty] ?? nextGame.difficulty}
                  </span>
                </div>
              )}

              {/* CTA */}
              <Link href={`/games/${nextGame.id}/match-center`}>
                <button className="w-full bg-primary hover:bg-primary/90 transition text-primary-foreground font-black py-3.5 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wide text-sm shadow-lg shadow-primary/20">
                  Abrir Centro de Partido <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </>
          )}
        </div>

        {/* ── Estado de Preparación (4/10) ── */}
        <div className={`${P} lg:col-span-4 bg-card`}>
          <SectionLabel icon={Target} label="Estado de Preparación" color="text-green-400" />
          <div className="flex flex-col items-center gap-4">
            <CircularProgress percent={percent} />
            <div className="w-full space-y-1">
              {checkItems.map(({ key, label }) => (
                <button key={key} onClick={() => toggle(key)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition group text-left">
                  {checks[key]
                    ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 transition" />}
                  <span className={`text-sm flex-1 ${checks[key] ? "text-muted-foreground line-through" : "text-foreground/80"}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <button className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1">
              Ver checklist completo <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* ── Alertas (2/10) ── */}
        <div className={`${P} lg:col-span-2 bg-card`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-red-400" />
              <span className="text-[11px] font-black text-red-400 uppercase tracking-widest">Alertas</span>
            </div>
            {alerts.length > 0 && (
              <span className="h-5 w-5 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">{alerts.length}</span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-400/40" />
              <span className="text-xs text-muted-foreground text-center">Todo al día</span>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, i) => {
                const Icon = a.icon;
                return (
                  <Link key={i} href={a.href}>
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border hover:border-primary/30 transition cursor-pointer group">
                      <Icon className={`h-4 w-4 ${a.cls} shrink-0 mt-0.5`} />
                      <div className="min-w-0">
                        <div className={`text-xs font-bold ${a.cls} group-hover:underline`}>{a.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">{a.desc}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          {alerts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <button className="text-[11px] text-muted-foreground hover:text-primary transition flex items-center gap-1">
                Ver todas <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 2: Accesos Rápidos ── */}
      <div className={`${P} bg-card`}>
        <SectionLabel icon={Zap} label="Accesos Rápidos" color="text-amber-400" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {quickLinks.map(({ href, icon: Icon, label, sub, iconCls, bg }) => (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-muted/30 border border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all group">
                <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${iconCls}`} />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-foreground/80 group-hover:text-foreground transition leading-tight">{label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight hidden sm:block">{sub}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── ROW 3: Rival de la Semana · Resumen de Temporada ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Rival de la Semana ── */}
        <div className={`${P} bg-card`}>
          <SectionLabel icon={Swords} label="Rival de la Semana" color="text-red-400" />
          {!rivalInfo ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Sin próximo partido registrado</div>
          ) : (
            <>
              {/* Rival header */}
              <div className="flex items-center gap-4 mb-5">
                <div className="h-16 w-16 rounded-2xl overflow-hidden bg-muted border border-border flex items-center justify-center shrink-0">
                  {rivalInfo.logoUrl
                    ? <img src={rivalInfo.logoUrl} alt={rivalInfo.name} className="h-full w-full object-cover" />
                    : <span className="font-black text-primary text-xl">{rivalInfo.name.slice(0, 2).toUpperCase()}</span>}
                </div>
                <div>
                  <div className="font-black text-foreground text-2xl uppercase leading-tight">{rivalInfo.name}</div>
                  {nextGame && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {fmtShort(nextGame.date)}
                      </span>
                      <DiffChip diff={nextGame.difficulty} />
                    </div>
                  )}
                </div>
              </div>

              {/* Rival's last 5 results */}
              {rivalResults.length > 0 && (
                <div className="mb-5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Últimos {rivalResults.length} Partidos</div>
                  <div className="flex gap-2">
                    {rivalResults.map((r, i) => (
                      <div key={i} className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black border ${
                        r === "W"
                          ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : "bg-red-500/15 text-red-400 border-red-500/30"
                      }`}>{r}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fortalezas / Debilidades */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl bg-green-500/5 border border-green-500/15 p-3">
                  <div className="text-[10px] text-green-400 font-black uppercase tracking-widest mb-2">Fortalezas</div>
                  {rivalInfo.team
                    ? <Link href={`/teams/${rivalInfo.team.id}`}><span className="text-xs text-muted-foreground hover:text-primary cursor-pointer transition">Ver análisis del equipo →</span></Link>
                    : <span className="text-xs text-muted-foreground/50">Añade el equipo para ver análisis</span>}
                </div>
                <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3">
                  <div className="text-[10px] text-red-400 font-black uppercase tracking-widest mb-2">Debilidades</div>
                  <Link href="/reports/new">
                    <span className="text-xs text-muted-foreground hover:text-primary cursor-pointer transition">Generar informe →</span>
                  </Link>
                </div>
              </div>

              <Link href={rivalInfo.id ? `/teams/${rivalInfo.id}` : "/scout"}>
                <button className="w-full py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-foreground/20 transition flex items-center justify-center gap-1.5">
                  Ver Scouting Completo <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </>
          )}
        </div>

        {/* ── Resumen de Temporada ── */}
        <div className={`${P} bg-card`}>
          <SectionLabel icon={BarChart2} label="Resumen de Temporada" color="text-blue-400" />
          {!ownTeam ? (
            <div className="py-10 text-center space-y-3">
              <Shield className="h-10 w-10 mx-auto text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Marca un equipo como "Mi Equipo" para ver estadísticas de temporada</p>
              <Link href="/equipos">
                <button className="text-xs bg-card border border-border px-4 py-2 rounded-xl hover:border-primary/50 transition">Ver equipos</button>
              </Link>
            </div>
          ) : (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Victorias", value: String(season.wins), cls: "text-green-400" },
                  { label: "Derrotas", value: String(season.losses), cls: "text-red-400" },
                  { label: "Racha", value: season.streak ? `${season.streak} ${season.streakN}` : "—", cls: season.streak === "W" ? "text-green-400" : season.streak === "L" ? "text-red-400" : "text-muted-foreground" },
                  { label: "% Victorias", value: `${season.pct}%`, cls: "text-foreground" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="text-center">
                    <div className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${cls}`}>{label}</div>
                    <div className={`text-2xl font-black ${cls}`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Win rate bar */}
              {(season.wins + season.losses) > 0 && (
                <div className="mb-5">
                  <div className="h-2 rounded-full bg-red-500/20 overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${season.pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span className="text-green-400/70">{season.wins} victorias</span>
                    <span className="text-red-400/70">{season.losses} derrotas</span>
                  </div>
                </div>
              )}

              {/* Upcoming games */}
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Próximos Partidos</div>
                {upcomingGames.length === 0 ? (
                  <div className="text-xs text-muted-foreground/50 py-3 text-center">Sin partidos programados</div>
                ) : (
                  <div className="space-y-1.5">
                    {upcomingGames.slice(0, 4).map((g) => (
                      <Link key={g.id} href={`/games/${g.id}/edit`}>
                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border hover:border-primary/30 cursor-pointer transition group">
                          <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Shield className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-foreground/80 group-hover:text-foreground transition truncate">{g.homeTeam} vs {g.awayTeam}</div>
                            <div className="text-[10px] text-muted-foreground">{fmtShort(g.date)}{g.location ? ` · ${g.location}` : ""}</div>
                          </div>
                          {g.difficulty && <DiffChip diff={g.difficulty} />}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                <Link href="/calendar">
                  <button className="mt-3 w-full py-2 text-xs text-muted-foreground hover:text-primary transition flex items-center justify-center gap-1">
                    Ver Calendario Completo <ChevronRight className="h-3 w-3" />
                  </button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
