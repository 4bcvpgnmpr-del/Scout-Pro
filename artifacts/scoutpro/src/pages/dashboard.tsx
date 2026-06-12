import { useMemo } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useListGames,
  getListGamesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Shield, FileText, TrendingUp, Trophy, Calendar,
  Target, Plus, ChevronRight,
} from "lucide-react";
import { DIFFICULTY_BADGE, DIFFICULTY_LABEL } from "@/lib/difficulty";

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{label}</p>
            <p className={`text-3xl font-display leading-none ${accent ? "text-primary" : ""}`}>{value}</p>
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${accent ? "bg-primary/10" : "bg-muted"}`}>
            <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const { data: games } = useListGames({ query: { queryKey: getListGamesQueryKey() } });

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const upcomingGames = useMemo(
    () =>
      (games ?? [])
        .filter((g) => g.date >= todayKey)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [games, todayKey],
  );

  const nextGame = upcomingGames[0];
  const nextGames = upcomingGames.slice(1, 6);

  const todayLabel = now.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 3)
      .toUpperCase();

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

      {/* Stats row */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Jugadores" value={summary?.totalPlayers ?? 0} icon={Users} />
          <StatCard label="Equipos" value={summary?.totalTeams ?? 0} icon={Shield} />
          <StatCard label="Informes" value={summary?.totalReports ?? 0} icon={FileText} />
          <StatCard
            label="Rating Promedio"
            value={summary?.avgRating != null ? summary.avgRating.toFixed(1) : "—"}
            icon={TrendingUp}
            accent
          />
        </div>
      )}

      {/* Próximo Partido + Últimos Informes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Próximo partido */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Próximo Partido
            </CardTitle>
            <Link href="/games">
              <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                Ver todos <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </CardHeader>
          <CardContent>
            {!nextGame ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Trophy className="h-10 w-10 mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No hay partidos próximos programados</p>
                <Link href="/games/new">
                  <Button variant="outline" size="sm" className="mt-4">
                    Registrar partido
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="flex-1 text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-2">
                      <span className="font-display text-primary text-base">{initials(nextGame.homeTeam)}</span>
                    </div>
                    <div className="font-semibold text-sm leading-tight">{nextGame.homeTeam}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Local</div>
                  </div>
                  <div className="text-center shrink-0">
                    <div className="font-display text-2xl text-muted-foreground/40">VS</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                      <span className="font-display text-muted-foreground text-base">{initials(nextGame.awayTeam)}</span>
                    </div>
                    <div className="font-semibold text-sm leading-tight">{nextGame.awayTeam}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Visitante</div>
                  </div>
                </div>
                <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{nextGame.date}</div>
                    {nextGame.location && (
                      <div className="text-xs text-muted-foreground">{nextGame.location}</div>
                    )}
                    {nextGame.difficulty && (
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_BADGE[nextGame.difficulty] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {DIFFICULTY_LABEL[nextGame.difficulty] ?? nextGame.difficulty}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href="/scouting">
                      <Button size="sm" className="font-display uppercase tracking-wide text-xs">
                        Ver scouting
                      </Button>
                    </Link>
                    <Link href={`/games/${nextGame.id}/edit`}>
                      <Button size="sm" variant="outline" className="text-xs">
                        Editar
                      </Button>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Últimos informes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Últimos Informes
            </CardTitle>
            <Link href="/reports">
              <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                Ver todos <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded" />
                ))}
              </div>
            ) : !summary?.recentReports || summary.recentReports.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No hay informes recientes
              </div>
            ) : (
              <div className="space-y-1.5">
                {summary.recentReports.map((r) => (
                  <Link key={r.id} href={`/reports/${r.id}`}>
                    <div className="flex items-center justify-between p-2.5 rounded-lg border hover:border-primary/50 cursor-pointer group transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                          {r.playerName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{r.scoutName}</div>
                      </div>
                      <div className="ml-3 shrink-0 h-8 w-8 rounded bg-primary/10 flex items-center justify-center font-display text-primary text-sm">
                        {r.rating}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accesos Rápidos */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Accesos Rápidos
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { href: "/scouting", icon: Target, label: "Scouting" },
            { href: "/reports/new", icon: FileText, label: "Nuevo Informe" },
            { href: "/players/new", icon: Users, label: "Nuevo Jugador" },
            { href: "/games/new", icon: Trophy, label: "Nuevo Partido" },
            { href: "/calendar", icon: Calendar, label: "Calendario" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:border-primary hover:bg-primary/5 cursor-pointer transition-all group">
                <div className="h-10 w-10 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-xs font-medium text-center leading-tight">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom: upcoming games + position breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Próximos Partidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextGames.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                No hay más partidos programados
              </div>
            ) : (
              <div className="space-y-1.5">
                {nextGames.map((g) => (
                  <Link key={g.id} href={`/games/${g.id}/edit`}>
                    <div className="flex items-center justify-between p-2.5 rounded-lg border hover:border-primary/50 cursor-pointer group transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {g.homeTeam} vs {g.awayTeam}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {g.date}
                          {g.location ? ` · ${g.location}` : ""}
                        </div>
                      </div>
                      {g.difficulty && (
                        <span
                          className={`ml-2 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_BADGE[g.difficulty] ?? "bg-muted text-muted-foreground"}`}
                        >
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

        <Card>
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jugadores por Posición
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-7 rounded" />
                ))}
              </div>
            ) : !summary?.positionBreakdown || summary.positionBreakdown.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                No hay datos de posiciones
              </div>
            ) : (
              <div className="space-y-3">
                {summary.positionBreakdown.map((pos) => {
                  const pct = Math.round((pos.count / (summary.totalPlayers || 1)) * 100);
                  return (
                    <div key={pos.position} className="flex items-center gap-3">
                      <div className="w-8 font-mono text-xs font-bold text-primary">{pos.position}</div>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-xs text-muted-foreground font-mono">
                        {pos.count} · {pct}%
                      </div>
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
