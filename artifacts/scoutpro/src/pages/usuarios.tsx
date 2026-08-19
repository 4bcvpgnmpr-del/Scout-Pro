import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCog, Plus, Shield, Eye, Edit2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const DEMO_USERS = [
  { name: "Entrenador Principal", role: "Administrador", initials: "EP", access: "Acceso total" },
  { name: "Asistente Técnico", role: "Scout", initials: "AT", access: "Solo lectura" },
  { name: "Analista de Vídeo", role: "Analista", initials: "AV", access: "Vídeos + Informes" },
];

export default function Usuarios() {
  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-4xl font-display tracking-wide">Usuarios</h1>
          <p className="text-muted-foreground text-sm">Gestiona el acceso del cuerpo técnico a ScoutFlow.</p>
        </div>
        <Button className="font-display tracking-wide uppercase" disabled>
          <Plus className="mr-2 h-4 w-4" /> Invitar Usuario
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Shield, label: "Administradores", value: "1", accent: true },
          { icon: Eye, label: "Scouts", value: "1", accent: false },
          { icon: Edit2, label: "Analistas", value: "1", accent: false },
        ].map(({ icon: Icon, label, value, accent }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{label}</p>
                  <p className={`text-3xl font-display ${accent ? "text-primary" : ""}`}>{value}</p>
                </div>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent ? "bg-primary/10" : "bg-muted"}`}>
                  <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Miembros del Cuerpo Técnico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {DEMO_USERS.map((u) => (
              <div key={u.name} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-display text-sm">{u.initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.role} · {u.access}</div>
                </div>
                <Button variant="ghost" size="sm" disabled className="text-xs">Editar</Button>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-dashed">
            <p className="text-xs text-muted-foreground text-center">
              La gestión de usuarios con roles y permisos estará disponible próximamente con autenticación.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <UserCog className="h-10 w-10 mb-3 text-muted-foreground/30" />
          <h3 className="font-semibold mb-1">Sistema de Roles</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Próximamente: invita a tu equipo técnico y asigna permisos granulares por sección.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
