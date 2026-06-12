import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListTeams } from "@workspace/api-client-react";
import { PhotoUpload } from "@/components/photo-upload";

export type PlayerFormValues = {
  name: string;
  position: string;
  teamId?: string;
  jerseyNumber?: string;
  age?: string;
  height?: string;
  weight?: string;
  nationality?: string;
  handedness?: string;
  notes?: string;
  photoUrl?: string;
};

export function PlayerForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  cancelTo,
}: {
  defaultValues?: Partial<PlayerFormValues>;
  onSubmit: (values: PlayerFormValues) => void;
  submitting: boolean;
  submitLabel: string;
  cancelTo: string;
}) {
  const { register, handleSubmit, setValue, watch } = useForm<PlayerFormValues>({ defaultValues });
  const { data: teams } = useListTeams();
  const photoUrl = watch("photoUrl");
  const nameVal = watch("name") ?? "";

  const initials = nameVal
    .split(" ")
    .map((w: string) => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card>
      <CardHeader><CardTitle>Información del Jugador</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="flex justify-center mb-2">
            <PhotoUpload
              value={photoUrl}
              onChange={(url) => setValue("photoUrl", url)}
              shape="circle"
              size="lg"
              placeholder={initials || "?"}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Nombre completo *</Label>
              <Input {...register("name", { required: true })} placeholder="ej. Marcus Johnson" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Posición *</Label>
              <Select value={watch("position") || ""} onValueChange={(v) => setValue("position", v)}>
                <SelectTrigger className="bg-card"><SelectValue placeholder="Selecciona posición" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PG">PG — Base</SelectItem>
                  <SelectItem value="SG">SG — Escolta</SelectItem>
                  <SelectItem value="SF">SF — Alero</SelectItem>
                  <SelectItem value="PF">PF — Ala-Pívot</SelectItem>
                  <SelectItem value="C">C — Pívot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Equipo</Label>
              <Select value={watch("teamId") || ""} onValueChange={(v) => setValue("teamId", v)}>
                <SelectTrigger className="bg-card"><SelectValue placeholder="Agente libre" /></SelectTrigger>
                <SelectContent>
                  {teams?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dorsal</Label>
              <Input {...register("jerseyNumber")} type="number" placeholder="0" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Edad</Label>
              <Input {...register("age")} type="number" placeholder="22" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Altura</Label>
              <Input {...register("height")} placeholder={`6'4"`} className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Peso (lbs)</Label>
              <Input {...register("weight")} type="number" placeholder="220" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Nacionalidad</Label>
              <Input {...register("nationality")} placeholder="ej. España" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label>Mano dominante</Label>
              <Select value={watch("handedness") || ""} onValueChange={(v) => setValue("handedness", v)}>
                <SelectTrigger className="bg-card"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Derecha">Derecha</SelectItem>
                  <SelectItem value="Izquierda">Izquierda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notas del scout</Label>
              <Textarea {...register("notes")} placeholder="Observaciones generales, contexto..." className="bg-card h-24" />
            </div>
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
