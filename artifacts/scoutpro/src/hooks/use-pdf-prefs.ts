/**
 * usePdfPrefs — global PDF appearance preferences.
 * Stored in localStorage so they persist across sessions.
 */

import { useState, useCallback } from "react";

export type PdfFont = "helvetica" | "times" | "courier";

export interface PdfPrefs {
  font: PdfFont;
  accent: string; // hex e.g. "#f97316"
}

export const PDF_PREFS_KEY = "sp-pdf-prefs";

export const DEFAULT_PREFS: PdfPrefs = {
  font: "helvetica",
  accent: "#f97316",
};

export const FONT_OPTIONS: { value: PdfFont; label: string; sample: string }[] = [
  { value: "helvetica", label: "Sans-serif",  sample: "Helvetica" },
  { value: "times",     label: "Serif",        sample: "Times New Roman" },
  { value: "courier",   label: "Monospace",    sample: "Courier" },
];

export const COLOR_PRESETS = [
  { hex: "#f97316", label: "Naranja"  },
  { hex: "#3b82f6", label: "Azul"     },
  { hex: "#16a34a", label: "Verde"    },
  { hex: "#ef4444", label: "Rojo"     },
  { hex: "#8b5cf6", label: "Morado"   },
  { hex: "#0891b2", label: "Teal"     },
  { hex: "#1d4ed8", label: "Marino"   },
  { hex: "#374151", label: "Pizarra"  },
];

export function loadPdfPrefs(): PdfPrefs {
  try {
    const raw = localStorage.getItem(PDF_PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<PdfPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePdfPrefs(prefs: PdfPrefs) {
  try {
    localStorage.setItem(PDF_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* noop */ }
}

export function usePdfPrefs() {
  const [prefs, setPrefsState] = useState<PdfPrefs>(loadPdfPrefs);

  const setPrefs = useCallback((next: Partial<PdfPrefs>) => {
    setPrefsState(prev => {
      const updated = { ...prev, ...next };
      savePdfPrefs(updated);
      return updated;
    });
  }, []);

  return { prefs, setPrefs };
}
