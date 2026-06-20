import { useState, useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerStats {
  id: string;
  name: string;
  team: string;
  position: string;
  number: string;
  initials: string;
  metrics: AdvancedMetrics;
  history: SeasonHistory[];
  radar: RadarProfile;
}

interface AdvancedMetrics {
  pts: number;
  ast: number;
  reb: number;
  ts: number;
  efg: number;
  usage: number;
  ortg: number;
  drtg: number;
  net: number;
  tov: number;
}

interface SeasonHistory {
  season: string;
  ts: number;
  efg: number;
  usage: number;
  ortg: number;
}

interface RadarProfile {
  scoring: number;
  rebounding: number;
  playmaking: number;
  defense: number;
  efficiency: number;
}

type StatMode = "pergame" | "per36" | "total";

// ─── Advanced Stat Calculations ───────────────────────────────────────────────

export function calcTS(pts: number, fga: number, fta: number): number {
  if (fga === 0 && fta === 0) return 0;
  return (pts / (2 * (fga + 0.44 * fta))) * 100;
}

export function calcEFG(fgm: number, fg3m: number, fga: number): number {
  if (fga === 0) return 0;
  return ((fgm + 0.5 * fg3m) / fga) * 100;
}

export function calcUsage(
  fga: number,
  fta: number,
  tov: number,
  mp: number,
  tmFga: number,
  tmFta: number,
  tmTov: number,
  tmMp: number,
): number {
  const denominator = mp * (tmFga + 0.44 * tmFta + tmTov);
  if (denominator === 0) return 0;
  return (100 * (fga + 0.44 * fta + tov) * (tmMp / 5)) / denominator;
}

export function calcORTG(pts: number, possessions: number): number {
  if (possessions === 0) return 0;
  return (pts / possessions) * 100;
}

export function calcNetRating(ortg: number, drtg: number): number {
  return ortg - drtg;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const PLAYERS: PlayerStats[] = [
  {
    id: "lebron",
    name: "LeBron James",
    team: "LA Lakers",
    position: "SF",
    number: "23",
    initials: "LJ",
    metrics: { pts: 25.7, ast: 8.3, reb: 7.1, ts: 60.2, efg: 54.8, usage: 28.4, ortg: 118, drtg: 110, net: 8, tov: 11.2 },
    history: [
      { season: "22-23", ts: 59.1, efg: 52.3, usage: 30.2, ortg: 116 },
      { season: "23-24", ts: 61.4, efg: 55.1, usage: 27.8, ortg: 119 },
      { season: "24-25", ts: 60.2, efg: 54.8, usage: 28.4, ortg: 118 },
    ],
    radar: { scoring: 88, rebounding: 74, playmaking: 91, defense: 82, efficiency: 70 },
  },
  {
    id: "jokic",
    name: "Nikola Jokić",
    team: "Denver Nuggets",
    position: "C",
    number: "15",
    initials: "NJ",
    metrics: { pts: 29.8, ast: 9.2, reb: 12.4, ts: 66.3, efg: 59.7, usage: 30.1, ortg: 125, drtg: 112, net: 13, tov: 12.8 },
    history: [
      { season: "22-23", ts: 67.8, efg: 62.1, usage: 29.4, ortg: 124 },
      { season: "23-24", ts: 65.1, efg: 58.9, usage: 30.8, ortg: 126 },
      { season: "24-25", ts: 66.3, efg: 59.7, usage: 30.1, ortg: 125 },
    ],
    radar: { scoring: 96, rebounding: 95, playmaking: 88, defense: 90, efficiency: 85 },
  },
  {
    id: "curry",
    name: "Stephen Curry",
    team: "Golden State Warriors",
    position: "PG",
    number: "30",
    initials: "SC",
    metrics: { pts: 26.4, ast: 6.1, reb: 4.5, ts: 64.7, efg: 59.2, usage: 31.2, ortg: 121, drtg: 114, net: 7, tov: 10.1 },
    history: [
      { season: "22-23", ts: 67.0, efg: 61.1, usage: 30.1, ortg: 123 },
      { season: "23-24", ts: 65.3, efg: 60.2, usage: 31.5, ortg: 122 },
      { season: "24-25", ts: 64.7, efg: 59.2, usage: 31.2, ortg: 121 },
    ],
    radar: { scoring: 78, rebounding: 45, playmaking: 82, defense: 60, efficiency: 99 },
  },
];

const RANKING = [
  { name: "Nikola Jokić",   ts: 66.3, ortg: 125, net: 13 },
  { name: "Stephen Curry",  ts: 64.7, ortg: 121, net: 7  },
  { name: "LeBron James",   ts: 60.2, ortg: 118, net: 8  },
  { name: "Giannis A.",     ts: 61.8, ortg: 119, net: 9  },
  { name: "Jayson Tatum",   ts: 57.2, ortg: 115, net: 5  },
  { name: "Luka Dončić",    ts: 58.6, ortg: 116, net: 4  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  fillPct: number;
  color: string;
}

function MetricCard({ label, value, sub, fillPct, color }: MetricCardProps) {
  return (
    <div className="bg-muted rounded-lg px-4 py-3 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className="text-2xl font-medium leading-tight">{value}</span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
      <div className="h-[3px] bg-border rounded-full mt-1">
        <div
          className="h-[3px] rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, fillPct)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function EfficiencyBadge({ net }: { net: number }) {
  if (net >= 8) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium">Élite</span>;
  if (net >= 4) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">Alto</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-medium">Medio</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AdvancedStatsDashboardProps {
  players?: PlayerStats[];
  defaultPlayer?: string;
}

export default function AdvancedStatsDashboard({
  players = PLAYERS,
  defaultPlayer = "lebron",
}: AdvancedStatsDashboardProps) {
  const [selectedId, setSelectedId] = useState(defaultPlayer);
  const [mode, setMode] = useState<StatMode>("pergame");
  const [season, setSeason] = useState("2024-25");

  const player = useMemo(
    () => players.find((p) => p.id === selectedId) ?? players[0],
    [players, selectedId],
  );

  const metrics = player.metrics;

  const metricDefs = [
    { key: "ts",    label: "True Shooting %", sub: "Eficiencia real de tiro",   color: "#378ADD", max: 75,  fmt: (v: number) => v.toFixed(1) + "%" },
    { key: "efg",   label: "eFG%",            sub: "FG ponderando triples",      color: "#1D9E75", max: 70,  fmt: (v: number) => v.toFixed(1) + "%" },
    { key: "usage", label: "Usage Rate",      sub: "% posesiones usadas",        color: "#D85A30", max: 40,  fmt: (v: number) => v.toFixed(1) + "%" },
    { key: "ortg",  label: "ORTG",            sub: "Pts por 100 posesiones",     color: "#7F77DD", max: 130, fmt: (v: number) => Math.round(v).toString() },
    { key: "net",   label: "Net Rating",      sub: "ORTG − DRTG",               color: "#1D9E75", max: 20,  fmt: (v: number) => (v > 0 ? "+" : "") + v },
    { key: "pts",   label: "Puntos",          sub: "Media por partido",          color: "#888780", max: 35,  fmt: (v: number) => v.toFixed(1) },
  ] as const;

  const radarData = [
    { stat: "Anotación",  value: player.radar.scoring },
    { stat: "Rebote",     value: player.radar.rebounding },
    { stat: "Asistencia", value: player.radar.playmaking },
    { stat: "Defensa",    value: player.radar.defense },
    { stat: "Eficiencia", value: player.radar.efficiency },
  ];

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
            {player.initials}
          </div>
          <div>
            <h1 className="text-base font-medium">{player.name}</h1>
            <p className="text-xs text-muted-foreground">
              {player.position} · {player.team} · #{player.number}
            </p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-medium">
          NBA {season}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center text-xs">
        <div className="flex items-center gap-1.5">
          <label className="text-muted-foreground">Jugador</label>
          <select
            className="border rounded px-2 py-1 text-xs bg-background"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-muted-foreground">Tipo</label>
          <select
            className="border rounded px-2 py-1 text-xs bg-background"
            value={mode}
            onChange={(e) => setMode(e.target.value as StatMode)}
          >
            <option value="pergame">Por partido</option>
            <option value="per36">Por 36 min</option>
            <option value="total">Totales</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-muted-foreground">Temporada</label>
          <select
            className="border rounded px-2 py-1 text-xs bg-background"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          >
            <option>2024-25</option>
            <option>2023-24</option>
            <option>2022-23</option>
          </select>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {metricDefs.map((def) => (
          <MetricCard
            key={def.key}
            label={def.label}
            value={def.fmt(metrics[def.key as keyof AdvancedMetrics] as number)}
            sub={def.sub}
            fillPct={(metrics[def.key as keyof AdvancedMetrics] as number / def.max) * 100}
            color={def.color}
          />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Eficiencia por temporada
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={player.history}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="season" tick={{ fontSize: 10 }} />
              <YAxis domain={[20, 80]} tick={{ fontSize: 10 }} tickFormatter={(v) => v + "%"} />
              <Tooltip formatter={(v: number) => v.toFixed(1) + "%"} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="ts"    name="TS%"    stroke="#378ADD" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="efg"   name="eFG%"   stroke="#1D9E75" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 3" />
              <Line type="monotone" dataKey="usage" name="Usage%" stroke="#D85A30" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="2 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Perfil de impacto
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="stat" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar
                name={player.name}
                dataKey="value"
                stroke="#378ADD"
                fill="#378ADD"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Tooltip formatter={(v: number) => v.toFixed(0)} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranking table */}
      <div className="border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Ranking de eficiencia — Top jugadores liga
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-1.5 pr-2 w-7 font-medium">#</th>
              <th className="text-left py-1.5 pr-2 font-medium">Jugador</th>
              <th className="text-right py-1.5 pr-2 font-medium w-14">TS%</th>
              <th className="text-right py-1.5 pr-2 font-medium w-14">ORTG</th>
              <th className="text-right py-1.5 pr-2 font-medium w-16">Net Rtg</th>
              <th className="text-right py-1.5 font-medium w-14">Nivel</th>
            </tr>
          </thead>
          <tbody>
            {RANKING.map((r, i) => {
              const isHighlighted = r.name === player.name;
              return (
                <tr
                  key={r.name}
                  className={`border-b last:border-0 ${isHighlighted ? "bg-blue-50/50" : ""}`}
                >
                  <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className={`py-2 pr-2 ${isHighlighted ? "font-medium" : ""}`}>{r.name}</td>
                  <td className="py-2 pr-2 text-right">{r.ts.toFixed(1)}%</td>
                  <td className="py-2 pr-2 text-right">{r.ortg}</td>
                  <td className="py-2 pr-2 text-right">
                    <span className={r.net >= 0 ? "text-green-700" : "text-red-600"}>
                      {r.net > 0 ? "+" : ""}{r.net}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <EfficiencyBadge net={r.net} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
