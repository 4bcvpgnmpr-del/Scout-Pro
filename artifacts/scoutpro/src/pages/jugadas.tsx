import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Grid3X3, Layers, Zap } from "lucide-react";

export default function Jugadas() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-4xl font-display tracking-wide">Biblioteca de Jugadas</h1>
          <p className="text-muted-foreground text-sm">Repositorio de sistemas, jugadas y esquemas tácticos.</p>
        </div>
        <Button className="font-display tracking-wide uppercase" disabled>
          <Plus className="mr-2 h-4 w-4" /> Nueva Jugada
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Grid3X3, label: "Jugadas de ataque", desc: "Bloqueos, cortes y sistemas ofensivos" },
          { icon: Layers, label: "Sistemas defensivos", desc: "Zonas, presión y coberturas" },
          { icon: Zap, label: "Situaciones especiales", desc: "Tiros libres, últimos segundos, OOB" },
        ].map(({ icon: Icon, label, desc }) => (
          <Card key={label} className="border-dashed bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <div className="font-semibold text-sm">{label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-14 w-14 mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold mb-2">Próximamente</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            La biblioteca de jugadas permitirá dibujar, categorizar y compartir esquemas tácticos con tu cuerpo técnico.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
