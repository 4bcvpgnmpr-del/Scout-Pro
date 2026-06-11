import { useState, useEffect } from "react";

export type ReportSectionKey =
  | "estadisticas"
  | "valoraciones"
  | "fortalezas"
  | "debilidades"
  | "resumen"
  | "recomendacion";

export const REPORT_SECTIONS: { key: ReportSectionKey; label: string }[] = [
  { key: "estadisticas", label: "Estadísticas" },
  { key: "valoraciones", label: "Valoraciones" },
  { key: "fortalezas", label: "Fortalezas" },
  { key: "debilidades", label: "Debilidades" },
  { key: "resumen", label: "Resumen" },
  { key: "recomendacion", label: "Recomendación" },
];

export type ReportSections = Record<ReportSectionKey, boolean>;

const DEFAULT_SECTIONS: ReportSections = {
  estadisticas: true,
  valoraciones: true,
  fortalezas: true,
  debilidades: true,
  resumen: true,
  recomendacion: true,
};

const KEY = "scoutpro-report-sections";

export function useReportPrefs() {
  const [sections, setSections] = useState<ReportSections>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULT_SECTIONS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return DEFAULT_SECTIONS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(sections));
    } catch {
      /* ignore */
    }
  }, [sections]);

  const toggleSection = (key: ReportSectionKey) =>
    setSections((s) => ({ ...s, [key]: !s[key] }));

  return { sections, toggleSection };
}
