---
name: Scouting sync via API not executeSql
description: How to correctly repopulate the teams/players scouting tables after a db:push wipe
---

**Rule:** Always use `POST /api/admin/sync/scouting-all` (or `/scouting-league/:league`) to populate the `teams` and `players` scouting tables. Never rely solely on raw `executeSql` inserts for this data.

**Why:** `drizzle-kit push` (run manually or accidentally between sessions) drops and recreates schema tables, wiping all inserted rows. The `executeSql` tool inserts do persist within a session but won't survive a push. The admin endpoint uses the server's Drizzle connection and can be re-triggered at any time.

**How to apply:**
- After any `pnpm --filter @workspace/db run push`, immediately trigger `POST /api/admin/sync/scouting-all?lf2Team=<externalId>` to repopulate.
- The endpoint has a dev-bypass (checks `process.env["NODE_ENV"] === "development"` at request time), so no auth needed in dev.
- `syncLeagueTeams(selectedExtId, leagueShortName)` is the core function — exported from `auth.routes.ts`, called by both the PATCH /api/auth/select-team route and the new admin endpoints.
