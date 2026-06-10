import { useState } from "react";
import { useListPlayers, getListPlayersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Search, Plus, Filter, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Players() {
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  
  const { data: players, isLoading } = useListPlayers(
    positionFilter !== "ALL" ? { position: positionFilter } : undefined,
    { query: { queryKey: getListPlayersQueryKey(positionFilter !== "ALL" ? { position: positionFilter } : undefined) } }
  );

  const filteredPlayers = players?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.teamName?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl">Players</h1>
          <p className="text-muted-foreground">League-wide prospect database.</p>
        </div>
        <Link href="/players/new">
          <Button className="font-display tracking-wide uppercase">
            <Plus className="mr-2 h-4 w-4" /> Add Player
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or team..." 
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[180px] bg-card">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Positions</SelectItem>
            <SelectItem value="PG">PG - Point Guard</SelectItem>
            <SelectItem value="SG">SG - Shooting Guard</SelectItem>
            <SelectItem value="SF">SF - Small Forward</SelectItem>
            <SelectItem value="PF">PF - Power Forward</SelectItem>
            <SelectItem value="C">C - Center</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredPlayers.length === 0 ? (
        <Card className="border-dashed bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted p-3 rounded-full mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No players found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              {search || positionFilter !== "ALL" 
                ? "Try adjusting your search filters to find what you're looking for." 
                : "Your player database is empty. Get started by adding a player."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map(player => (
            <Link key={player.id} href={`/players/${player.id}`}>
              <Card className="hover:border-primary transition-all duration-200 cursor-pointer group hover-elevate">
                <CardContent className="p-5 flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                    <AvatarImage src={player.photoUrl || undefined} alt={player.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-display text-lg">
                      {player.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
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
                      <span className="truncate">
                        {player.teamName || "Free Agent"}
                      </span>
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
