import { useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useListGames, getListGamesQueryKey } from "@workspace/api-client-react";
import { Crosshair, Trophy, Calendar, MapPin, Loader2, Plus } from "lucide-react";
import { DIFFICULTY_BADGE, DIFFICULTY_LABEL } from "@/lib/difficulty";

function DiffBadge({ diff }: { diff: string | null | undefined }) {
  if (!diff) return null;
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${DIFFICULTY_BADGE[diff] ?? "bg-white/5 text-white/40"}`}>
      {DIFFICULTY_LABEL[diff] ?? diff}
    </span>
  );
}

function daysUntil(d: string) {
  return Math.max(0, Math.floor((new Date(d + "T23:59:59").getTime() - Date.now()) / 86_400_000));
}

export default function MatchCenterHub() {
  const [, setLocation] = useLocation();
  const { data: games, isLoading } = useListGames({ query: { queryKey: getListGamesQueryKey() } });

  const todayKey = new Date().toISOString().slice(0, 10);

  const upcoming = useMemo(
    () => (games ?? []).filter(g => g.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date)),
    [games, todayKey],
  );
  const past = useMemo(
    () => (games ?? []).filter(g => g.date < todayKey).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [games, todayKey],
  );

  const next = upcoming[0];
  if (!isLoading && next) {
    setLocation(`/games/${next.id}/match-center`);
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
            <Crosshair className="h-7 w-7 text-primary" /> Centro de Partido
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Selecciona un partido para comenzar la preparación</p>
        </div>
        <Link href="/games/new">
          <button className="flex items-center gap-2 bg-primary text-primary-foreground font-black px-4 py-2 rounded-xl text-sm hover:bg-primary/90 transition">
            <Plus className="h-4 w-4" /> Nuevo Partido
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <div>
              <p className="text-[11px] font-black text-primary uppercase tracking-widest mb-3">Próximos Partidos</p>
              <div className="space-y-2">
                {upcoming.map(g => (
                  <Link key={g.id} href={`/games/${g.id}/match-center`}>
                    <div className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 hover:border-primary/40 hover:bg-primary/5 transition cursor-pointer group">
                      <Trophy className="h-5 w-5 text-primary/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-foreground text-sm">{g.homeTeam} <span className="text-muted-foreground font-normal">vs</span> {g.awayTeam}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(g.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</span>
                          {g.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {g.location}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <DiffBadge diff={g.difficulty} />
                        <span className="text-[11px] font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                          {daysUntil(g.date) === 0 ? "HOY" : `${daysUntil(g.date)}d`}
                        </span>
                        <span className="text-muted-foreground/30 group-hover:text-primary transition text-lg">→</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl">
              <Crosshair className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No hay partidos próximos</p>
              <p className="text-sm text-muted-foreground/60 mt-1 mb-4">Registra un partido para comenzar la preparación</p>
              <Link href="/games/new">
                <button className="bg-primary text-primary-foreground font-black px-5 py-2.5 rounded-xl text-sm hover:bg-primary/90 transition">
                  Registrar Partido
                </button>
              </Link>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <p className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-widest mb-3">Partidos Recientes</p>
              <div className="space-y-2">
                {past.map(g => (
                  <Link key={g.id} href={`/games/${g.id}/match-center`}>
                    <div className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 hover:border-border/60 transition cursor-pointer opacity-70 hover:opacity-100 group">
                      <Trophy className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">{g.homeTeam} <span className="text-muted-foreground font-normal">vs</span> {g.awayTeam}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{new Date(g.date + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}</span>
                          {g.homeScore != null && g.awayScore != null && (
                            <span className="font-black text-foreground">{g.homeScore} – {g.awayScore}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-muted-foreground/20 group-hover:text-muted-foreground/50 transition text-lg">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
