import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Plus, Users, TrendingUp, Search, Film, X, ChevronRight } from "lucide-react";
import { useListPlayers, useListTeams, useListReports, getListPlayersQueryKey, getListReportsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PlayerHL { id: string; url: string; title: string; addedAt: string }
function getHLs(pid: number): PlayerHL[] {
  try { return JSON.parse(localStorage.getItem(`sp-hl-${pid}`) ?? "[]") as PlayerHL[]; }
  catch { return []; }
}
function saveHLs(pid: number, hls: PlayerHL[]) {
  localStorage.setItem(`sp-hl-${pid}`, JSON.stringify(hls));
}

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

const EU_NATIONALITIES = new Set([
  "Alemania", "Austria", "Bélgica", "Bulgaria", "Chipre", "Croacia", "Dinamarca",
  "Eslovaquia", "Eslovenia", "Estonia", "Finlandia", "Francia", "Grecia", "Hungría",
  "Irlanda", "Italia", "Letonia", "Lituania", "Luxemburgo", "Malta", "Países Bajos",
  "Polonia", "Portugal", "República Checa", "Rumanía", "Suecia",
  "Germany", "Austria", "Belgium", "France", "Italy", "Portugal", "Greece",
  "Netherlands", "Poland", "Sweden", "Denmark", "Finland", "Czech Republic",
  "Romania", "Hungary", "Croatia", "Slovenia", "Slovakia", "Lithuania",
  "Latvia", "Estonia", "Bulgaria", "Cyprus", "Luxembourg", "Malta", "Ireland",
]);
const SPANISH = new Set(["España", "Spain", "Española", "Español"]);

function playerTipo(nationality: string | null | undefined): "nacional" | "comunitario" | "extranjero" {
  if (!nationality) return "extranjero";
  if (SPANISH.has(nationality)) return "nacional";
  if (EU_NATIONALITIES.has(nationality)) return "comunitario";
  return "extranjero";
}

function ValStars({ rating }: { rating: number | null | undefined }) {
  if (rating == null) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => <Star key={i} className="h-3.5 w-3.5 text-gray-200" />)}
      </div>
    );
  }
  const stars = Math.round(rating / 2);
  return (
    <div className="flex gap-0.5" title={`VAL ${rating}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= stars ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
      ))}
    </div>
  );
}

const TIPO_LABELS: Record<string, string> = {
  ALL: "Todos",
  nacional: "Nacional",
  comunitario: "Comunitario",
  extranjero: "Extranjero",
};

const TIPO_COLORS: Record<string, string> = {
  nacional: "bg-green-50 text-green-700 border border-green-200",
  comunitario: "bg-blue-50 text-blue-700 border border-blue-200",
  extranjero: "bg-orange-50 text-orange-700 border border-orange-200",
};

export default function Fichajes() {
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [leagueFilter, setLeagueFilter] = useState<string>("");
  const [nationalityFilter, setNationalityFilter] = useState<string>("");
  const [tipoFilter, setTipoFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const { data: players, isLoading } = useListPlayers(undefined, { query: { queryKey: getListPlayersQueryKey() } });
  const { data: teams } = useListTeams();
  const { data: reports } = useListReports(undefined, { query: { queryKey: getListReportsQueryKey() } });

  const teamLeagueMap = useMemo(() => {
    const m: Record<number, string> = {};
    (teams ?? []).forEach((t) => { if (t.league) m[t.id] = t.league; });
    return m;
  }, [teams]);

  const allLeagues = useMemo(() => {
    const s = new Set<string>();
    (teams ?? []).forEach((t) => { if (t.league) s.add(t.league); });
    return [...s].sort();
  }, [teams]);

  const allNationalities = useMemo(() => {
    const s = new Set<string>();
    (players ?? []).forEach((p) => { if (p.nationality) s.add(p.nationality); });
    return [...s].sort();
  }, [players]);

  const playerAvgRating = useMemo(() => {
    const totals: Record<number, { sum: number; count: number }> = {};
    (reports ?? []).forEach((r) => {
      if (r.rating != null) {
        if (!totals[r.playerId]) totals[r.playerId] = { sum: 0, count: 0 };
        totals[r.playerId].sum += r.rating;
        totals[r.playerId].count += 1;
      }
    });
    const avgs: Record<number, number> = {};
    Object.entries(totals).forEach(([id, { sum, count }]) => {
      avgs[Number(id)] = Math.round((sum / count) * 10) / 10;
    });
    return avgs;
  }, [reports]);

  const hasFilters = !!(positionFilter || leagueFilter || nationalityFilter || tipoFilter !== "ALL" || search.trim());

  const filteredPlayers = useMemo(() => {
    const base = players?.filter((p) => p.watchlisted) ?? [];
    return base.filter((p) => {
      if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.teamName?.toLowerCase().includes(search.toLowerCase())) return false;
      if (positionFilter && p.position !== positionFilter) return false;
      if (leagueFilter) {
        const league = p.teamId ? teamLeagueMap[p.teamId] : undefined;
        if (league !== leagueFilter) return false;
      }
      if (nationalityFilter && p.nationality !== nationalityFilter) return false;
      if (tipoFilter !== "ALL" && playerTipo(p.nationality) !== tipoFilter) return false;
      return true;
    });
  }, [players, positionFilter, leagueFilter, nationalityFilter, tipoFilter, search, teamLeagueMap]);

  const clearFilters = () => {
    setPositionFilter("");
    setLeagueFilter("");
    setNationalityFilter("");
    setTipoFilter("ALL");
    setSearch("");
  };

  const [hlPid, setHlPid] = useState<number | null>(null);
  const [hlItems, setHlItems] = useState<PlayerHL[]>([]);
  const [hlUrl, setHlUrl] = useState("");
  const [hlTitle, setHlTitle] = useState("");
  const [hlVersion, setHlVersion] = useState(0);

  const hlCountMap = useMemo(() => {
    const map: Record<number, number> = {};
    filteredPlayers.forEach((p) => { map[p.id] = getHLs(p.id).length; });
    return map;
  }, [filteredPlayers, hlVersion]);

  const openHlDialog = (e: React.MouseEvent, pid: number) => {
    e.preventDefault();
    e.stopPropagation();
    setHlPid(pid);
    setHlItems(getHLs(pid));
    setHlUrl("");
    setHlTitle("");
  };

  const addHL = () => {
    if (!hlUrl.trim() || hlPid == null) return;
    const newItems: PlayerHL[] = [...hlItems, { id: Date.now().toString(), url: hlUrl.trim(), title: hlTitle.trim(), addedAt: new Date().toISOString() }];
    saveHLs(hlPid, newItems);
    setHlItems(newItems);
    setHlUrl("");
    setHlTitle("");
  };

  const deleteHL = (id: string) => {
    if (hlPid == null) return;
    const newItems = hlItems.filter((h) => h.id !== id);
    saveHLs(hlPid, newItems);
    setHlItems(newItems);
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tight">Fichajes</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestiona tu lista de prospectos a fichar.</p>
        </div>
        <Link href="/players/new">
          <Button className="font-black tracking-wide uppercase text-xs px-5">
            <Plus className="mr-2 h-4 w-4" /> Añadir Prospecto
          </Button>
        </Link>
      </div>

      {/* KPI cards — white */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "A fichar ★",
            value: isLoading ? "—" : String(players?.filter(p => p.watchlisted)?.length ?? 0),
            icon: <Star className="h-5 w-5 text-primary" />,
            accent: "bg-primary/5 text-primary",
          },
          {
            label: "Total en base de datos",
            value: isLoading ? "—" : String(players?.length ?? 0),
            icon: <Users className="h-5 w-5 text-gray-500" />,
            accent: "bg-gray-100 text-gray-500",
          },
          {
            label: "Resultados filtrados",
            value: isLoading ? "—" : String(filteredPlayers.length),
            icon: <TrendingUp className="h-5 w-5 text-gray-500" />,
            accent: "bg-gray-100 text-gray-500",
          },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${card.accent}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{card.label}</p>
              <p className="text-3xl font-black text-gray-800 leading-none mt-1">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar — white card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Buscar nombre..."
              className="pl-9 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 h-8 w-44 text-xs focus-visible:ring-primary/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Position pills */}
          <div className="flex gap-1">
            {["ALL", ...POSITIONS].map((pos) => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos === "ALL" ? "" : pos)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  (pos === "ALL" && !positionFilter) || positionFilter === pos
                    ? "bg-primary text-white shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {pos === "ALL" ? "Todos" : pos}
              </button>
            ))}
          </div>

          {/* Tipo */}
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-600 px-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="nacional">🇪🇸 Nacional</option>
            <option value="comunitario">🇪🇺 Comunitario</option>
            <option value="extranjero">🌍 Extranjero</option>
          </select>

          {/* Nationality */}
          <select
            value={nationalityFilter || "ALL"}
            onChange={(e) => setNationalityFilter(e.target.value === "ALL" ? "" : e.target.value)}
            className="h-8 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-600 px-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          >
            <option value="ALL">Todas las naciones</option>
            {allNationalities.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>

          {/* League */}
          <select
            value={leagueFilter || "ALL"}
            onChange={(e) => setLeagueFilter(e.target.value === "ALL" ? "" : e.target.value)}
            className="h-8 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-600 px-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          >
            <option value="ALL">Todas las ligas</option>
            {allLeagues.map((lg) => <option key={lg} value={lg}>{lg}</option>)}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="h-8 px-3 text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Player list — white card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
            {hasFilters
              ? `Resultados — ${filteredPlayers.length} jugador${filteredPlayers.length !== 1 ? "es" : ""}`
              : `A Fichar ★ — ${filteredPlayers.length} jugador${filteredPlayers.length !== 1 ? "es" : ""}`}
          </h2>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="py-16 text-center">
            <Star className="h-10 w-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-semibold text-gray-400">
              {hasFilters ? "No hay jugadores que coincidan." : "Ningún jugador marcado con ★ todavía."}
            </p>
            {!hasFilters && (
              <p className="text-xs text-gray-300 mt-1">
                Marca jugadores con la estrella en Jugadores o en el Centro de Scouting.
              </p>
            )}
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[auto_1fr_72px_72px_130px_100px_36px_auto] items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <div className="w-10" />
              <div>Jugador</div>
              <div>Pos</div>
              <div>Edad</div>
              <div>Nación / Tipo</div>
              <div>VAL</div>
              <div className="text-center">HL</div>
              <div className="w-4" />
            </div>

            {filteredPlayers.map((p, idx) => {
              const league = p.teamId ? teamLeagueMap[p.teamId] : null;
              const val = playerAvgRating[p.id];
              const tipo = playerTipo(p.nationality);
              return (
                <Link key={p.id} href={`/players/${p.id}`}>
                  <div className={`grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_72px_72px_130px_100px_36px_auto] items-center gap-3 px-4 py-3 cursor-pointer group transition-colors hover:bg-gray-50 ${
                    idx !== filteredPlayers.length - 1 ? "border-b border-gray-100" : ""
                  }`}>
                    <Avatar className="h-9 w-9 border border-gray-100">
                      {p.photoUrl && <AvatarImage src={p.photoUrl} alt={p.name} className="object-cover" />}
                      <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                        {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-800 group-hover:text-primary transition-colors truncate text-sm">{p.name}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {p.teamName ?? "Agente libre"}{league ? ` · ${league}` : ""}
                      </div>
                    </div>
                    <div className="hidden sm:block">
                      <span className="text-[11px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{p.position}</span>
                    </div>
                    <div className="hidden sm:block text-sm font-medium text-gray-500">
                      {p.age != null ? `${p.age}a` : "—"}
                    </div>
                    <div className="hidden sm:flex flex-col gap-0.5">
                      <span className="text-xs text-gray-500 truncate">{p.nationality ?? "—"}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full w-fit ${TIPO_COLORS[tipo]}`}>
                        {TIPO_LABELS[tipo]}
                      </span>
                    </div>
                    <div className="hidden sm:block">
                      <ValStars rating={val} />
                    </div>
                    <button
                      onClick={(e) => openHlDialog(e, p.id)}
                      title="Highlights del jugador"
                      className="hidden sm:flex items-center justify-center relative text-gray-300 hover:text-primary transition"
                    >
                      <Film className="h-4 w-4" />
                      {(hlCountMap[p.id] ?? 0) > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-primary text-[9px] font-bold text-white rounded-full flex items-center justify-center">
                          {hlCountMap[p.id]}
                        </span>
                      )}
                    </button>
                    <ChevronRight className="hidden sm:block h-4 w-4 text-gray-300 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Highlights dialog ── */}
      <Dialog open={hlPid !== null} onOpenChange={(open) => { if (!open) { setHlPid(null); setHlVersion((v) => v + 1); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              Highlights · {filteredPlayers.find((p) => p.id === hlPid)?.name ?? "Jugador"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-200">
              <Input
                value={hlTitle}
                onChange={(e) => setHlTitle(e.target.value)}
                placeholder="Título (opcional)"
                className="text-sm bg-white border-gray-200"
              />
              <div className="flex gap-2">
                <Input
                  value={hlUrl}
                  onChange={(e) => setHlUrl(e.target.value)}
                  placeholder="URL de YouTube, Vimeo o enlace directo…"
                  className="text-sm flex-1 bg-white border-gray-200"
                  onKeyDown={(e) => { if (e.key === "Enter") addHL(); }}
                />
                <Button size="sm" onClick={addHL} disabled={!hlUrl.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {hlItems.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400">
                Sin highlights todavía. Añade un enlace arriba.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {hlItems.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-xl bg-white">
                    <Film className="h-4 w-4 text-gray-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      {h.title && <div className="text-sm font-semibold text-gray-700 truncate">{h.title}</div>}
                      <a href={h.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate block">
                        {h.url}
                      </a>
                    </div>
                    <button onClick={() => deleteHL(h.id)} className="text-gray-300 hover:text-red-400 transition shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
