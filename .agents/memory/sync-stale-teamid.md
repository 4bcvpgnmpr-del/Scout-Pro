---
name: syncLeagueTeams stale teamId dedup
description: How to correctly find existing players when their teamId references deleted teams (e.g. after drizzle-kit push wipes the teams table).
---

## The rule

`syncLeagueTeams` must look up existing players by `statPlayerExternalId` (not `teamId`) before deciding whether to INSERT or UPDATE.

**Why:** After `drizzle-kit push` wipes the `teams` table and it gets repopulated, the new team rows get new serial IDs. Old `players.team_id` values point to those deleted IDs. The previous lookup `WHERE teamId IN (newTeamIds)` found nothing → inserted duplicates instead of updating.

**How to apply:**

1. Phase 1 — collect all statPlayerExternalIds for the league's latest season (loop over stat teams).
2. Phase 2 — bulk SELECT from `players` WHERE `statPlayerExternalId IN (...)` — this finds the right rows regardless of their current `teamId`.
3. Phase 3 — delete duplicate rows: if multiple `players` rows share the same `statPlayerExternalId`, keep the lowest `id`, delete the rest.
4. Phase 4 — upsert: UPDATE if found in map, INSERT otherwise.

The `inArray(playersTable.statPlayerExternalId, allStatExtIds)` query is the key — it bypasses any stale `team_id` entirely.
