import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronRight,
  Shield,
  TrendingUp,
  TrendingDown,
  Check,
  Pencil,
  Trash2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { scoutingReportsApi, type ScoutingReportFull, type ReportSectionDto } from "@/lib/scouting-reports-api";

// ─── Shared fetch helper ─────────────────────────────────────────────────────

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${(Number(v) * 100).toFixed(d)}%`);
const num = (v: number | null | undefined, d = 1) => (v == null ? "—" : Number(v).toFixed(d));

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamOverviewData {
  teamId: number; teamName: string; logoUrl: string | null; league: string | null; seasonName: string | null;
  gamesPlayed: number; wins: number | null; losses: number | null; winPct: number | null; rank: number | null;
  ppg: number | null; oppg: number | null; diff: number | null;
  fgPct: number | null; fg2Pct: number | null; fg3Pct: number | null; ftPct: number | null;
  offReb: number; defReb: number; totReb: number; ast: number; tov: number; stl: number; blk: number; fouls: number; pir: number | null;
  availability: {
    standings: boolean; record: boolean; rank: boolean; pointsFor: boolean;
    pointsAgainst: boolean; diff: boolean; playerStats: boolean;
  };
  provenance: {
    standings: "official" | "partial" | "none";
    playerStats: "season_aggregate" | "none";
  };
  updatedAt: string;
}

interface PlayerStatRow {
  id: number; name: string; position: string | null; jerseyNumber: number | null; photoUrl: string | null;
  height: string | null; age: number | null; nationality: string | null;
  stats: {
    gamesPlayed: number; min: number; pts: number; reb: number; ast: number; stl: number; blk: number; tov: number;
    fgPct: number | null; fg2Pct: number | null; fg3Pct: number | null; ftPct: number | null; pir: number | null;
    fg2Made: number; fg2Att: number; fg3Made: number; fg3Att: number; ftMade: number; ftAtt: number;
  } | null;
}

interface TrendGame {
  gameId: number; date: string; opponent: string; isHome: boolean;
  pointsFor: number; pointsAgainst: number; diff: number; win: boolean;
}

// ─── Empty / loading states ──────────────────────────────────────────────────

function PanelLoading() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function PanelEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

// ─── Coach analysis (collapsible, bound to section.coachNote) ────────────────

export function CoachAnalysis({ reportId, section }: { reportId: string; section: ReportSectionDto }) {
  const [open, setOpen] = useState(Boolean(section.coachNote));
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (coachNote: string | null) =>
      scoutingReportsApi.updateSection(reportId, section.id, { coachNote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scouting-report", reportId] }),
  });

  return (
    <div className="mt-3 border-t border-border/60 pt-2" onClick={(e) => e.stopPropagation()}>
      <button
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition"
        onClick={() => setOpen((v) => !v)}
        data-testid={`button-coach-analysis-${section.id}`}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Análisis del entrenador
        {section.coachNote && !open && <span className="text-[10px] text-primary">●</span>}
      </button>
      {open && (
        <Textarea
          key={`coach-${section.id}`}
          defaultValue={section.coachNote ?? ""}
          rows={3}
          placeholder="Tu lectura táctica de estos datos…"
          className="mt-2 text-sm"
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== (section.coachNote ?? null)) save.mutate(v);
          }}
          data-testid={`textarea-coach-analysis-${section.id}`}
        />
      )}
    </div>
  );
}

// ─── Team overview ───────────────────────────────────────────────────────────

function StatCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <div className={`text-base font-semibold font-mono ${accent ? "text-primary" : ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export function TeamOverviewBlock({ report }: { report: ScoutingReportFull }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["report-team-overview", report.id, report.opponentId, report.updatedAt],
    queryFn: () => getJson<TeamOverviewData>(`/api/scouting-reports/${report.id}/team-overview`),
    enabled: !!report.opponentId,
  });

  if (!report.opponentId) return <PanelEmpty message="Este informe no tiene equipo rival asignado." />;
  if (isLoading) return <PanelLoading />;
  if (error || !data) return <PanelEmpty message={(error as Error)?.message ?? "Sin datos"} />;

  const hasStats = data.availability.standings || data.availability.playerStats;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-full w-full object-contain" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{data.teamName}</div>
          <div className="text-xs text-muted-foreground">
            {[data.league, data.seasonName].filter(Boolean).join(" · ") || "Sin liga vinculada"}
          </div>
        </div>
        {data.rank != null && (
          <Badge variant="outline" className="shrink-0">#{data.rank} clasificación</Badge>
        )}
      </div>

      {!hasStats ? (
        <PanelEmpty message="No hay estadísticas de liga para este equipo. Vincula el equipo con la base de datos de estadísticas o sincroniza la liga." />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            <StatCell label="Balance" value={data.wins != null && data.losses != null ? `${data.wins}-${data.losses}` : "N/D"} accent />
            <StatCell label="% Vict." value={pct(data.winPct, 0)} />
            <StatCell label="PTS" value={num(data.ppg)} />
            <StatCell label="PTS Contra" value={num(data.oppg)} />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <StatCell label="T2%" value={pct(data.fg2Pct)} />
            <StatCell label="T3%" value={pct(data.fg3Pct)} />
            <StatCell label="TL%" value={pct(data.ftPct)} />
            <StatCell label="Dif." value={data.diff == null ? "—" : `${data.diff >= 0 ? "+" : ""}${num(data.diff)}`} accent />
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            <StatCell label="Reb" value={num(data.availability.playerStats ? data.totReb : null)} />
            <StatCell label="R.Of" value={num(data.availability.playerStats ? data.offReb : null)} />
            <StatCell label="Asis" value={num(data.availability.playerStats ? data.ast : null)} />
            <StatCell label="Pérd" value={num(data.availability.playerStats ? data.tov : null)} />
            <StatCell label="Rob" value={num(data.availability.playerStats ? data.stl : null)} />
            <StatCell label="Tap" value={num(data.availability.playerStats ? data.blk : null)} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Match stats ─────────────────────────────────────────────────────────────

interface MatchStatsData {
  game: { id: number; date: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null; location: string | null } | null;
  teamA: TeamOverviewData | null;
  teamB: TeamOverviewData | null;
}

export function MatchStatsBlock({ report }: { report: ScoutingReportFull }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-match-stats", report.id, report.gameId, report.updatedAt],
    queryFn: () => getJson<MatchStatsData>(`/api/scouting-reports/${report.id}/match-stats`),
    enabled: !!report.gameId,
  });

  if (!report.gameId) return <PanelEmpty message="Sin partido vinculado. Asigna un partido al informe para ver la comparativa." />;
  if (isLoading) return <PanelLoading />;
  if (!data?.game) return <PanelEmpty message="El partido vinculado no existe." />;

  const g = data.game;
  const played = g.homeScore != null && g.awayScore != null;
  const rows: Array<{ label: string; a: string; b: string; aVal?: number | null; bVal?: number | null }> = [];
  if (data.teamA && data.teamB) {
    const A = data.teamA, B = data.teamB;
    if (A.ppg != null && B.ppg != null) {
      rows.push({ label: "PTS por partido", a: num(A.ppg), b: num(B.ppg), aVal: A.ppg, bVal: B.ppg });
    }
    if (A.oppg != null && B.oppg != null) {
      rows.push({ label: "PTS en contra", a: num(A.oppg), b: num(B.oppg), aVal: B.oppg, bVal: A.oppg });
    }
    if (A.fg3Pct != null && B.fg3Pct != null) {
      rows.push({ label: "T3%", a: pct(A.fg3Pct), b: pct(B.fg3Pct), aVal: A.fg3Pct, bVal: B.fg3Pct });
    }
    if (A.ftPct != null && B.ftPct != null) {
      rows.push({ label: "TL%", a: pct(A.ftPct), b: pct(B.ftPct), aVal: A.ftPct, bVal: B.ftPct });
    }
    if (A.availability.playerStats && B.availability.playerStats) {
      rows.push(
        { label: "Rebotes", a: num(A.totReb), b: num(B.totReb), aVal: A.totReb, bVal: B.totReb },
        { label: "Asistencias", a: num(A.ast), b: num(B.ast), aVal: A.ast, bVal: B.ast },
        { label: "Pérdidas", a: num(A.tov), b: num(B.tov), aVal: B.tov, bVal: A.tov },
      );
    }
  }

  const chartData: Array<Record<string, string | number>> = [];
  if (data.teamA && data.teamB) {
    const A = data.teamA;
    const B = data.teamB;
    if (A.ppg != null && B.ppg != null) {
      chartData.push({ name: "PTS", [g.homeTeam]: Number(A.ppg.toFixed(1)), [g.awayTeam]: Number(B.ppg.toFixed(1)) });
    }
    if (A.availability.playerStats && B.availability.playerStats) {
      chartData.push(
        { name: "REB", [g.homeTeam]: Number(A.totReb.toFixed(1)), [g.awayTeam]: Number(B.totReb.toFixed(1)) },
        { name: "AST", [g.homeTeam]: Number(A.ast.toFixed(1)), [g.awayTeam]: Number(B.ast.toFixed(1)) },
        { name: "PÉR", [g.homeTeam]: Number(A.tov.toFixed(1)), [g.awayTeam]: Number(B.tov.toFixed(1)) },
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-4 rounded-lg bg-muted/40 p-3">
        <span className="text-sm font-medium text-right flex-1 truncate">{g.homeTeam}</span>
        <span className="font-mono text-xl font-bold">
          {played ? `${g.homeScore} - ${g.awayScore}` : "vs"}
        </span>
        <span className="text-sm font-medium flex-1 truncate">{g.awayTeam}</span>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {g.date}{g.location ? ` · ${g.location}` : ""}
      </p>

      {rows.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border/40 last:border-0">
                <td className={`py-1.5 font-mono text-right w-16 ${r.aVal != null && r.bVal != null && r.aVal > r.bVal ? "text-primary font-semibold" : ""}`}>{r.a}</td>
                <td className="py-1.5 text-center text-xs text-muted-foreground">{r.label}</td>
                <td className={`py-1.5 font-mono w-16 ${r.aVal != null && r.bVal != null && r.bVal > r.aVal ? "text-primary font-semibold" : ""}`}>{r.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {chartData.length > 0 && (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={g.homeTeam} fill="var(--primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey={g.awayTeam} fill="var(--muted-foreground)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {rows.length === 0 && (
        <PanelEmpty message="No hay perfiles estadísticos de temporada para comparar ambos equipos." />
      )}
    </div>
  );
}

// ─── Player stats ────────────────────────────────────────────────────────────

const RANGES = [
  { id: "last1", label: "ÚLTIMO" },
  { id: "last5", label: "ÚLT. 5" },
  { id: "last10", label: "ÚLT. 10" },
  { id: "season", label: "TEMPORADA" },
] as const;

type SortKey = "pts" | "reb" | "ast" | "min" | "pir" | "fg3Pct";

export function PlayerStatsBlock({ report }: { report: ScoutingReportFull }) {
  const [range, setRange] = useState<string>("season");
  const [sortKey, setSortKey] = useState<SortKey>("pts");

  const { data, isLoading } = useQuery({
    queryKey: ["report-player-stats", report.id, report.opponentId, range, report.updatedAt],
    queryFn: () =>
      getJson<{ seasonName: string | null; players: PlayerStatRow[]; rangeApplied: string }>(
        `/api/scouting-reports/${report.id}/player-stats?range=${range}`,
      ),
    enabled: !!report.opponentId,
  });

  const players = useMemo(() => {
    const list = (data?.players ?? []).slice();
    list.sort((a, b) => {
      const av = a.stats?.[sortKey] ?? -Infinity;
      const bv = b.stats?.[sortKey] ?? -Infinity;
      return Number(bv) - Number(av);
    });
    return list;
  }, [data?.players, sortKey]);

  if (!report.opponentId) return <PanelEmpty message="Este informe no tiene equipo rival asignado." />;
  if (isLoading) return <PanelLoading />;
  if (players.length === 0) return <PanelEmpty message="No hay jugadoras registradas del rival." />;

  const headers: Array<{ key: SortKey | null; label: string }> = [
    { key: "min", label: "MIN" },
    { key: "pts", label: "PTS" },
    { key: "reb", label: "REB" },
    { key: "ast", label: "AST" },
    { key: "fg3Pct", label: "T3%" },
    { key: "pir", label: "VAL" },
  ];

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide transition ${
                range === r.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-range-${r.id}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {data?.seasonName && <span className="text-[10px] text-muted-foreground">Temporada {data.seasonName}</span>}
      </div>
      {range !== "season" && data?.rangeApplied === "season" && (
        <p className="text-[10px] text-amber-500">
          Datos por partido no disponibles — se muestran promedios de temporada.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border/60">
              <th className="text-left py-1.5 pr-2 font-medium">Jugadora</th>
              {headers.map((h) => (
                <th key={h.label} className="text-right py-1.5 px-1.5">
                  <button
                    className={`font-medium hover:text-primary ${sortKey === h.key ? "text-primary" : ""}`}
                    onClick={() => h.key && setSortKey(h.key)}
                  >
                    {h.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-border/30 last:border-0" data-testid={`row-player-${p.id}`}>
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <div className="h-6 w-6 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center text-[9px] font-mono text-muted-foreground">
                      {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-full w-full object-cover" /> : (p.jerseyNumber ?? "–")}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">{[p.position, p.height].filter(Boolean).join(" · ")}</div>
                    </div>
                  </div>
                </td>
                <td className="text-right px-1.5 font-mono">{num(p.stats?.min)}</td>
                <td className="text-right px-1.5 font-mono font-semibold">{num(p.stats?.pts)}</td>
                <td className="text-right px-1.5 font-mono">{num(p.stats?.reb)}</td>
                <td className="text-right px-1.5 font-mono">{num(p.stats?.ast)}</td>
                <td className="text-right px-1.5 font-mono">{pct(p.stats?.fg3Pct, 0)}</td>
                <td className="text-right px-1.5 font-mono">{num(p.stats?.pir)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Trends ──────────────────────────────────────────────────────────────────

const TREND_METRICS = [
  { id: "pointsFor", label: "Puntos a favor" },
  { id: "pointsAgainst", label: "Puntos en contra" },
  { id: "diff", label: "Diferencial" },
] as const;

export function TrendsBlock({ report }: { report: ScoutingReportFull }) {
  const [range, setRange] = useState<"last5" | "last10" | "season">("last10");
  const [metric, setMetric] = useState<string>("pointsFor");

  const { data, isLoading } = useQuery({
    queryKey: ["report-trends", report.id, report.opponentId, range, report.updatedAt],
    queryFn: () => getJson<{ teamName: string; games: TrendGame[] }>(`/api/scouting-reports/${report.id}/trends?range=${range}`),
    enabled: !!report.opponentId,
  });

  if (!report.opponentId) return <PanelEmpty message="Este informe no tiene equipo rival asignado." />;
  if (isLoading) return <PanelLoading />;
  const games = data?.games ?? [];
  if (games.length === 0) return <PanelEmpty message="No hay partidos registrados con resultado de este equipo en el calendario." />;

  const chart = games.map((g) => ({
    ...g,
    label: g.date.slice(5),
  }));
  const wins = games.filter((g) => g.win).length;

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {(["last5", "last10", "season"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide transition ${
                range === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "last5" ? "ÚLT. 5" : r === "last10" ? "ÚLT. 10" : "TEMPORADA"}
            </button>
          ))}
        </div>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="h-7 rounded-md border border-border bg-card px-1.5 text-xs"
          data-testid="select-trend-metric"
        >
          {TREND_METRICS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        {games.length} partidos · {wins}V-{games.length - wins}D
      </p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as TrendGame | undefined;
                return p ? `${p.date} · vs ${p.opponent} (${p.isHome ? "casa" : "fuera"})` : "";
              }}
            />
            {metric === "diff" && <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />}
            <Line type="monotone" dataKey={metric} stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Team vs League ──────────────────────────────────────────────────────────

interface TeamVsLeagueData {
  leagueName: string | null;
  seasonName: string | null;
  team: TeamOverviewData;
  league_: {
    ppg: number | null; oppg: number | null; winPct: number | null;
    reb: number | null; ast: number | null; tov: number | null; stl: number | null;
    fgPct: number | null; fg3Pct: number | null; ftPct: number | null;
  };
}

export function TeamVsLeagueBlock({ report }: { report: ScoutingReportFull }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["report-team-vs-league", report.id, report.opponentId, report.updatedAt],
    queryFn: () => getJson<TeamVsLeagueData>(`/api/scouting-reports/${report.id}/team-vs-league`),
    enabled: !!report.opponentId,
    retry: false,
  });

  if (!report.opponentId) return <PanelEmpty message="Este informe no tiene equipo rival asignado." />;
  if (isLoading) return <PanelLoading />;
  if (error || !data) return <PanelEmpty message={(error as Error)?.message ?? "El equipo no tiene datos de liga vinculados."} />;

  const rows: Array<{ label: string; team: number | null; league: number | null; isPct?: boolean; lowerBetter?: boolean }> = [
    { label: "Puntos a favor", team: data.team.ppg, league: data.league_.ppg },
    { label: "Puntos en contra", team: data.team.oppg, league: data.league_.oppg, lowerBetter: true },
    { label: "% Victorias", team: data.team.winPct, league: data.league_.winPct, isPct: true },
    { label: "Tiro de campo %", team: data.team.fgPct, league: data.league_.fgPct, isPct: true },
    { label: "Triples %", team: data.team.fg3Pct, league: data.league_.fg3Pct, isPct: true },
    { label: "Tiros libres %", team: data.team.ftPct, league: data.league_.ftPct, isPct: true },
    {
      label: "Rebotes",
      team: data.team.availability.playerStats ? data.team.totReb : null,
      league: data.league_.reb,
    },
    {
      label: "Asistencias",
      team: data.team.availability.playerStats ? data.team.ast : null,
      league: data.league_.ast,
    },
    {
      label: "Pérdidas",
      team: data.team.availability.playerStats ? data.team.tov : null,
      league: data.league_.tov,
      lowerBetter: true,
    },
    {
      label: "Robos",
      team: data.team.availability.playerStats ? data.team.stl : null,
      league: data.league_.stl,
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {data.team.teamName} vs media de {data.leagueName ?? "la liga"} {data.seasonName ? `(${data.seasonName})` : ""}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border/60">
            <th className="text-left py-1.5 font-medium">Métrica</th>
            <th className="text-right py-1.5 font-medium">Equipo</th>
            <th className="text-right py-1.5 font-medium">Liga</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            if (r.team == null || r.league == null) return null;
            const better = r.lowerBetter ? r.team < r.league : r.team > r.league;
            const fmtV = (v: number) => (r.isPct ? pct(v) : num(v));
            return (
              <tr key={r.label} className="border-b border-border/30 last:border-0">
                <td className="py-1.5">{r.label}</td>
                <td className={`py-1.5 text-right font-mono font-semibold ${better ? "text-green-500" : "text-red-400"}`}>{fmtV(r.team)}</td>
                <td className="py-1.5 text-right font-mono text-muted-foreground">{fmtV(r.league)}</td>
                <td className="py-1.5 text-right">
                  {better ? <TrendingUp className="h-3.5 w-3.5 text-green-500 inline" /> : <TrendingDown className="h-3.5 w-3.5 text-red-400 inline" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Insights ────────────────────────────────────────────────────────────────

interface InsightItem { id: string; text: string; accepted?: boolean }

export function InsightsBlock({ report, section }: { report: ScoutingReportFull; section: ReportSectionDto }) {
  const qc = useQueryClient();
  const block = section.blocks.find((b) => b.blockType === "insights");
  const saved: InsightItem[] = Array.isArray(block?.content?.["insights"])
    ? (block!.content["insights"] as InsightItem[])
    : [];
  const dismissed: string[] = Array.isArray(block?.content?.["dismissed"])
    ? (block!.content["dismissed"] as string[])
    : [];
  const [editing, setEditing] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["report-insights", report.id, report.opponentId, report.updatedAt],
    queryFn: () => getJson<{ insights: Array<{ id: string; text: string }> }>(`/api/scouting-reports/${report.id}/insights`),
    enabled: !!report.opponentId,
  });

  const persist = useMutation({
    mutationFn: async (content: { insights: InsightItem[]; dismissed: string[] }) => {
      if (block) {
        return scoutingReportsApi.updateBlock(report.id, section.id, block.id, { content });
      }
      return scoutingReportsApi.createBlock(report.id, section.id, { blockType: "insights", content });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scouting-report", report.id] }),
  });

  if (!report.opponentId) return <PanelEmpty message="Este informe no tiene equipo rival asignado." />;
  if (isLoading) return <PanelLoading />;

  const savedIds = new Set(saved.map((i) => i.id));
  const suggestions = (data?.insights ?? []).filter((i) => !savedIds.has(i.id) && !dismissed.includes(i.id));

  const accept = (i: { id: string; text: string }) =>
    persist.mutate({ insights: [...saved, { ...i, accepted: true }], dismissed });
  const dismiss = (id: string) =>
    persist.mutate({ insights: saved, dismissed: [...dismissed, id] });
  const removeSaved = (id: string) =>
    persist.mutate({ insights: saved.filter((i) => i.id !== id), dismissed });
  const editSaved = (id: string, text: string) =>
    persist.mutate({ insights: saved.map((i) => (i.id === id ? { ...i, text } : i)), dismissed });

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      {saved.length > 0 && (
        <div className="space-y-1.5">
          {saved.map((i) => (
            <div key={i.id} className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2 text-sm group/insight">
              <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              {editing === i.id ? (
                <Textarea
                  autoFocus
                  defaultValue={i.text}
                  rows={2}
                  className="text-sm flex-1 min-h-0"
                  onBlur={(e) => { editSaved(i.id, e.target.value); setEditing(null); }}
                />
              ) : (
                <span className="flex-1">{i.text}</span>
              )}
              <div className="flex gap-1 opacity-0 group-hover/insight:opacity-100 transition shrink-0">
                <button className="text-muted-foreground hover:text-primary" onClick={() => setEditing(i.id)}><Pencil className="h-3 w-3" /></button>
                <button className="text-muted-foreground hover:text-destructive" onClick={() => removeSaved(i.id)}><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sugerencias automáticas</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Regenerar
            </Button>
          </div>
          {suggestions.map((i) => (
            <div key={i.id} className="flex items-start gap-2 rounded-lg border border-dashed border-border p-2 text-sm text-muted-foreground">
              <span className="flex-1">{i.text}</span>
              <div className="flex gap-1 shrink-0">
                <button className="text-green-500 hover:text-green-400" title="Aceptar" onClick={() => accept(i)} data-testid={`button-accept-insight-${i.id}`}>
                  <Check className="h-4 w-4" />
                </button>
                <button className="text-muted-foreground hover:text-destructive" title="Descartar" onClick={() => dismiss(i.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {saved.length === 0 && suggestions.length === 0 && (
        <PanelEmpty message="No se pudieron generar insights — el rival no tiene datos estadísticos vinculados." />
      )}
    </div>
  );
}

// ─── Shot chart (zone breakdown from season shooting splits) ─────────────────

export function ShotChartBlock({ report }: { report: ScoutingReportFull }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-team-overview", report.id, report.opponentId, report.updatedAt],
    queryFn: () => getJson<TeamOverviewData>(`/api/scouting-reports/${report.id}/team-overview`),
    enabled: !!report.opponentId,
  });

  if (!report.opponentId) return <PanelEmpty message="Este informe no tiene equipo rival asignado." />;
  if (isLoading) return <PanelLoading />;
  if (!data || !data.availability.playerStats) return <PanelEmpty message="Sin datos de tiro para este equipo." />;

  const zoneColor = (p: number | null) => {
    if (p == null) return "var(--muted)";
    if (p >= 0.5) return "rgba(239,68,68,0.35)";
    if (p >= 0.33) return "rgba(245,158,11,0.30)";
    return "rgba(59,130,246,0.25)";
  };

  return (
    <div className="space-y-2">
      <svg viewBox="0 0 300 200" className="w-full max-w-sm mx-auto block">
        {/* court outline */}
        <rect x="1" y="1" width="298" height="198" rx="6" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* 3pt arc zone */}
        <path d="M 20 1 L 20 60 A 130 130 0 0 0 280 60 L 280 1 Z" fill={zoneColor(data.fg3Pct)} stroke="hsl(var(--border))" strokeWidth="1" />
        {/* paint / 2pt zone */}
        <rect x="105" y="1" width="90" height="95" fill={zoneColor(data.fg2Pct)} stroke="hsl(var(--border))" strokeWidth="1" />
        <circle cx="150" cy="96" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
        {/* labels */}
        <text x="150" y="55" textAnchor="middle" className="fill-current" fontSize="14" fontWeight="700">{pct(data.fg2Pct, 0)}</text>
        <text x="150" y="70" textAnchor="middle" fontSize="8" opacity="0.6" className="fill-current">TIROS DE 2 (T2)</text>
        <text x="55" y="140" textAnchor="middle" fontSize="14" fontWeight="700" className="fill-current">{pct(data.fg3Pct, 0)}</text>
        <text x="55" y="153" textAnchor="middle" fontSize="8" opacity="0.6" className="fill-current">TRIPLES (T3)</text>
        <text x="245" y="140" textAnchor="middle" fontSize="14" fontWeight="700" className="fill-current">{pct(data.ftPct, 0)}</text>
        <text x="245" y="153" textAnchor="middle" fontSize="8" opacity="0.6" className="fill-current">TIROS LIBRES</text>
      </svg>
      <p className="text-[10px] text-muted-foreground text-center">
        Porcentajes de temporada por tipo de tiro · datos de zona detallados no disponibles en la fuente
      </p>
    </div>
  );
}
