import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type TeamFormValues = { name: string; league?: string; city?: string };

export function TeamForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  cancelTo,
}: {
  defaultValues?: Partial<TeamFormValues>;
  onSubmit: (values: TeamFormValues) => void;
  submitting: boolean;
  submitLabel: string;
  cancelTo: string;
}) {
  const { register, handleSubmit } = useForm<TeamFormValues>({ defaultValues });

  return (
    <Card>
      <CardHeader><CardTitle>Información del Equipo</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre del equipo *</Label>
            <Input {...register("name", { required: true })} placeholder="ej. Real Madrid" className="bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label>Liga</Label>
            <Input {...register("league")} placeholder="ej. ACB, EuroLeague" className="bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label>Ciudad / Región</Label>
            <Input {...register("city")} placeholder="ej. Madrid" className="bg-card" />
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
