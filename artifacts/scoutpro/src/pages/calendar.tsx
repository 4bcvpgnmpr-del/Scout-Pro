import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListGames, getListGamesQueryKey, useListTeams, getListTeamsQueryKey, type Game } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, CalendarDays, Shield } from "lucide-react";
import { DIFFICULTY_LABEL, DIFFICULTY_CELL, DIFFICULTY_DOT } from "@/lib/difficulty";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatLongDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export default function CalendarPage() {
  const { data: games, isLoading } = useListGames({ query: { queryKey: getListGamesQueryKey() } });
  const { data: teams } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const gamesByDate = useMemo(() => {
    const map = new Map<string, Game[]>();
    (games ?? []).forEach((g) => {
      const key = g.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    return map;
  }, [games]);

  const ownTeamNames = useMemo(() => {
    return new Set(
      (teams ?? [])
        .filter((t) => t.teamType === "own")
        .map((t) => t.name.trim().toLowerCase()),
    );
  }, [teams]);

  const upcomingOwnGames = useMemo(() => {
    if (ownTeamNames.size === 0) return [];
    return (games ?? [])
      .filter((g) => {
        const isOwn =
          ownTeamNames.has(g.homeTeam.trim().toLowerCase()) ||
          ownTeamNames.has(g.awayTeam.trim().toLowerCase());
        return isOwn && g.date >= todayKey;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [games, ownTeamNames, todayKey]);

  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };
  const goToday = () => {
    setMonth(now.getMonth());
    setYear(now.getFullYear());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl">Calendario</h1>
          <p className="text-muted-foreground">Partidos por dificultad y próximos encuentros de tu equipo.</p>
        </div>
        <Link href="/games">
          <Button variant="outline" className="font-display tracking-wide uppercase">
            <CalendarDays className="mr-2 h-4 w-4" /> Ver lista
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-2xl capitalize">{MONTHS[month]} {year}</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToday}>Hoy</Button>
              <Button variant="outline" size="icon" onClick={goPrev} title="Mes anterior"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={goNext} title="Mes siguiente"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96 rounded-xl" />
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1.5 mb-2">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {cells.map((day, idx) => {
                    if (day === null) return <div key={`empty-${idx}`} className="min-h-20 rounded-lg" />;
                    const key = `${year}-${pad(month + 1)}-${pad(day)}`;
                    const dayGames = gamesByDate.get(key) ?? [];
                    const isToday = key === todayKey;
                    return (
                      <div
                        key={key}
                        className={`min-h-20 rounded-lg border p-1.5 flex flex-col gap-1 ${isToday ? "border-primary ring-1 ring-primary/40" : "border-border/60"}`}
                      >
                        <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                        <div className="flex flex-col gap-1 overflow-hidden">
                          {dayGames.slice(0, 3).map((g) => {
                            const diff = g.difficulty ?? "";
                            const cls = DIFFICULTY_CELL[diff] ?? "bg-muted border-border text-muted-foreground";
                            return (
                              <Link key={g.id} href={`/games/${g.id}/edit`}>
                                <div className={`text-[10px] leading-tight rounded border px-1 py-0.5 truncate cursor-pointer hover:opacity-80 ${cls}`} title={`${g.homeTeam} vs ${g.awayTeam}`}>
                                  {g.homeTeam} vs {g.awayTeam}
                                </div>
                              </Link>
                            );
                          })}
                          {dayGames.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{dayGames.length - 3} más</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
                  {Object.entries(DIFFICULTY_LABEL).map(([k, label]) => (
                    <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={`h-3 w-3 rounded-full ${DIFFICULTY_DOT[k]}`} />
                      {label}
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-3 w-3 rounded-full bg-muted border border-border" />
                    Sin definir
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Mi Equipo</CardTitle>
          </CardHeader>
          <CardContent>
            {ownTeamNames.size === 0 ? (
              <p className="text-sm text-muted-foreground">Marca un equipo como propio para ver tus próximos partidos aquí.</p>
            ) : upcomingOwnGames.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay próximos partidos registrados para tu equipo.</p>
            ) : (
              <div className="space-y-2">
                {upcomingOwnGames.map((g) => {
                  const diff = g.difficulty ?? "";
                  const dot = DIFFICULTY_DOT[diff] ?? "bg-muted-foreground/40";
                  return (
                    <Link key={g.id} href={`/games/${g.id}/edit`}>
                      <div className="flex items-start gap-3 rounded-lg border p-3 hover:border-primary/50 transition-colors cursor-pointer">
                        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${dot}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{g.homeTeam} vs {g.awayTeam}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatLongDate(g.date)}
                            {g.difficulty ? ` · ${DIFFICULTY_LABEL[g.difficulty] ?? g.difficulty}` : ""}
                          </div>
                        </div>
                      </div>
                    </Link>
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
