import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Database, ChevronUp, ChevronDown, Minus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LigaJugador {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  nationality: string | null;
  photoUrl: string | null;
  teamName: string;
  leagueName: string;
  leagueFullName: string;
  gender: string;
  seasonName: string;
  gamesPlayed: number;
  minutesAvg: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg2Made: number;
  fg2Att: number;
  fg3Made: number;
  fg3Att: number;
  ftMade: number;
  ftAtt: number;
  pir: number | null;
}

interface LigaOption {
  shortName: string;
  name: string;
  gender: string;
}

type SortKey = "points" | "rebounds" | "assists" | "steals" | "blocks" | "pir" | "gamesPlayed" | "minutesAvg";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const POSITION_LABELS: Record<string, string> = {
  PG: "Base", SG: "Escolta", SF: "Alero", PF: "Ala-Pívot", C: "Pívot",
};

const PCT_COLS: { key: "fg2" | "fg3" | "ft"; label: string }[] = [
  { key: "fg2", label: "T2%" },
  { key: "fg3", label: "T3%" },
  { key: "ft",  label: "TL%" },
];

function pct(made: number, att: number): string {
  if (!att) return "—";
  return ((made / att) * 100).toFixed(0) + "%";
}

function fmt(v: number | null | undefined, dec = 1): string {
  if (v == null) return "—";
  return Number(v).toFixed(dec);
}

function SortArrow({ col, active, dir }: { col: string; active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <Minus size={10} className="opacity-20" />;
  return dir === "desc" ? <ChevronDown size={10} /> : <ChevronUp size={10} />;
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LigaJugadores() {
  const [ligaFilter, setLigaFilter]     = useState("ALL");
  const [posFilter, setPosFilter]       = useState("ALL");
  const [search, setSearch]             = useState("");
  const [sortKey, setSortKey]           = useState<SortKey>("points");
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("desc");

  const { data: ligas = [] } = useQuery<LigaOption[]>({
    queryKey: ["liga-jugadores-ligas"],
    queryFn:  () => fetch("/api/liga-jugadores/ligas").then((r) => r.json()),
  });

  const params = new URLSearchParams();
  if (ligaFilter !== "ALL") params.set("liga", ligaFilter);
  if (posFilter  !== "ALL") params.set("posicion", posFilter);
  params.set("limit", "500");

  const { data: players = [], isLoading } = useQuery<LigaJugador[]>({
    queryKey: ["liga-jugadores", ligaFilter, posFilter],
    queryFn:  () => fetch(`/api/liga-jugadores?${params}`).then((r) => r.json()),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter(
      (p) =>
        !q ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q),
    );
  }, [players, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = Number(a[sortKey] ?? 0);
      const vb = Number(b[sortKey] ?? 0);
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [filtered, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const TH = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-2 py-2 text-right cursor-pointer select-none hover:text-zinc-200 transition-colors whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center justify-end gap-0.5">
        {label}
        <SortArrow col={col} active={sortKey === col} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-4xl">Base de Datos FEB</h1>
          <p className="text-muted-foreground text-sm">
            {isLoading ? "Cargando…" : `${sorted.length.toLocaleString("es")} jugadores con estadísticas oficiales`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-3 py-1.5">
          <Database size={12} className="text-emerald-400" />
          BEV · FEB
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar jugador o equipo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <Select value={ligaFilter} onValueChange={setLigaFilter}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="Liga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las ligas</SelectItem>
            {ligas.map((l) => (
              <SelectItem key={l.shortName} value={l.shortName}>
                {l.shortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={posFilter} onValueChange={setPosFilter}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="Posición" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las posiciones</SelectItem>
            {POSITIONS.map((pos) => (
              <SelectItem key={pos} value={pos}>
                {pos} — {POSITION_LABELS[pos]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px]">
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Jugador</th>
              <th className="px-3 py-2 text-left">Equipo / Liga</th>
              <th className="px-2 py-2 text-center">Pos</th>
              <TH col="gamesPlayed" label="PJ" />
              <TH col="minutesAvg" label="Min" />
              <TH col="points" label="Pts" />
              <TH col="rebounds" label="Reb" />
              <TH col="assists" label="Ast" />
              <TH col="steals" label="Ro" />
              <TH col="blocks" label="Tap" />
              <th className="px-2 py-2 text-right whitespace-nowrap">T2%</th>
              <th className="px-2 py-2 text-right whitespace-nowrap">T3%</th>
              <th className="px-2 py-2 text-right whitespace-nowrap">TL%</th>
              <TH col="pir" label="PIR" />
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 15 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-800/60">
                    <td className="px-3 py-2" colSpan={15}>
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              : sorted.map((p, i) => {
                  const name = `${p.firstName} ${p.lastName}`;
                  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7 shrink-0">
                            <AvatarImage src={p.photoUrl ?? undefined} />
                            <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-zinc-200 leading-tight">{name}</div>
                            {p.nationality && (
                              <div className="text-[9px] text-zinc-500">{p.nationality}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="text-zinc-300 leading-tight">{p.teamName}</div>
                        <div className="text-[9px] text-zinc-500">{p.leagueName} · {p.seasonName}</div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {p.position ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-300">
                            {p.position}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{p.gamesPlayed}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.minutesAvg)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-zinc-200">{fmt(p.points)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.rebounds)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.assists)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.steals)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.blocks)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{pct(p.fg2Made, p.fg2Att)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{pct(p.fg3Made, p.fg3Att)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{pct(p.ftMade, p.ftAtt)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {p.pir != null ? (
                          <span className={`font-semibold ${Number(p.pir) >= 15 ? "text-emerald-400" : Number(p.pir) >= 5 ? "text-zinc-200" : "text-zinc-500"}`}>
                            {fmt(p.pir, 0)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!isLoading && sorted.length === 0 && (
          <div className="py-16 text-center text-zinc-500 text-sm">
            No se encontraron jugadores con los filtros seleccionados.
          </div>
        )}
      </div>
    </div>
  );
}
