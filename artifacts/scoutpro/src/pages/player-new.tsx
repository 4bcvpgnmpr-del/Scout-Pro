import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { useCreatePlayer, useCreateReport, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlayerForm, type PlayerFormValues } from "@/components/forms/player-form";

type StatsValues = {
  points?: string;
  offensiveRebounds?: string;
  defensiveRebounds?: string;
  assists?: string;
  steals?: string;
  blocks?: string;
  turnovers?: string;
  minutesPlayed?: string;
  fieldGoalsMade?: string;
  fieldGoalsAttempted?: string;
  threesMade?: string;
  threesAttempted?: string;
  freeThrowsMade?: string;
  freeThrowsAttempted?: string;
  rating?: string;
  strengths?: string;
  weaknesses?: string;
  summary?: string;
};

const NUM_STATS: [keyof StatsValues, string][] = [
  ["minutesPlayed", "MIN"],
  ["points", "PTS"],
  ["offensiveRebounds", "REB OF"],
  ["defensiveRebounds", "REB DEF"],
  ["assists", "AST"],
  ["steals", "ROB"],
  ["blocks", "TAP"],
  ["turnovers", "PÉR"],
  ["fieldGoalsMade", "TC C"],
  ["fieldGoalsAttempted", "TC I"],
  ["threesMade", "T3 C"],
  ["threesAttempted", "T3 I"],
  ["freeThrowsMade", "TL C"],
  ["freeThrowsAttempted", "TL I"],
];

function hasAnyStats(data: StatsValues) {
  return NUM_STATS.some(([k]) => data[k] && data[k] !== "");
}

export default function PlayerNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createPlayer = useCreatePlayer();
  const createReport = useCreateReport();

  const statsForm = useForm<StatsValues>({ defaultValues: { rating: "7" } });

  const onSubmit = (playerData: PlayerFormValues) => {
    createPlayer.mutate({
      data: {
        name: playerData.name,
        position: playerData.position,
        teamId: playerData.teamId ? parseInt(playerData.teamId) : null,
        jerseyNumber: playerData.jerseyNumber ? parseInt(playerData.jerseyNumber) : null,
        age: playerData.age ? parseInt(playerData.age) : null,
        height: playerData.height || undefined,
        weight: playerData.weight ? parseInt(playerData.weight) : null,
        nationality: playerData.nationality || undefined,
        handedness: playerData.handedness || undefined,
        notes: playerData.notes || undefined,
        photoUrl: playerData.photoUrl || undefined,
      },
    }, {
      onSuccess: (player) => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        const stats = statsForm.getValues();
        if (hasAnyStats(stats)) {
          const today = new Date().toISOString().split("T")[0];
          createReport.mutate({
            data: {
              playerId: player.id,
              scoutName: "Scout",
              date: today,
              rating: stats.rating ? parseInt(stats.rating) : 7,
              points: stats.points ? parseInt(stats.points) : undefined,
              offensiveRebounds: stats.offensiveRebounds ? parseInt(stats.offensiveRebounds) : undefined,
              defensiveRebounds: stats.defensiveRebounds ? parseInt(stats.defensiveRebounds) : undefined,
              assists: stats.assists ? parseInt(stats.assists) : undefined,
              steals: stats.steals ? parseInt(stats.steals) : undefined,
              blocks: stats.blocks ? parseInt(stats.blocks) : undefined,
              turnovers: stats.turnovers ? parseInt(stats.turnovers) : undefined,
              minutesPlayed: stats.minutesPlayed ? parseInt(stats.minutesPlayed) : undefined,
              fieldGoalsMade: stats.fieldGoalsMade ? parseInt(stats.fieldGoalsMade) : undefined,
              fieldGoalsAttempted: stats.fieldGoalsAttempted ? parseInt(stats.fieldGoalsAttempted) : undefined,
              threesMade: stats.threesMade ? parseInt(stats.threesMade) : undefined,
              threesAttempted: stats.threesAttempted ? parseInt(stats.threesAttempted) : undefined,
              freeThrowsMade: stats.freeThrowsMade ? parseInt(stats.freeThrowsMade) : undefined,
              freeThrowsAttempted: stats.freeThrowsAttempted ? parseInt(stats.freeThrowsAttempted) : undefined,
              strengths: stats.strengths || undefined,
              weaknesses: stats.weaknesses || undefined,
              summary: stats.summary || undefined,
            },
          }, {
            onSuccess: () => {
              toast({ title: "Jugador e informe guardados", description: `${player.name} añadido con estadísticas.` });
              setLocation(`/players/${player.id}`);
            },
            onError: () => {
              toast({ title: "Jugador creado", description: "Las estadísticas no se pudieron guardar." });
              setLocation(`/players/${player.id}`);
            },
          });
        } else {
          toast({ title: "Jugador añadido", description: `${player.name} se ha añadido a la base de datos.` });
          setLocation(`/players/${player.id}`);
        }
      },
      onError: () => toast({ title: "Error", description: "No se pudo crear el jugador.", variant: "destructive" }),
    });
  };

  const isPending = createPlayer.isPending || createReport.isPending;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/jugadores"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-4xl">Nuevo Jugador</h1>
          <p className="text-muted-foreground">Añade un prospecto a la base de datos.</p>
        </div>
      </div>

      <PlayerForm
        onSubmit={onSubmit}
        submitting={isPending}
        submitLabel="Añadir Jugador"
        cancelTo="/jugadores"
      >
        {/* ── Estadísticas iniciales (opcional) ─────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Estadísticas de Temporada
              <span className="text-xs font-normal text-muted-foreground ml-1">(opcional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {NUM_STATS.map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    {...statsForm.register(field)}
                    type="number"
                    min="0"
                    placeholder="—"
                    className="bg-card text-center h-8 text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fortalezas</Label>
                <textarea
                  {...statsForm.register("strengths")}
                  placeholder="¿Qué hace bien?"
                  className="w-full bg-card border border-input rounded-md px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Debilidades</Label>
                <textarea
                  {...statsForm.register("weaknesses")}
                  placeholder="Áreas a mejorar..."
                  className="w-full bg-card border border-input rounded-md px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Resumen del scout</Label>
              <textarea
                {...statsForm.register("summary")}
                placeholder="Valoración global del jugador..."
                className="w-full bg-card border border-input rounded-md px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </CardContent>
        </Card>
      </PlayerForm>
    </div>
  );
}
