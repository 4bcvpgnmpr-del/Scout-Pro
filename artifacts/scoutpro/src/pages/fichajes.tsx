import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Plus, Users, TrendingUp, ArrowRight, Search, Film, X } from "lucide-react";
import { useListPlayers, useListTeams, useListReports, getListPlayersQueryKey, getListReportsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// EU nationalities for basketball classification (Nacional / Comunitario / Extranjero)
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
        {[1, 2, 3, 4, 5].map((i) => <Star key={i} className="h-3.5 w-3.5 text-muted-foreground/20" />)}
      </div>
    );
  }
  const stars = Math.round(rating / 2);
  return (
    <div className="flex gap-0.5" title={`VAL ${rating}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
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

  const freeAgents = useMemo(() => players?.filter((p) => p.teamId == null) ?? [], [players]);

  const hasFilters = !!(positionFilter || leagueFilter || nationalityFilter || tipoFilter !== "ALL" || search.trim());

  const filteredPlayers = useMemo(() => {
    const base = hasFilters ? (players ?? []) : freeAgents;
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
  }, [players, freeAgents, positionFilter, leagueFilter, nationalityFilter, tipoFilter, search, teamLeagueMap, hasFilters]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-4xl font-display tracking-wide">Fichajes</h1>
          <p className="text-muted-foreground text-sm">Gestiona tu lista de prospectos a fichar.</p>
        </div>
        <Link href="/players/new">
          <Button className="font-display tracking-wide uppercase">
            <Plus className="mr-2 h-4 w-4" /> Añadir Prospecto
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Agentes libres</p>
                <p className="text-3xl font-display">{isLoading ? "—" : freeAgents.length}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Star className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Total prospectos</p>
                <p className="text-3xl font-display">{isLoading ? "—" : (players?.length ?? 0)}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Resultados</p>
                <p className="text-3xl font-display">{isLoading ? "—" : filteredPlayers.length}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre..."
            className="pl-9 bg-card h-9 w-44"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={positionFilter || "ALL"} onValueChange={(v) => setPositionFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="h-9 w-[150px] bg-card text-xs">
            <SelectValue placeholder="Posición" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas posiciones</SelectItem>
            {POSITIONS.map((pos) => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="h-9 w-[160px] bg-card text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            <SelectItem value="nacional">🇪🇸 Nacional</SelectItem>
            <SelectItem value="comunitario">🇪🇺 Comunitario</SelectItem>
            <SelectItem value="extranjero">🌍 Extranjero</SelectItem>
          </SelectContent>
        </Select>

        <Select value={nationalityFilter || "ALL"} onValueChange={(v) => setNationalityFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="h-9 w-[160px] bg-card text-xs">
            <SelectValue placeholder="Nación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las naciones</SelectItem>
            {allNationalities.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={leagueFilter || "ALL"} onValueChange={(v) => setLeagueFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="h-9 w-[160px] bg-card text-xs">
            <SelectValue placeholder="Liga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las ligas</SelectItem>
            {allLeagues.map((lg) => <SelectItem key={lg} value={lg}>{lg}</SelectItem>)}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground h-9 text-xs">
            Limpiar filtros
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {hasFilters
              ? `Resultados — ${filteredPlayers.length} jugador${filteredPlayers.length !== 1 ? "es" : ""}`
              : "Agentes Libres — Candidatos a Fichar"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}</div>
          ) : filteredPlayers.length === 0 ? (
            <div className="py-12 text-center">
              <Star className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {hasFilters ? "No hay jugadores que coincidan." : "No hay prospectos sin equipo asignado"}
              </p>
              {!hasFilters && (
                <Link href="/players/new">
                  <Button variant="outline" size="sm" className="mt-4">Añadir prospecto</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[auto_1fr_80px_80px_120px_100px_40px_auto] items-center gap-3 px-3 pb-1 text-[11px] text-muted-foreground uppercase tracking-wider border-b">
                <div className="w-10" />
                <div>Jugador</div>
                <div>Pos</div>
                <div>Edad</div>
                <div>Nación / Tipo</div>
                <div>VAL</div>
                <div className="text-center w-10">HL</div>
                <div className="w-5" />
              </div>
              {filteredPlayers.map((p) => {
                const league = p.teamId ? teamLeagueMap[p.teamId] : null;
                const val = playerAvgRating[p.id];
                const tipo = playerTipo(p.nationality);
                return (
                  <Link key={p.id} href={`/players/${p.id}`}>
                    <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_80px_80px_120px_100px_40px_auto] items-center gap-3 p-3 rounded-lg border hover:border-primary/50 cursor-pointer group transition-colors">
                      <Avatar className="h-10 w-10">
                        {p.photoUrl && <AvatarImage src={p.photoUrl} alt={p.name} className="object-cover" />}
                        <AvatarFallback className="bg-primary/10 text-primary font-display text-sm">
                          {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium group-hover:text-primary transition-colors truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.teamName ?? "Agente libre"}{league ? ` · ${league}` : ""}
                        </div>
                      </div>
                      <div className="hidden sm:block">
                        <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{p.position}</span>
                      </div>
                      <div className="hidden sm:block text-sm text-muted-foreground">
                        {p.age != null ? `${p.age} años` : "—"}
                      </div>
                      <div className="hidden sm:flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground truncate">{p.nationality ?? "—"}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full w-fit ${
                          tipo === "nacional" ? "bg-green-500/15 text-green-400" :
                          tipo === "comunitario" ? "bg-blue-500/15 text-blue-400" :
                          "bg-orange-500/15 text-orange-400"
                        }`}>
                          {TIPO_LABELS[tipo]}
                        </span>
                      </div>
                      <div className="hidden sm:block">
                        <ValStars rating={val} />
                      </div>
                      <button
                        onClick={(e) => openHlDialog(e, p.id)}
                        title="Highlights del jugador"
                        className="hidden sm:flex items-center justify-center relative text-muted-foreground/40 hover:text-primary transition"
                      >
                        <Film className="h-4 w-4" />
                        {(hlCountMap[p.id] ?? 0) > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-primary text-[9px] font-bold text-primary-foreground rounded-full flex items-center justify-center">
                            {hlCountMap[p.id]}
                          </span>
                        )}
                      </button>
                      <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
            {/* Add form */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2 border">
              <Input
                value={hlTitle}
                onChange={(e) => setHlTitle(e.target.value)}
                placeholder="Título (opcional)"
                className="text-sm"
              />
              <div className="flex gap-2">
                <Input
                  value={hlUrl}
                  onChange={(e) => setHlUrl(e.target.value)}
                  placeholder="URL de YouTube, Vimeo o enlace directo…"
                  className="text-sm flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") addHL(); }}
                />
                <Button size="sm" onClick={addHL} disabled={!hlUrl.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* List */}
            {hlItems.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Sin highlights todavía. Añade un enlace arriba.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {hlItems.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 p-2.5 border rounded-lg bg-card">
                    <Film className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      {h.title && <div className="text-sm font-medium truncate">{h.title}</div>}
                      <a href={h.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate block">
                        {h.url}
                      </a>
                    </div>
                    <button onClick={() => deleteHL(h.id)} className="text-muted-foreground/40 hover:text-destructive transition shrink-0">
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
