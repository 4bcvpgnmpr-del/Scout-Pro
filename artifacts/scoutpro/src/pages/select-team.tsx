import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, ChevronRight, Lock, Zap, Search, ArrowLeft } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface League {
  id: string;
  name: string;
  shortName: string;
  source: string;
  gender: string;
  level: number;
  isAutomated: boolean;
}

interface Team {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  league?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function fetchLeagues(): Promise<League[]> {
  const res = await fetch("/api/admin/sync/status", { credentials: "include" });
  if (!res.ok) return [];
  const sources = await res.json() as Array<{ id: string; leagues: string[] }>;
  return sources.flatMap((s) =>
    s.leagues.map((name, i) => ({
      id:          `${s.id}-${i}`,
      name,
      shortName:   name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 4),
      source:      s.id,
      gender:      name.startsWith("LF") ? "F" : "M",
      level:       1,
      isAutomated: s.id !== "manual",
    })),
  );
}

async function fetchTeams(): Promise<Team[]> {
  const res = await fetch("/api/teams", { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

// ─── Components ───────────────────────────────────────────────────────────────

function GenderBadge({ gender }: { gender: string }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
      gender === "F"
        ? "bg-pink-900/40 text-pink-400 border border-pink-800/40"
        : "bg-blue-900/40 text-blue-400 border border-blue-800/40"
    }`}>
      {gender === "F" ? "Femenino" : "Masculino"}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const label: Record<string, string> = {
    feb: "FEB", euroleague: "EuroLeague", eurocup: "EuroCup", acb: "ACB", manual: "Manual"
  };
  return (
    <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
      {label[source] ?? source.toUpperCase()}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SelectTeamPage() {
  const { user, updateSelectedTeam } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"league" | "team">("league");
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [searchTeam, setSearchTeam] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues-list"],
    queryFn: fetchLeagues,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams-all"],
    queryFn: fetchTeams,
    enabled: step === "team",
  });

  const filteredTeams = teams.filter((t) =>
    (t.name + (t.shortName ?? "")).toLowerCase().includes(searchTeam.toLowerCase())
  );

  const handleSelectLeague = (league: League) => {
    if (league.isAutomated && user?.subscriptionTier !== "professional") return;
    setSelectedLeague(league);
    setStep("team");
  };

  const handleSelectTeam = async (team: Team) => {
    setSaving(true);
    try {
      await fetch("/api/auth/select-team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teamId: team.id }),
      });
      updateSelectedTeam(team.id);
      setSaved(true);
      setTimeout(() => navigate("/"), 1000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {step === "team" && (
          <button
            onClick={() => setStep("league")}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-medium">
            {step === "league" ? "Selecciona tu liga" : `Equipos de ${selectedLeague?.name}`}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {step === "league"
              ? "Elige la liga de tu equipo de trabajo"
              : "Selecciona el equipo con el que vas a trabajar"}
          </p>
        </div>
      </div>

      {/* Step 1: Leagues */}
      {step === "league" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {leagues.length === 0 && (
            /* Fallback: show manual option if API returns nothing */
            <button
              onClick={() => handleSelectLeague({ id: "manual", name: "Liga propia", shortName: "OWN", source: "manual", gender: "M", level: 1, isAutomated: false })}
              className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/40 text-left hover:border-zinc-500 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Liga propia</span>
                <SourceBadge source="manual" />
              </div>
              <p className="text-xs text-zinc-500">Estadísticas manuales</p>
            </button>
          )}
          {leagues.map((league) => {
            const blocked = league.isAutomated && user?.subscriptionTier !== "professional";
            return (
              <button
                key={league.id}
                onClick={() => handleSelectLeague(league)}
                disabled={blocked}
                title={blocked ? "Disponible con el plan Profesional" : undefined}
                className={`rounded-xl p-4 border text-left transition-all ${
                  blocked
                    ? "bg-zinc-900/40 border-zinc-800/40 opacity-50 cursor-not-allowed"
                    : "bg-zinc-800/60 border-zinc-700/40 hover:border-zinc-500 hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{league.name}</span>
                  <div className="flex items-center gap-1.5">
                    {league.isAutomated && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400 border border-amber-700/40 flex items-center gap-1">
                        <Zap size={9} />
                        PRO
                      </span>
                    )}
                    {blocked && <Lock size={12} className="text-zinc-600" />}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <GenderBadge gender={league.gender} />
                  <SourceBadge source={league.source} />
                </div>
                {blocked && (
                  <p className="text-[11px] text-zinc-600 mt-2">Disponible con el plan Profesional</p>
                )}
              </button>
            );
          })}
          {/* Always show manual option */}
          {leagues.length > 0 && !leagues.find((l) => l.source === "manual") && (
            <button
              onClick={() => handleSelectLeague({ id: "manual-own", name: "Liga propia", shortName: "OWN", source: "manual", gender: "M", level: 9, isAutomated: false })}
              className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/40 text-left hover:border-zinc-500 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Liga propia / Manual</span>
                <SourceBadge source="manual" />
              </div>
              <div className="flex items-center gap-1.5">
                <GenderBadge gender="M" />
              </div>
            </button>
          )}
        </div>
      )}

      {/* Step 2: Teams */}
      {step === "team" && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTeam}
              onChange={(e) => setSearchTeam(e.target.value)}
              placeholder="Buscar equipo..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          {filteredTeams.length === 0 ? (
            <div className="text-center py-8 text-sm text-zinc-500">
              No hay equipos registrados.{" "}
              <a href="/teams/new" className="text-zinc-300 hover:text-white">
                Añadir equipo
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTeams.map((team) => {
                const isSelected = user?.selectedTeamId === team.id;
                return (
                  <button
                    key={team.id}
                    onClick={() => handleSelectTeam(team)}
                    disabled={saving}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary/40 text-white"
                        : "bg-zinc-800/60 border-zinc-700/40 hover:border-zinc-500"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300">
                        {team.shortName?.[0] ?? team.name[0]}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">{team.name}</p>
                        {team.shortName && (
                          <p className="text-[11px] text-zinc-500">{team.shortName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {saved && isSelected && (
                        <CheckCircle2 size={16} className="text-green-400" />
                      )}
                      {isSelected ? (
                        <span className="text-[10px] text-primary font-medium">Seleccionado</span>
                      ) : (
                        <ChevronRight size={14} className="text-zinc-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
