import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListPlayers, useListGames } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export type ReportFormValues = {
  playerId: string;
  gameId: string;
  scoutName: string;
  date: string;
  rating: string;
  offensiveRating?: string;
  defensiveRating?: string;
  athleticismRating?: string;
  iQRating?: string;
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
  strengths?: string;
  weaknesses?: string;
  summary?: string;
  recommendation?: string;
};

const RATING_FIELDS: [keyof ReportFormValues, string][] = [
  ["offensiveRating", "Ataque"],
  ["defensiveRating", "Defensa"],
  ["athleticismRating", "Atletismo"],
  ["iQRating", "IQ de Baloncesto"],
];

const STAT_FIELDS: [keyof ReportFormValues, string][] = [
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

export function ReportForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  cancelTo,
}: {
  defaultValues?: Partial<ReportFormValues>;
  onSubmit: (values: ReportFormValues) => void;
  submitting: boolean;
  submitLabel: string;
  cancelTo: string;
}) {
  const { toast } = useToast();
  const { register, handleSubmit, setValue, watch } = useForm<ReportFormValues>({ defaultValues });
  const { data: players } = useListPlayers();
  const { data: games } = useListGames();

  const submit = (data: ReportFormValues) => {
    if (!data.playerId) {
      toast({ title: "Selecciona un jugador", variant: "destructive" });
      return;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Información General</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Jugador *</Label>
            <Select value={watch("playerId") || ""} onValueChange={(v) => setValue("playerId", v)}>
              <SelectTrigger className="bg-card"><SelectValue placeholder="Selecciona jugador" /></SelectTrigger>
              <SelectContent>
                {players?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.position})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nombre del Scout *</Label>
            <Input {...register("scoutName", { required: true })} placeholder="Tu nombre" className="bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input {...register("date")} type="date" className="bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label>Valoración General (1–10) *</Label>
            <Input {...register("rating", { required: true })} type="number" min="1" max="10" placeholder="7" className="bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label>Partido (opcional)</Label>
            <Select value={watch("gameId") || ""} onValueChange={(v) => setValue("gameId", v)}>
              <SelectTrigger className="bg-card"><SelectValue placeholder="Selecciona partido" /></SelectTrigger>
              <SelectContent>
                {games?.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.date} · {g.homeTeam} vs {g.awayTeam}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Valoraciones por Componente (1–10)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {RATING_FIELDS.map(([field, label]) => (
            <div key={field} className="space-y-1.5">
              <Label>{label}</Label>
              <Input {...register(field)} type="number" min="1" max="10" placeholder="—" className="bg-card" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Estadísticas del Partido</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          {STAT_FIELDS.map(([field, label]) => (
            <div key={field} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input {...register(field)} type="number" min="0" placeholder="0" className="bg-card" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Análisis</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fortalezas</Label>
            <Textarea {...register("strengths")} placeholder="¿Qué hace bien este jugador?" className="bg-card h-20" />
          </div>
          <div className="space-y-1.5">
            <Label>Debilidades</Label>
            <Textarea {...register("weaknesses")} placeholder="Áreas a mejorar..." className="bg-card h-20" />
          </div>
          <div className="space-y-1.5">
            <Label>Resumen</Label>
            <Textarea {...register("summary")} placeholder="Valoración global..." className="bg-card h-24" />
          </div>
          <div className="space-y-1.5">
            <Label>Recomendación</Label>
            <Textarea {...register("recommendation")} placeholder="Fichar, draftear, seguir, descartar..." className="bg-card h-16" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting} className="font-display tracking-wide uppercase">
          {submitting ? "Guardando..." : submitLabel}
        </Button>
        <Link href={cancelTo}><Button type="button" variant="outline">Cancelar</Button></Link>
      </div>
    </form>
  );
}
