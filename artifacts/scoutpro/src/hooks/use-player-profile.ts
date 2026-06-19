import { useState, useRef, useCallback } from "react";

export interface SeasonStats {
  gamesPlayed: string;
  minutes: string;
  points: string;
  offReb: string;
  defReb: string;
  assists: string;
  steals: string;
  blocks: string;
  turnovers: string;
  fouls: string;
  fgMade: string;
  fgAtt: string;
  t3Made: string;
  t3Att: string;
  ftMade: string;
  ftAtt: string;
}

export interface AdvancedStatsManual {
  per: string;
  ortg: string;
  drtg: string;
  netRtg: string;
  usagePct: string;
  pace: string;
}

export interface VideoEntry {
  id: string;
  url: string;
  title: string;
  category: string;
  tags: string;
  date: string;
}

export interface ExtendedProfile {
  secondaryPosition: string;
  birthday: string;
  playStyle: string;
  role: string;
  strengths: string;
  weaknesses: string;
  potential: string;
  currentLevel: string;
  overallRating: string;
  technicalNotes: string;
  tacticalNotes: string;
  physicalNotes: string;
  offensiveTendencies: string;
  defensiveTendencies: string;
  transitionBehavior: string;
  decisionMaking: string;
  tacticalReading: string;
  pressurePerformance: string;
  scoutingNotes: string;
  seasonStats: SeasonStats;
  advancedStats: AdvancedStatsManual;
  videos: VideoEntry[];
}

const DEFAULT_STATS: SeasonStats = {
  gamesPlayed: "", minutes: "", points: "", offReb: "", defReb: "",
  assists: "", steals: "", blocks: "", turnovers: "", fouls: "",
  fgMade: "", fgAtt: "", t3Made: "", t3Att: "", ftMade: "", ftAtt: "",
};

const DEFAULT_ADVANCED: AdvancedStatsManual = {
  per: "", ortg: "", drtg: "", netRtg: "", usagePct: "", pace: "",
};

const DEFAULT_PROFILE: ExtendedProfile = {
  secondaryPosition: "",
  birthday: "",
  playStyle: "",
  role: "",
  strengths: "",
  weaknesses: "",
  potential: "",
  currentLevel: "",
  overallRating: "",
  technicalNotes: "",
  tacticalNotes: "",
  physicalNotes: "",
  offensiveTendencies: "",
  defensiveTendencies: "",
  transitionBehavior: "",
  decisionMaking: "",
  tacticalReading: "",
  pressurePerformance: "",
  scoutingNotes: "",
  seasonStats: DEFAULT_STATS,
  advancedStats: DEFAULT_ADVANCED,
  videos: [],
};

function storageKey(playerId: number) {
  return `sp-profile-${playerId}`;
}

function loadProfile(playerId: number): ExtendedProfile {
  try {
    const raw = localStorage.getItem(storageKey(playerId));
    if (!raw) return DEFAULT_PROFILE;
    const saved = JSON.parse(raw) as Partial<ExtendedProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...saved,
      seasonStats: { ...DEFAULT_STATS, ...(saved.seasonStats ?? {}) },
      advancedStats: { ...DEFAULT_ADVANCED, ...(saved.advancedStats ?? {}) },
      videos: saved.videos ?? [],
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function getStoredProfile(playerId: number): ExtendedProfile {
  return loadProfile(playerId);
}

export function computeAdvancedStats(s: SeasonStats) {
  const pts = Number(s.points);
  const fgm = Number(s.fgMade);
  const fga = Number(s.fgAtt);
  const t3m = Number(s.t3Made);
  const ftm = Number(s.ftMade);
  const fta = Number(s.ftAtt);

  const eFG = fga > 0 ? ((fgm + 0.5 * t3m) / fga) * 100 : null;
  const tS = fga + fta > 0 ? (pts / (2 * (fga + 0.44 * fta))) * 100 : null;

  return {
    eFG: eFG !== null ? eFG.toFixed(1) : null,
    tS: tS !== null ? tS.toFixed(1) : null,
  };
}

export function usePlayerProfile(playerId: number) {
  const [profile, setProfile] = useState<ExtendedProfile>(() =>
    loadProfile(playerId)
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (patch: Partial<ExtendedProfile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        if (timer.current) clearTimeout(timer.current);
        setSaving(true);
        timer.current = setTimeout(() => {
          localStorage.setItem(storageKey(playerId), JSON.stringify(next));
          setSaving(false);
          setSavedAt(new Date());
        }, 600);
        return next;
      });
    },
    [playerId]
  );

  const updateStats = useCallback(
    (patch: Partial<SeasonStats>) => {
      setProfile((prev) => {
        const next = { ...prev, seasonStats: { ...prev.seasonStats, ...patch } };
        if (timer.current) clearTimeout(timer.current);
        setSaving(true);
        timer.current = setTimeout(() => {
          localStorage.setItem(storageKey(playerId), JSON.stringify(next));
          setSaving(false);
          setSavedAt(new Date());
        }, 600);
        return next;
      });
    },
    [playerId]
  );

  const updateAdvanced = useCallback(
    (patch: Partial<AdvancedStatsManual>) => {
      setProfile((prev) => {
        const next = { ...prev, advancedStats: { ...prev.advancedStats, ...patch } };
        if (timer.current) clearTimeout(timer.current);
        setSaving(true);
        timer.current = setTimeout(() => {
          localStorage.setItem(storageKey(playerId), JSON.stringify(next));
          setSaving(false);
          setSavedAt(new Date());
        }, 600);
        return next;
      });
    },
    [playerId]
  );

  const addVideo = useCallback(
    (video: Omit<VideoEntry, "id">) => {
      const newVideo: VideoEntry = { ...video, id: crypto.randomUUID() };
      setProfile((prev) => {
        const next = { ...prev, videos: [newVideo, ...prev.videos] };
        localStorage.setItem(storageKey(playerId), JSON.stringify(next));
        return next;
      });
    },
    [playerId]
  );

  const removeVideo = useCallback(
    (id: string) => {
      setProfile((prev) => {
        const next = { ...prev, videos: prev.videos.filter((v) => v.id !== id) };
        localStorage.setItem(storageKey(playerId), JSON.stringify(next));
        return next;
      });
    },
    [playerId]
  );

  return { profile, update, updateStats, updateAdvanced, addVideo, removeVideo, saving, savedAt };
}
