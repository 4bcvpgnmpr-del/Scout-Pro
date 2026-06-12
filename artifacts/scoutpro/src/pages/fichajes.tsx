import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Plus, Users, TrendingUp, ArrowRight } from "lucide-react";
import { useListPlayers, useListTeams, getListPlayersQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

export default function Fichajes() {
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [leagueFilter, setLeagueFilter] = useState<string>("");

  const { data: players, isLoading } = useListPlayers(undefined, { query: { queryKey: getListPlayersQueryKey() } });
  const { data: teams } = useListTeams();

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

  const freeAgents = useMemo(() => players?.filter((p) => p.teamId == null) ?? [], [players]);

  const filteredPlayers = useMemo(() => {
    const base = players ?? [];
    return base.filter((p) => {
      if (positionFilter && p.position !== positionFilter) return false;
      if (leagueFilter) {
        const league = p.teamId ? teamLeagueMap[p.teamId] : undefined;
        if (league !== leagueFilter) return false;
      }
      return true;
    });
  }, [players, positionFilter, leagueFilter, teamLeagueMap]);

  const hasFilters = positionFilter || leagueFilter;
  const displayList = hasFilters ? filteredPlayers : freeAgents;

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
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Resultados filtrados</p>
                <p className="text-3xl font-display">{isLoading ? "—" : displayList.length}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={positionFilter || "ALL"} onValueChange={(v) => setPositionFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-[160px] bg-card">
            <SelectValue placeholder="Posición" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las posiciones</SelectItem>
            {POSITIONS.map((pos) => (
              <SelectItem key={pos} value={pos}>{pos}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={leagueFilter || "ALL"} onValueChange={(v) => setLeagueFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-[180px] bg-card">
            <SelectValue placeholder="Liga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las ligas</SelectItem>
            {allLeagues.map((lg) => (
              <SelectItem key={lg} value={lg}>{lg}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setPositionFilter(""); setLeagueFilter(""); }}
            className="text-muted-foreground"
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {hasFilters
              ? `Resultados — ${displayList.length} jugador${displayList.length !== 1 ? "es" : ""}`
              : "Agentes Libres — Candidatos a Fichar"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}</div>
          ) : displayList.length === 0 ? (
            <div className="py-12 text-center">
              <Star className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {hasFilters ? "No hay jugadores que coincidan con los filtros." : "No hay prospectos sin equipo asignado"}
              </p>
              {!hasFilters && (
                <Link href="/players/new">
                  <Button variant="outline" size="sm" className="mt-4">Añadir prospecto</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {displayList.map((p) => {
                const league = p.teamId ? teamLeagueMap[p.teamId] : null;
                return (
                  <Link key={p.id} href={`/players/${p.id}`}>
                    <div className="flex items-center gap-4 p-3 rounded-lg border hover:border-primary/50 cursor-pointer group transition-colors">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary font-display text-sm">
                          {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium group-hover:text-primary transition-colors truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.position}
                          {p.teamName ? ` · ${p.teamName}` : " · Agente libre"}
                          {league ? ` · ${league}` : ""}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
