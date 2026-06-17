import { Users, Video, ClipboardList, Library, Camera, BarChart2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TeamSection = "roster" | "fotos" | "videos" | "sistemas" | "highlights" | "estadisticas";

export const TEAM_SECTIONS: { key: TeamSection; label: string; icon: LucideIcon }[] = [
  { key: "roster",       label: "Plantilla",    icon: Users },
  { key: "estadisticas", label: "Estadísticas", icon: BarChart2 },
  { key: "fotos",        label: "Fotos",        icon: Camera },
  { key: "videos",       label: "Vídeos",       icon: Video },
  { key: "sistemas",     label: "Sistemas",     icon: ClipboardList },
  { key: "highlights",   label: "Highlights",   icon: Library },
];
