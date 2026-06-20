---
name: Season selector architecture
description: How the global season selector is wired across ScoutFlow — context, sidebar, API filtering pattern.
---

## Structure

- `SeasonContext` (`artifacts/scoutpro/src/contexts/SeasonContext.tsx`) fetches seasons via `useListSeasons()` and exposes `selectedSeason`, `setSelectedSeason`, `seasons`.
- `SeasonProvider` wraps `Router` inside `AuthProvider` in `App.tsx`.
- `SeasonBar` (inline component in `layout.tsx`) renders a `<select>` in the sidebar below the logo.
- Selected season is persisted to `localStorage` under key `sf-season`.

## API

- `GET /api/seasons` — returns distinct seasons grouped by `startYear`/`endYear` across all stat leagues. Deduplicates with `GROUP BY startYear, endYear` + `BOOL_OR(isCurrent)`.
- `GET /api/seasons/leagues` — lists leagues for admin season creation form.
- `POST /api/admin/seasons` — creates a new season for a league, marks it `isCurrent`.
- `GET /api/games?season=2024` — games filter: date BETWEEN `2024-08-01` AND `2025-07-31` (text comparison works because ISO dates sort lexicographically).
- `GET /api/reports?season=2024` — same date range filter on `reports.date`.

## Frontend filtering pattern

Pages use a `queryFn` override to pass `?season=` without changing the OpenAPI spec for existing endpoints (avoids breaking all hook call sites):

```typescript
const { selectedSeason } = useSeason();
const seasonQs = selectedSeason ? `?season=${selectedSeason.startYear}` : "";
useListGames({
  query: {
    queryKey: [...getListGamesQueryKey(), selectedSeason?.id],
    queryFn: (): Promise<Game[]> =>
      fetch(`/api/games${seasonQs}`, { credentials: "include" }).then(r => r.json()),
  },
});
```

**Why:** Adding `?season=` to existing spec endpoints would change generated hook signatures (new first `params` arg), breaking all existing call sites across the codebase.

## Pages affected

- `dashboard.tsx`: games + reports queries use season filter.
- `games.tsx`, `reports.tsx`: same queryFn override.
- `players.tsx`: season only in queryKey (no server filtering — all players shown regardless of season).
