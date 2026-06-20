import { useState } from "react";
import { useListPlayers, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useSeason } from "@/contexts/SeasonContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Search, Plus, Filter, ArrowRight, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const POSITIONS = [
  { value: "ALL", label: "Todas las posiciones" },
  { value: "PG", label: "PG — Base" },
  { value: "SG", label: "SG — Escolta" },
  { value: "SF", label: "SF — Alero" },
  { value: "PF", label: "PF — Ala-Pívot" },
  { value: "C", label: "C — Pívot" },
];

export default function Players() {
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const { selectedSeason } = useSeason();

  const { data: players, isLoading } = useListPlayers(
    positionFilter !== "ALL" ? { position: positionFilter } : undefined,
    {
      query: {
        queryKey: [
          ...getListPlayersQueryKey(positionFilter !== "ALL" ? { position: positionFilter } : undefined),
          selectedSeason?.id,
        ],
      },
    },
  );

  const filteredPlayers = (players ?? []).filter(
    (p) =>
      (!search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.teamName?.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl">Jugadores</h1>
          <p className="text-muted-foreground">Base de datos de prospectos scouting.</p>
        </div>
        <Link href="/players/new">
          <Button className="font-display tracking-wide uppercase">
            <Plus className="mr-2 h-4 w-4" /> Añadir Jugador
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o equipo..."
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[200px] bg-card">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Posición" />
          </SelectTrigger>
          <SelectContent>
            {POSITIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filteredPlayers.length === 0 ? (
        <Card className="border-dashed bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted p-3 rounded-full mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No se encontraron jugadores</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Prueba con otros filtros de búsqueda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map((player) => (
            <Link key={player.id} href={`/players/${player.id}`}>
              <Card className="hover:border-primary transition-all duration-200 cursor-pointer group hover-elevate">
                <CardContent className="p-5 flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                    <AvatarImage src={player.photoUrl || undefined} alt={player.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-display text-lg">
                      {player.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="font-semibold truncate group-hover:text-primary transition-colors">
                      {player.name}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground mt-1 gap-2">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded font-bold text-foreground">
                        {player.position}
                      </span>
                      <span className="truncate">{player.teamName || "Agente libre"}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
