import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Play, Upload, Film, Layers } from "lucide-react";

export default function Videos() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-4xl font-display tracking-wide">Vídeos</h1>
          <p className="text-muted-foreground text-sm">Biblioteca centralizada de vídeo de scouting.</p>
        </div>
        <Button className="font-display tracking-wide uppercase" disabled>
          <Upload className="mr-2 h-4 w-4" /> Subir Vídeo
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Film, label: "Partidos completos", desc: "Grabaciones íntegras de partido" },
          { icon: Play, label: "Clips de jugadas", desc: "Secuencias específicas destacadas" },
          { icon: Layers, label: "Highlights", desc: "Mejores jugadas por jugador" },
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
          <Video className="h-14 w-14 mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold mb-2">Biblioteca de Vídeo</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Gestiona vídeos por equipo, partido y jugador directamente desde la sección de scouting de cada equipo.
          </p>
          <Link href="/scouting">
            <Button variant="outline" className="mt-6 font-display uppercase tracking-wide">
              Ir a Scouting
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
