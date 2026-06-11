import { useState, useEffect } from "react";
import { applyTheme, applyFont, type ThemeId, type FontId } from "@/lib/themes";

const THEME_KEY = "scoutpro-theme";
const FONT_KEY = "scoutpro-font";

export function useTheme() {
  const [themeId, setThemeIdRaw] = useState<ThemeId>(
    () => (localStorage.getItem(THEME_KEY) as ThemeId) ?? "naranja"
  );
  const [fontId, setFontIdRaw] = useState<FontId>(
    () => (localStorage.getItem(FONT_KEY) as FontId) ?? "teko"
  );

  useEffect(() => {
    applyTheme(themeId);
    applyFont(fontId);
  }, []);

  const setTheme = (id: ThemeId) => {
    localStorage.setItem(THEME_KEY, id);
    setThemeIdRaw(id);
    applyTheme(id);
  };

  const setFont = (id: FontId) => {
    localStorage.setItem(FONT_KEY, id);
    setFontIdRaw(id);
    applyFont(id);
  };

  return { themeId, setTheme, fontId, setFont };
}
