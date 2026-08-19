import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Palette, Type, Check } from "lucide-react";
import { THEMES, FONTS, applyTheme, applyFont, type ThemeId, type FontId } from "@/lib/themes";
import { useToast } from "@/hooks/use-toast";

export default function Ajustes() {
  const { toast } = useToast();
  const [activeTheme, setActiveTheme] = useState<ThemeId>(
    () => (localStorage.getItem("sp-theme") as ThemeId) ?? "naranja",
  );
  const [activeFont, setActiveFont] = useState<FontId>(
    () => (localStorage.getItem("sp-font") as FontId) ?? "teko",
  );

  useEffect(() => {
    applyTheme(activeTheme);
    localStorage.setItem("sp-theme", activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    applyFont(activeFont);
    localStorage.setItem("sp-font", activeFont);
  }, [activeFont]);

  const save = () => toast({ title: "Ajustes guardados" });

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-4xl font-display tracking-wide">Ajustes</h1>
        <p className="text-muted-foreground text-sm">Personaliza la apariencia de ScoutFlow.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-4 space-y-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-base">Color del equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {THEMES.map((t) => {
              const isActive = activeTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTheme(t.id)}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    isActive ? "border-primary" : "border-border hover:border-border/80"
                  }`}
                >
                  <div
                    className="h-10 w-10 rounded-full shadow-md"
                    style={{ background: t.swatch }}
                  />
                  <span className="text-xs font-medium">{t.name}</span>
                  {isActive && (
                    <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-4 space-y-0">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <Type className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-base">Tipografía</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FONTS.map((f) => {
              const isActive = activeFont === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFont(f.id)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    isActive ? "border-primary bg-primary/5" : "border-border hover:border-border/80"
                  }`}
                >
                  <span className="text-2xl font-display tracking-wider" style={{ fontFamily: f.family }}>
                    {f.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{f.name}</span>
                  {isActive && (
                    <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-4 space-y-0">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <Settings className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-base">Aplicación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Temporada activa", value: "2024–2025" },
            { label: "Zona horaria", value: "Europe/Madrid" },
            { label: "Idioma", value: "Español" },
            { label: "Versión", value: "1.0.0 beta" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} className="font-display tracking-wide uppercase">
          Guardar ajustes
        </Button>
      </div>
    </div>
  );
}
