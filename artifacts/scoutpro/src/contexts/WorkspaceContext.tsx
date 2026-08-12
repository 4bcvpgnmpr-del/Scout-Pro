import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type Workspace = {
  id: string;
  seasonId: string;
  seasonName: string;
  leagueId: string;
  leagueName: string;
  teamId: string;
  teamName: string;
};

type WorkspaceContextValue = {
  workspaces: Workspace[];
  activeId: string | null;
  activeWorkspace: Workspace | null;
  activate: (id: string) => void;
  add: (w: Omit<Workspace, "id">) => string;
  remove: (id: string) => void;
};

const STORAGE_KEY = "sf-workspaces";
const ACTIVE_KEY  = "sf-active-ws";

function load(): Workspace[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Workspace[];
  } catch {
    return [];
  }
}

function save(ws: Workspace[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeId:   null,
  activeWorkspace: null,
  activate:   () => {},
  add:        () => "",
  remove:     () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => load());
  const [activeId,   setActiveId]   = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY)
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? null,
    [workspaces, activeId]
  );

  const activate = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }, []);

  const add = useCallback((w: Omit<Workspace, "id">): string => {
    const id = crypto.randomUUID();
    const next = [...workspaces, { ...w, id }];
    setWorkspaces(next);
    save(next);
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
    return id;
  }, [workspaces]);

  const remove = useCallback((id: string) => {
    const next = workspaces.filter((w) => w.id !== id);
    setWorkspaces(next);
    save(next);
    if (activeId === id) {
      const fallback = next[next.length - 1]?.id ?? null;
      setActiveId(fallback);
      if (fallback) localStorage.setItem(ACTIVE_KEY, fallback);
      else localStorage.removeItem(ACTIVE_KEY);
    }
  }, [workspaces, activeId]);

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeId, activeWorkspace, activate, add, remove }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
