// Direct fetch client for the Scouting Report Builder API.
// (These routes are not part of the Orval-generated client.)

export interface ScoutingReportListItem {
  id: string;
  title: string;
  teamId: number | null;
  opponentId: number | null;
  gameId: number | null;
  scoutName: string | null;
  season: string | null;
  status: "draft" | "in_progress" | "finalized";
  coverConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  teamName: string | null;
  opponentName: string | null;
  opponentLogoUrl: string | null;
}

export interface ReportBlockDto {
  id: string;
  sectionId: string;
  blockType: string;
  position: number;
  content: Record<string, unknown>;
  dataSnapshot: Record<string, unknown> | null;
  updatedAt: string;
}

export interface ReportSectionDto {
  id: string;
  reportId: string;
  type: string;
  title: string;
  position: number;
  coachNote: string | null;
  isVisible: boolean;
  config: Record<string, unknown>;
  blocks: ReportBlockDto[];
}

export interface TeamRef {
  id: number;
  name: string;
  league: string | null;
  city: string | null;
  logoUrl: string | null;
}

export interface GameRef {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  location: string | null;
  difficulty: string | null;
}

export interface ScoutingReportFull extends Omit<ScoutingReportListItem, "teamName" | "opponentName" | "opponentLogoUrl"> {
  sections: ReportSectionDto[];
  team: TeamRef | null;
  opponent: TeamRef | null;
  game: GameRef | null;
}

const BASE = "/api/scouting-reports";
const opts: RequestInit = { credentials: "include" };

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Error ${r.status}`);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

export const scoutingReportsApi = {
  list: (season?: string) =>
    fetch(`${BASE}${season ? `?season=${encodeURIComponent(season)}` : ""}`, opts).then((r) =>
      handle<ScoutingReportListItem[]>(r),
    ),
  get: (id: string) => fetch(`${BASE}/${id}`, opts).then((r) => handle<ScoutingReportFull>(r)),
  create: (data: Partial<ScoutingReportListItem>) =>
    fetch(BASE, {
      ...opts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<ScoutingReportFull>(r)),
  update: (id: string, data: Partial<ScoutingReportListItem>) =>
    fetch(`${BASE}/${id}`, {
      ...opts,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<ScoutingReportListItem>(r)),
  remove: (id: string) => fetch(`${BASE}/${id}`, { ...opts, method: "DELETE" }).then((r) => handle<void>(r)),
  createSection: (reportId: string, data: { type: string; title: string; position?: number }) =>
    fetch(`${BASE}/${reportId}/sections`, {
      ...opts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<ReportSectionDto>(r)),
  updateSection: (reportId: string, sectionId: string, data: Partial<ReportSectionDto>) =>
    fetch(`${BASE}/${reportId}/sections/${sectionId}`, {
      ...opts,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<ReportSectionDto>(r)),
  reorderSections: (reportId: string, sectionIds: string[]) =>
    fetch(`${BASE}/${reportId}/sections/reorder`, {
      ...opts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionIds }),
    }).then((r) => handle<ScoutingReportFull>(r)),
  removeSection: (reportId: string, sectionId: string) =>
    fetch(`${BASE}/${reportId}/sections/${sectionId}`, { ...opts, method: "DELETE" }).then((r) => handle<void>(r)),
  createBlock: (reportId: string, sectionId: string, data: { blockType: string; content?: Record<string, unknown> }) =>
    fetch(`${BASE}/${reportId}/sections/${sectionId}/blocks`, {
      ...opts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<ReportBlockDto>(r)),
  updateBlock: (
    reportId: string,
    sectionId: string,
    blockId: string,
    data: { position?: number; content?: Record<string, unknown> },
  ) =>
    fetch(`${BASE}/${reportId}/sections/${sectionId}/blocks/${blockId}`, {
      ...opts,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<ReportBlockDto>(r)),
  removeBlock: (reportId: string, sectionId: string, blockId: string) =>
    fetch(`${BASE}/${reportId}/sections/${sectionId}/blocks/${blockId}`, { ...opts, method: "DELETE" }).then((r) =>
      handle<void>(r),
    ),
  refreshData: (id: string) =>
    fetch(`${BASE}/${id}/refresh-data`, { ...opts, method: "POST" }).then((r) => handle<ScoutingReportFull>(r)),
};

export const SECTION_TYPE_LABELS: Record<string, string> = {
  team_overview: "Visión General",
  match_stats: "Estadísticas del Partido",
  player_stats: "Estadísticas de Jugadoras",
  tactical: "Análisis Táctico",
  plays: "Jugadas",
  videos: "Vídeos",
  game_plan: "Game Plan",
  custom: "Sección Personalizada",
  trends: "Tendencias",
  team_vs_league: "Equipo vs Liga",
  insights: "Insights Automáticos",
  shot_chart: "Carta de Tiro",
};

export const LIVE_DATA_TYPES = new Set([
  "team_overview",
  "match_stats",
  "player_stats",
  "trends",
  "team_vs_league",
  "insights",
  "shot_chart",
]);
