import React, { createContext, useContext, useState, useEffect } from "react";
import { useListSeasons } from "@workspace/api-client-react";
import type { Season } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

type SeasonContextValue = {
  seasons: Season[];
  selectedSeason: Season | null;
  setSelectedSeason: (s: Season | null) => void;
  isLoading: boolean;
};

const SeasonContext = createContext<SeasonContextValue>({
  seasons: [],
  selectedSeason: null,
  setSelectedSeason: () => {},
  isLoading: false,
});

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: seasons = [], isLoading } = useListSeasons({
    query: { enabled: Boolean(user) },
  });
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!user) {
      setSelectedSeason(null);
      setInitialized(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || isLoading || initialized) return;
    if (seasons.length === 0) return;
    const storedId = localStorage.getItem("sf-season");
    const stored = storedId ? seasons.find((s) => s.id === storedId) ?? null : null;
    const current = stored ?? seasons.find((s) => s.isCurrent) ?? seasons[0] ?? null;
    setSelectedSeason(current);
    setInitialized(true);
  }, [user, seasons, isLoading, initialized]);

  const handleSetSeason = (s: Season | null) => {
    setSelectedSeason(s);
    if (s) localStorage.setItem("sf-season", s.id);
    else localStorage.removeItem("sf-season");
  };

  return (
    <SeasonContext.Provider value={{ seasons, selectedSeason, setSelectedSeason: handleSetSeason, isLoading }}>
      {children}
    </SeasonContext.Provider>
  );
}

export const useSeason = () => useContext(SeasonContext);
export type { Season };
