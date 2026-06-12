import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { useListGames, getListGamesQueryKey, useListTeams, getListTeamsQueryKey, type Game } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, CalendarDays, Shield, Dumbbell, Plus, X, Trash2 } from "lucide-react";
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

interface Training {
  id: string;
  date: string;
  title: string;
  startTime?: string;
  duration?: number;
  notes?: string;
}

const STORAGE_KEY = "sp-trainings";

function useTrainings() {
  const [trainings, setTrainings] = useState<Training[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Training[];
    } catch {
      return [];
    }
  });

  const save = useCallback((list: Training[]) => {
    setTrainings(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  const addTraining = useCallback((t: Omit<Training, "id">) => {
    const next = { ...t, id: `tr-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    save([...trainings, next]);
  }, [trainings, save]);

  const removeTraining = useCallback((id: string) => {
    save(trainings.filter((t) => t.id !== id));
  }, [trainings, save]);

  return { trainings, addTraining, removeTraining };
}

export default function CalendarPage() {
  const { data: games, isLoading } = useListGames({ query: { queryKey: getListGamesQueryKey() } });
  const { data: teams } = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });
  const { trainings, addTraining, removeTraining } = useTrainings();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");

  const [form, setForm] = useState({ title: "", startTime: "", duration: "", notes: "" });

  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const gamesByDate = useMemo(() => {
    const map = new Map<string, Game[]>();
    (games ?? []).forEach((g) => {
      if (!map.has(g.date)) map.set(g.date, []);
      map.get(g.date)!.push(g);
    });
    return map;
  }, [games]);

  const trainingsByDate = useMemo(() => {
    const map = new Map<string, Training[]>();
    trainings.forEach((t) => {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    });
    return map;
  }, [trainings]);

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

  const upcomingTrainings = useMemo(() => {
    return trainings
      .filter((t) => t.date >= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [trainings, todayKey]);

  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };
  const goToday = () => { setMonth(now.getMonth()); setYear(now.getFullYear()); };

  const openAddTraining = (date: string) => {
    setSelectedDate(date);
    setForm({ title: "", startTime: "", duration: "", notes: "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim() || !selectedDate) return;
    addTraining({
      date: selectedDate,
      title: form.title,
      startTime: form.startTime || undefined,
      duration: form.duration ? parseInt(form.duration) : undefined,
      notes: form.notes || undefined,
    });
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl">Calendario</h1>
          <p className="text-muted-foreground">Partidos, entrenamientos y próximos eventos.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openAddTraining(todayKey)} variant="outline" className="font-display tracking-wide uppercase">
            <Dumbbell className="mr-2 h-4 w-4" /> Entrenamiento
          </Button>
          <Link href="/games">
            <Button variant="outline" className="font-display tracking-wide uppercase">
              <CalendarDays className="mr-2 h-4 w-4" /> Ver lista
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
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
                    const dayTrainings = trainingsByDate.get(key) ?? [];
                    const isToday = key === todayKey;
                    const totalEvents = dayGames.length + dayTrainings.length;
                    return (
                      <div
                        key={key}
                        className={`min-h-20 rounded-lg border p-1.5 flex flex-col gap-1 ${isToday ? "border-primary ring-1 ring-primary/40" : "border-border/60"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                          <button
                            className="opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-primary"
                            onClick={() => openAddTraining(key)}
                            title="Añadir entrenamiento"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          {dayTrainings.slice(0, 2).map((t) => (
                            <div
                              key={t.id}
                              className="text-[10px] leading-tight rounded border px-1 py-0.5 truncate bg-blue-500/20 border-blue-500/40 text-blue-300 cursor-default"
                              title={t.title}
                            >
                              🏋 {t.title}
                            </div>
                          ))}
                          {dayGames.slice(0, 2).map((g) => {
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
                          {totalEvents > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{totalEvents - 4} más</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-3 w-3 rounded-full bg-blue-500/60" />
                    Entrenamiento
                  </div>
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

        {/* Sidebar panel */}
        <div className="space-y-4">
          {/* Upcoming trainings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Dumbbell className="h-4 w-4 text-blue-400" /> Próximos Entrenamientos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingTrainings.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">
                  No hay entrenamientos programados.
                </div>
              ) : (
                upcomingTrainings.map((t) => (
                  <div key={t.id} className="flex items-start gap-3 rounded-lg border p-3 group">
                    <Dumbbell className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatLongDate(t.date)}
                        {t.startTime ? ` · ${t.startTime}` : ""}
                        {t.duration ? ` · ${t.duration} min` : ""}
                      </div>
                      {t.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{t.notes}</p>}
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeTraining(t.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-1"
                onClick={() => openAddTraining(todayKey)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Añadir entrenamiento
              </Button>
            </CardContent>
          </Card>

          {/* Mi Equipo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" /> Mi Equipo — Próximos Partidos
              </CardTitle>
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
                              {g.location ? ` · ${g.location}` : ""}
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

      {/* Add training dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-blue-400" /> Nuevo Entrenamiento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Título *</label>
              <Input
                placeholder="Ej. Entrenamiento táctico"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hora inicio</label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Duración (min)</label>
                <Input
                  type="number"
                  placeholder="90"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notas</label>
              <Textarea
                placeholder="Descripción, objetivos del entrenamiento..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.title.trim()}>
                <Plus className="mr-1.5 h-4 w-4" /> Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
