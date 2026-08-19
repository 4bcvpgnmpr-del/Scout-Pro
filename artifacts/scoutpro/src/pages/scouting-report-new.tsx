import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Check, ChevronRight, ChevronLeft, Trophy, Search } from "lucide-react";
import { scoutingReportsApi, type TeamRef, type GameRef } from "@/lib/scouting-reports-api";
import { useSeason } from "@/contexts/SeasonContext";
import { useToast } from "@/hooks/use-toast";

const STEPS = ["Mi Equipo", "Rival", "Partido"];

function TeamGrid({
  teams,
  selectedId,
  onSelect,
  excludeId,
  testPrefix,
}: {
  teams: TeamRef[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  excludeId?: number | null;
  testPrefix: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = teams.filter(
    (t) => t.id !== excludeId && t.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar equipo..."
          className="pl-9"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1">
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            data-testid={`${testPrefix}-${t.id}`}
            className={`rounded-xl border p-4 flex flex-col items-center gap-2 text-center transition hover-elevate ${
              selectedId === t.id ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {t.logoUrl ? (
                <img src={t.logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                <Shield className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className="text-sm font-semibold leading-tight line-clamp-2">{t.name}</span>
            {t.league && <span className="text-[10px] text-muted-foreground uppercase">{t.league}</span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground text-center py-8">Sin resultados</p>
        )}
      </div>
    </div>
  );
}

export default function ScoutingReportNew() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const presetGameId = useMemo(() => {
    const p = new URLSearchParams(searchStr).get("gameId");
    return p ? parseInt(p, 10) : null;
  }, [searchStr]);

  const { selectedSeason } = useSeason();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [gameId, setGameId] = useState<number | null>(presetGameId);
  const [noGame, setNoGame] = useState(false);

  const { data: teams, isLoading: teamsLoading } = useQuery<TeamRef[]>({
    queryKey: ["teams-for-wizard"],
    queryFn: () => fetch("/api/teams", { credentials: "include" }).then((r) => r.json()),
  });
  const { data: games } = useQuery<GameRef[]>({
    queryKey: ["games-for-wizard"],
    queryFn: () => fetch("/api/games", { credentials: "include" }).then((r) => r.json()),
  });

  const teamById = useMemo(() => new Map((teams ?? []).map((t) => [t.id, t])), [teams]);
  const myTeam = teamId ? teamById.get(teamId) : null;
  const opponent = opponentId ? teamById.get(opponentId) : null;

  // Games matching either selected team name (games store team names as text)
  const relevantGames = useMemo(() => {
    if (!games) return [];
    const names = [myTeam?.name, opponent?.name].filter(Boolean).map((n) => (n as string).toLowerCase());
    if (names.length === 0) return games;
    return games.filter(
      (g) => names.includes(g.homeTeam.toLowerCase()) || names.includes(g.awayTeam.toLowerCase()),
    );
  }, [games, myTeam?.name, opponent?.name]);

  const createMutation = useMutation({
    mutationFn: () =>
      scoutingReportsApi.create({
        title: opponent ? `Scouting: ${opponent.name}` : "Nuevo informe de scouting",
        teamId,
        opponentId,
        gameId: noGame ? null : gameId,
        season: selectedSeason?.id ?? null,
      }),
    onSuccess: (report) => navigate(`/scouting/reports/${report.id}`),
    onError: (e: Error) => toast({ title: "Error al crear el informe", description: e.message, variant: "destructive" }),
  });

  const canNext = step === 0 ? teamId != null : step === 1 ? opponentId != null : gameId != null || noGame;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-4xl">Nuevo Informe Pro</h1>
        <p className="text-muted-foreground">Configura el informe en tres pasos.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : <span className="text-xs">{i + 1}</span>}
              {label}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {teamsLoading ? (
            <div className="grid grid-cols-4 gap-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          ) : step === 0 ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Selecciona tu equipo</h2>
              <TeamGrid teams={teams ?? []} selectedId={teamId} onSelect={setTeamId} testPrefix="card-myteam" />
            </div>
          ) : step === 1 ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Selecciona el rival</h2>
              <TeamGrid teams={teams ?? []} selectedId={opponentId} onSelect={setOpponentId} excludeId={teamId} testPrefix="card-opponent" />
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Vincula un partido (opcional)</h2>
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {relevantGames.map((g) => (
                  <button
                    key={g.id}
                    data-testid={`card-game-${g.id}`}
                    onClick={() => { setGameId(g.id); setNoGame(false); }}
                    className={`w-full rounded-xl border p-4 flex items-center gap-3 text-left transition hover-elevate ${
                      gameId === g.id && !noGame ? "border-primary bg-primary/10" : "border-border bg-card"
                    }`}
                  >
                    <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {g.homeTeam} vs {g.awayTeam}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {g.date}
                        {g.location ? ` · ${g.location}` : ""}
                        {g.homeScore != null && g.awayScore != null ? ` · ${g.homeScore}-${g.awayScore}` : ""}
                      </div>
                    </div>
                  </button>
                ))}
                {relevantGames.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No hay partidos para estos equipos.</p>
                )}
              </div>
              <button
                onClick={() => { setNoGame(true); setGameId(null); }}
                data-testid="button-no-game"
                className={`w-full rounded-xl border border-dashed p-3 text-sm transition ${
                  noGame ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground"
                }`}
              >
                Continuar sin partido vinculado
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => (step === 0 ? navigate("/scouting/reports") : setStep(step - 1))}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> {step === 0 ? "Cancelar" : "Atrás"}
        </Button>
        {step < 2 ? (
          <Button disabled={!canNext} onClick={() => setStep(step + 1)} data-testid="button-next-step">
            Siguiente <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            disabled={!canNext || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            data-testid="button-create-report"
            className="font-display tracking-wide uppercase"
          >
            {createMutation.isPending ? "Creando…" : "Crear Informe"}
          </Button>
        )}
      </div>
    </div>
  );
}
