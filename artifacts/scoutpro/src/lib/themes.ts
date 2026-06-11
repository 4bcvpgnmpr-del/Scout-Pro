export type ThemeId = "naranja" | "azul" | "verde" | "morado" | "rojo";
export type FontId = "teko" | "oswald" | "barlow";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  primary: string;
  sidebar: string;
  swatch: string;
}

export const THEMES: ThemeDef[] = [
  { id: "naranja", name: "Naranja", primary: "24 100% 50%",  sidebar: "224 45% 10%", swatch: "#ff6600" },
  { id: "azul",    name: "Azul",    primary: "217 91% 60%",  sidebar: "222 47% 11%", swatch: "#3b82f6" },
  { id: "verde",   name: "Verde",   primary: "142 71% 42%",  sidebar: "150 30% 10%", swatch: "#22c55e" },
  { id: "morado",  name: "Morado",  primary: "262 83% 58%",  sidebar: "250 35% 10%", swatch: "#a855f7" },
  { id: "rojo",    name: "Rojo",    primary: "0 84% 55%",    sidebar: "0 30% 10%",   swatch: "#ef4444" },
];

export interface FontDef {
  id: FontId;
  name: string;
  family: string;
  label: string;
}

export const FONTS: FontDef[] = [
  { id: "teko",   name: "Teko",             family: "'Teko', sans-serif",             label: "DEPORTIVO" },
  { id: "oswald", name: "Oswald",           family: "'Oswald', sans-serif",           label: "CLÁSICO" },
  { id: "barlow", name: "Barlow Condensed", family: "'Barlow Condensed', sans-serif", label: "MODERNO" },
];

export function applyTheme(themeId: ThemeId) {
  const t = THEMES.find((x) => x.id === themeId) ?? THEMES[0];
  const r = document.documentElement;
  r.style.setProperty("--primary", t.primary);
  r.style.setProperty("--ring", t.primary);
  r.style.setProperty("--sidebar", t.sidebar);
  r.style.setProperty("--sidebar-primary", t.primary);
  r.style.setProperty("--sidebar-ring", t.primary);
  r.style.setProperty("--chart-1", t.primary);
}

export function applyFont(fontId: FontId) {
  const f = FONTS.find((x) => x.id === fontId) ?? FONTS[0];
  document.documentElement.style.setProperty("--app-font-display", f.family);
}
