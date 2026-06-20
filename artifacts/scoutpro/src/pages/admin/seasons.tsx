import { useState } from "react";
import {
  useListSeasons,
  useListSeasonLeagues,
  useCreateSeason,
  getListSeasonsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Plus, Check, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSeasons() {
  const { data: seasons = [], isLoading } = useListSeasons();
  const { data: leagues = [], isLoading: leaguesLoading } = useListSeasonLeagues();
  const createSeason = useCreateSeason();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const thisYear = new Date().getFullYear();
  const [form, setForm] = useState({
    leagueId: "",
    name: "",
    startYear: String(thisYear),
    endYear: String(thisYear + 1),
  });

  const handleStartYearChange = (v: string) => {
    const sy = parseInt(v, 10);
    setForm((f) => ({
      ...f,
      startYear: v,
      endYear: Number.isNaN(sy) ? f.endYear : String(sy + 1),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSeason.mutate(
      {
        data: {
          leagueId: form.leagueId,
          name: form.name,
          startYear: parseInt(form.startYear, 10),
          endYear: parseInt(form.endYear, 10),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSeasonsQueryKey() });
          toast({ title: "Temporada creada correctamente" });
          setForm((f) => ({ ...f, leagueId: "", name: "" }));
        },
        onError: () => {
          toast({ title: "Error al crear la temporada", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Temporadas</h1>
        <p className="text-muted-foreground">Gestiona las temporadas disponibles por liga.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h2 className="font-display font-black text-xs uppercase tracking-widest text-muted-foreground">
            Temporadas registradas
          </h2>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : seasons.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin temporadas registradas</p>
                <p className="text-sm mt-1 opacity-60">
                  Sincroniza datos estadísticos o crea una temporada manualmente.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {seasons.map((s) => (
                <Card key={s.id} className={s.isCurrent ? "ring-1 ring-primary/40" : ""}>
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-semibold">{s.name}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{s.startYear}–{s.endYear}</span>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {s.leagueCount ?? 0} liga{(s.leagueCount ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    {s.isCurrent && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-500">
                        <Check className="h-3.5 w-3.5" /> Temporada actual
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4" />
                Nueva temporada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Liga</Label>
                  {leaguesLoading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : leagues.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Sin ligas disponibles. Sincroniza datos estadísticos primero.
                    </p>
                  ) : (
                    <Select
                      value={form.leagueId}
                      onValueChange={(v) => setForm((f) => ({ ...f, leagueId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar liga" />
                      </SelectTrigger>
                      <SelectContent>
                        {leagues.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                            {l.shortName ? ` (${l.shortName})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input
                    placeholder="ej. Liga Endesa 2025-26"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Año inicio</Label>
                    <Input
                      type="number"
                      min={2000}
                      max={2099}
                      value={form.startYear}
                      onChange={(e) => handleStartYearChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Año fin</Label>
                    <Input
                      type="number"
                      min={2001}
                      max={2100}
                      value={form.endYear}
                      onChange={(e) => setForm((f) => ({ ...f, endYear: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full font-display tracking-wide uppercase"
                  disabled={createSeason.isPending || leagues.length === 0 || !form.leagueId || !form.name}
                >
                  {createSeason.isPending ? "Creando..." : "Crear temporada"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
