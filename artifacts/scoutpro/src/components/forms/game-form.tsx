import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type GameFormValues = {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: string;
  awayScore?: string;
  location?: string;
  notes?: string;
  difficulty?: string;
};

export function GameForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  cancelTo,
}: {
  defaultValues?: Partial<GameFormValues>;
  onSubmit: (values: GameFormValues) => void;
  submitting: boolean;
  submitLabel: string;
  cancelTo: string;
}) {
  const { register, handleSubmit, setValue, watch } = useForm<GameFormValues>({ defaultValues });

  return (
    <Card>
      <CardHeader><CardTitle>Datos del Partido</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <Input {...register("date", { required: true })} type="date" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Dificultad</Label>
              <Select value={watch("difficulty") || ""} onValueChange={(v) => setValue("difficulty", v)}>
                <SelectTrigger className="bg-card"><SelectValue placeholder="Selecciona dificultad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="importante">Importante</SelectItem>
                  <SelectItem value="medio">Medio</SelectItem>
                  <SelectItem value="facil">Fácil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Equipo local *</Label>
              <Input {...register("homeTeam", { required: true })} placeholder="Equipo local" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Equipo visitante *</Label>
              <Input {...register("awayTeam", { required: true })} placeholder="Equipo visitante" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Puntos local</Label>
              <Input {...register("homeScore")} type="number" placeholder="0" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Puntos visitante</Label>
              <Input {...register("awayScore")} type="number" placeholder="0" className="bg-card" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Lugar</Label>
            <Input {...register("location")} placeholder="ej. WiZink Center" className="bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea {...register("notes")} placeholder="Condiciones, contexto..." className="bg-card h-20" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting} className="font-display tracking-wide uppercase">
              {submitting ? "Guardando..." : submitLabel}
            </Button>
            <Link href={cancelTo}><Button type="button" variant="outline">Cancelar</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
