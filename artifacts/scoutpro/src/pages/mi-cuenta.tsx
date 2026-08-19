import { useUpdateMySubscription } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, User, Shield } from "lucide-react";

export default function MiCuenta() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const updateSub = useUpdateMySubscription();

  if (!user) return null;

  const isPro = user.subscriptionTier === "professional";

  const handleToggle = () => {
    const newTier = isPro ? "amateur" : "professional";
    updateSub.mutate({ data: { tier: newTier } }, {
      onSuccess: () => {
        refreshUser();
        toast({ title: `Plan cambiado a ${newTier === "professional" ? "Profesional" : "Amateur"}` });
      },
      onError: () => {
        toast({ title: "Error al actualizar el plan", variant: "destructive" });
      },
    });
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-4xl">Mi Cuenta</h1>
        <p className="text-muted-foreground">Gestiona tu perfil y plan de suscripción.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Nombre</div>
              <div className="text-sm font-medium">{user.name ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Email</div>
              <div className="text-sm font-medium truncate">{user.email}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Rol</div>
              <div className="text-sm font-medium capitalize">{user.role}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-amber-400" />
            Plan de suscripción
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="font-semibold text-lg">
                {isPro ? "Plan Profesional" : "Plan Amateur"}
              </div>
              <div className="text-sm text-muted-foreground">
                {isPro
                  ? "Acceso completo a todas las funciones de análisis y scouting avanzado."
                  : "Funciones básicas de scouting y seguimiento de jugadores."}
              </div>
            </div>
            <span className={`shrink-0 mt-0.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${
              isPro
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-muted text-muted-foreground border-border"
            }`}>
              {isPro ? "Pro" : "Amateur"}
            </span>
          </div>

          <div className="border rounded-lg overflow-hidden divide-y divide-border">
            {[
              { label: "Informes de scouting",   amateur: true,  pro: true },
              { label: "Gestión de jugadores",   amateur: true,  pro: true },
              { label: "Calendario de partidos", amateur: true,  pro: true },
              { label: "Vídeos y biblioteca",    amateur: false, pro: true },
              { label: "Análisis estadístico",   amateur: false, pro: true },
              { label: "Exportación PDF",        amateur: false, pro: true },
            ].map((f) => (
              <div key={f.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className={f.amateur ? "" : isPro ? "" : "text-muted-foreground/50"}>{f.label}</span>
                {(isPro ? f.pro : f.amateur) ? (
                  <Shield className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <span className="text-[10px] text-muted-foreground/40">Pro</span>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleToggle}
              disabled={updateSub.isPending}
              variant={isPro ? "outline" : "default"}
              className="w-full font-display tracking-wide uppercase"
            >
              {updateSub.isPending
                ? "Actualizando..."
                : isPro
                  ? "Cambiar a plan Amateur"
                  : "Actualizar a plan Profesional"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground/50">
              Entorno de demostración — sin cargo real.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
