import { useMemo, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useListGames,
  getListGamesQueryKey,
  useListReports,
  getListReportsQueryKey,
  useListTeams,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Shield, FileText, TrendingUp, Trophy, Calendar,
  Plus, ChevronRight, Clock, Upload, Star, Video, Dumbbell,
} from "lucide-react";
import { DIFFICULTY_BADGE, DIFFICULTY_LABEL } from "@/lib/difficulty";

function Countdown({ targetDate }: { targetDate: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const [y, m, d] = targetDate.split("-").map(Number);
  const target = new Date(y, m - 1, d, 23, 59, 59);
  const diffMs = target.getTime() - new Date().getTime();
  if (diffMs <= 0) return <span className="text-primary font-display">¡Hoy!</span>;
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (days === 0) return <span className="font-display text-primary">{hours}h</span>;
  if (days === 1) return <span className="font-display text-primary">Mañana</span>;
  return <span className="font-display text-primary">{days}d {hours}h</span>;
}

function DifficultyStars({ difficulty }: { difficulty: string | null | undefined }) {
  const levels: Record<string, number> = { facil: 1, medio: 3, importante: 5 };
  const filled = difficulty ? (levels[difficulty] ?? 0) : 0;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function TeamBadge({ name, logoUrl, sub }: { name: string; logoUrl?: string | null; sub: string }) {
  const initials = name.split(" ").map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-2 flex-1 text-center">
      <div className="h-16 w-16 rounded-2xl overflow-hidden bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-primary text-lg">{initials}</span>
        )}
      </div>
      <div>
        <div className="font-display text-sm uppercase tracking-wide leading-tight">{name}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{sub}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const { data: games } = useListGames({ query: { queryKey: getListGamesQueryKey() } });
  const { data: reports } = useListReports(undefined, { query: { queryKey: getListReportsQueryKey() } });
  const { data: teams } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const todayLabel = now.toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const upcomingGames = useMemo(
    () => (games ?? []).filter((g) => g.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date)),
    [games, todayKey],
  );
  const nextGame = upcomingGames[0];
  const moreGames = upcomingGames.slice(1, 5);

  const teamLogoMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    (teams ?? []).forEach((t) => { m[t.name.toLowerCase()] = t.logoUrl ?? null; });
    return m;
  }, [teams]);

  const recentReport = reports?.[0];
  const daysAgo = recentReport?.date
    ? Math.floor((now.getTime() - new Date(recentReport.date).getTime()) / 86_400_000)
    : null;

  const topPlayer = useMemo(() => {
    if (!reports || reports.length === 0) return null;
    return [...reports].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  }, [reports]);

  const ownTeam = useMemo(() => (teams ?? []).find((t) => t.teamType === "own"), [teams]);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-4xl font-display tracking-wide">Dashboard</h1>
          <p className="text-muted-foreground capitalize text-sm">{todayLabel}</p>
        </div>
        <Link href="/reports/new">
          <Button className="font-display tracking-wide uppercase">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Informe
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Jugadores", value: summary?.totalPlayers ?? 0, icon: Users },
            { label: "Equipos", value: summary?.totalTeams ?? 0, icon: Shield },
            { label: "Informes", value: summary?.totalReports ?? 0, icon: FileText },
            { label: "Rating Promedio", value: summary?.avgRating != null ? summary.avgRating.toFixed(1) : "—", icon: TrendingUp, accent: true },
          ].map(({ label, value, icon: Icon, accent }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-3xl font-display leading-none ${accent ? "text-primary" : ""}`}>{value}</p>
                  </div>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${accent ? "bg-primary/10" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main row: Próximo Partido + Right column */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Próximo Partido */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" /> Próximo Partido
            </CardTitle>
            {nextGame?.difficulty && <DifficultyStars difficulty={nextGame.difficulty} />}
          </CardHeader>
          <CardContent>
            {!nextGame ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Trophy className="h-10 w-10 mb-3 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground mb-4">No hay partidos próximos programados</p>
                <Link href="/games/new">
                  <Button variant="outline" size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> Registrar partido</Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-around gap-3 py-4">
                  <TeamBadge
                    name={nextGame.homeTeam}
                    logoUrl={teamLogoMap[nextGame.homeTeam.toLowerCase()]}
                    sub="Local"
                  />
                  <div className="text-center shrink-0 space-y-1">
                    <div className="font-display text-3xl text-muted-foreground/30 tracking-wider">VS</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <Countdown targetDate={nextGame.date} />
                    </div>
                  </div>
                  <TeamBadge
                    name={nextGame.awayTeam}
                    logoUrl={teamLogoMap[nextGame.awayTeam.toLowerCase()]}
                    sub="Visitante"
                  />
                </div>
                <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">
                      {new Date(nextGame.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                    </div>
                    {nextGame.location && <div className="text-xs text-muted-foreground mt-0.5">{nextGame.location}</div>}
                    {nextGame.difficulty && (
                      <span className={`mt-1 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_BADGE[nextGame.difficulty] ?? "bg-muted text-muted-foreground"}`}>
                        {DIFFICULTY_LABEL[nextGame.difficulty] ?? nextGame.difficulty}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/games/${nextGame.id}/edit`}>
                      <Button size="sm" variant="outline" className="text-xs">Editar</Button>
                    </Link>
                    <Link href="/reports/new">
                      <Button size="sm" className="font-display uppercase tracking-wide text-xs">
                        <FileText className="mr-1.5 h-3.5 w-3.5" /> Informe
                      </Button>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right column: Último Informe + Rival de la Semana */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Último Informe */}
          <Card className="flex-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Último Informe
              </CardTitle>
              <Link href="/reports">
                <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                  Ver todos <ChevronRight className="h-3 w-3" />
                </span>
              </Link>
            </CardHeader>
            <CardContent>
              {!recentReport ? (
                <div className="py-4 text-center text-muted-foreground text-sm">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                  Sin informes todavía
                </div>
              ) : (
                <Link href={`/reports/${recentReport.id}`}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{recentReport.playerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {daysAgo === 0 ? "Hoy" : daysAgo === 1 ? "Ayer" : `Hace ${daysAgo} días`}
                        {recentReport.scoutName ? ` · ${recentReport.scoutName}` : ""}
                      </div>
                    </div>
                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center font-display text-primary text-sm shrink-0">
                      {recentReport.rating}
                    </div>
                  </div>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Rival de la Semana */}
          <Card className="flex-1">
            <CardHeader className="pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Rival de la Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!nextGame ? (
                <div className="py-4 text-center text-muted-foreground text-sm">Sin próximo partido</div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {teamLogoMap[nextGame.awayTeam.toLowerCase()] ? (
                        <img src={teamLogoMap[nextGame.awayTeam.toLowerCase()]!} alt="" className="h-full w-full object-cover rounded-lg" />
                      ) : (
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{nextGame.awayTeam}</div>
                      <div className="text-[11px] text-muted-foreground">Próximo rival · {nextGame.date}</div>
                    </div>
                  </div>
                  <Link href="/equipos">
                    <Button size="sm" variant="outline" className="w-full text-xs font-display uppercase tracking-wide mt-1">
                      Ver análisis del equipo <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Accesos Rápidos */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Accesos Rápidos</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { href: "/equipos", icon: Shield, label: "Equipos", color: "text-blue-500", bg: "bg-blue-500/10" },
            { href: "/videos", icon: Video, label: "Vídeos", color: "text-purple-500", bg: "bg-purple-500/10" },
            { href: "/reports/new", icon: FileText, label: "Nuevo Informe", color: "text-green-500", bg: "bg-green-500/10" },
            { href: "/players/new", icon: Users, label: "Nuevo Jugador", color: "text-orange-500", bg: "bg-orange-500/10" },
            { href: "/calendar", icon: Calendar, label: "Calendario", color: "text-cyan-500", bg: "bg-cyan-500/10" },
            { href: "/games/new", icon: Trophy, label: "Nuevo Partido", color: "text-amber-500", bg: "bg-amber-500/10" },
          ].map(({ href, icon: Icon, label, color, bg }) => (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl border bg-card hover:border-primary hover:bg-primary/5 cursor-pointer transition-all group">
                <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Insights + Próximos Partidos + Posiciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Insights */}
        <Card>
          <CardHeader className="pb-3 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPlayer && (
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Star className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Jugador clave</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {topPlayer.playerName} · VAL {topPlayer.rating}
                    {topPlayer.points != null && ` · ${topPlayer.points} PTS`}
                  </div>
                </div>
              </div>
            )}
            {ownTeam && (
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-green-500/5 border border-green-500/20">
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Mi equipo</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {ownTeam.name}
                    {ownTeam.league ? ` · ${ownTeam.league}` : ""}
                  </div>
                </div>
              </div>
            )}
            {nextGame && (
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Dumbbell className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Próximo partido</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {nextGame.homeTeam} vs {nextGame.awayTeam} · <Countdown targetDate={nextGame.date} />
                  </div>
                </div>
              </div>
            )}
            {!topPlayer && !ownTeam && !nextGame && (
              <div className="py-4 text-center text-muted-foreground text-xs">
                Añade jugadores, equipos y partidos para ver insights.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos Partidos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Próximos Partidos</CardTitle>
            <Link href="/games">
              <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                Ver todos <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </CardHeader>
          <CardContent>
            {moreGames.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-xs">No hay más partidos programados</div>
            ) : (
              <div className="space-y-2">
                {moreGames.map((g) => (
                  <Link key={g.id} href={`/games/${g.id}/edit`}>
                    <div className="flex items-center justify-between p-2 rounded-lg border hover:border-primary/50 cursor-pointer group transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
                          {g.homeTeam} vs {g.awayTeam}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(g.date + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                          {g.location ? ` · ${g.location}` : ""}
                        </div>
                      </div>
                      {g.difficulty && (
                        <span className={`ml-2 shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DIFFICULTY_BADGE[g.difficulty] ?? "bg-muted text-muted-foreground"}`}>
                          {DIFFICULTY_LABEL[g.difficulty] ?? g.difficulty}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jugadores por Posición */}
        <Card>
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jugadores por Posición</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-6 rounded" />)}</div>
            ) : !summary?.positionBreakdown || summary.positionBreakdown.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-xs">Sin datos de posiciones</div>
            ) : (
              <div className="space-y-3">
                {summary.positionBreakdown.map((pos) => {
                  const pct = Math.round((pos.count / (summary.totalPlayers || 1)) * 100);
                  return (
                    <div key={pos.position} className="flex items-center gap-3">
                      <div className="w-8 font-mono text-xs font-bold text-primary">{pos.position}</div>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-12 text-right text-xs text-muted-foreground font-mono">{pos.count} · {pct}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
