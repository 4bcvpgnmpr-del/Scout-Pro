---
name: ScoutPro theme system
description: How color/font theming works in ScoutPro — CSS vars, localStorage, where to call useTheme.
---

# ScoutPro theme system

Theme is applied by setting CSS custom properties on `document.documentElement.style` (not via a React context or className). This means it works globally and persists across page navigation without any provider wrapper.

**Files:**
- `artifacts/scoutpro/src/lib/themes.ts` — palette (ThemeDef[]) and font (FontDef[]) definitions + `applyTheme()` / `applyFont()` helpers.
- `artifacts/scoutpro/src/hooks/use-theme.ts` — reads localStorage, calls applyTheme/applyFont on mount and on change.

**How to apply:**
- Call `useTheme()` once inside the Scout() component (the main route). No provider needed.
- The SettingsPanel component (defined inside scout.tsx) renders a fixed-position overlay with color swatches and font buttons.

**Why:**
- Simple approach that avoids a context/provider. CSS vars on :root propagate to all child elements instantly.
- 5 color palettes: naranja (default), azul, verde, morado, rojo.
- 3 fonts: Teko (deportivo), Oswald (clásico), Barlow Condensed (moderno) — all loaded via Google Fonts in index.css.
