---
name: Watchlist API missing field
description: All player SELECT queries must return the watchlisted column or React Query cache overwrites it.
---

All three player-related query paths (list, create response, update response) must include the `watchlisted` column in their SELECT. If any path omits it, React Query merges the cached response and silently overwrites `watchlisted` with `undefined`, making the star button appear off even for watchlisted players.

**Why:** React Query shallow-merges cache entries. A partial response (missing `watchlisted`) wins over a full one after an optimistic update, resetting the value to undefined.

**How to apply:** Whenever adding or editing a Drizzle SELECT for the players table, verify `watchlisted: players.watchlisted` is included alongside `id`, `name`, `position`, etc.
