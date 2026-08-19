import { QueryClient } from "@tanstack/react-query";

export type PlayCategory = "ataque" | "defensa" | "especiales";

export interface PlayElement {
  id: string;
  type: "attacker" | "defender" | "ball" | "move" | "pass" | "screen" | "zone" | "text";
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  label?: string;
  color?: string;
  [key: string]: any;
}

export interface PlayFrame {
  id?: string;
  playId?: string;
  frameIndex: number;
  elements: PlayElement[];
  createdAt?: string;
}

export interface Play {
  id: string;
  title: string;
  category: PlayCategory;
  description: string | null;
  teamId: number | null;
  isLibrary: boolean;
  createdAt: string;
  updatedAt: string;
  frames: PlayFrame[];
}

const BASE_URL = "/api/plays";
const opts: RequestInit = { credentials: "include" };

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `Error ${r.status}`);
  }
  if (r.status === 204) return undefined as T;
  return r.json();
}

export const playsApi = {
  list: (category?: string, search?: string) => {
    const params = new URLSearchParams();
    if (category && category !== "todos") params.set("category", category);
    if (search) params.set("search", search);
    const qs = params.toString();
    return fetch(`${BASE_URL}${qs ? `?${qs}` : ""}`, opts).then(r => handle<Play[]>(r));
  },
  
  get: (id: string) => fetch(`${BASE_URL}/${id}`, opts).then(r => handle<Play>(r)),
  
  create: (data: Partial<Play>) => fetch(BASE_URL, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => handle<Play>(r)),
  
  update: (id: string, data: Partial<Play>) => fetch(`${BASE_URL}/${id}`, {
    ...opts,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => handle<Play>(r)),
  
  delete: (id: string) => fetch(`${BASE_URL}/${id}`, {
    ...opts,
    method: "DELETE"
  }).then(r => handle<void>(r)),
  
  duplicate: (id: string) => fetch(`${BASE_URL}/${id}/duplicate`, {
    ...opts,
    method: "POST"
  }).then(r => handle<Play>(r)),
  
  updateFrames: (id: string, frames: PlayFrame[]) => fetch(`${BASE_URL}/${id}/frames`, {
    ...opts,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frames })
  }).then(r => handle<Play>(r)),
};
