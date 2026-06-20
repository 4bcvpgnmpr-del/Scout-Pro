---
name: ScoutPro sync integration
description: How the scoutflow-automation zip was integrated — DB tables, scrapers, jobs, admin page.
---

## Tables added (lib/db/src/schema/stats.ts)

New tables use `stat_` prefix to avoid collision with scouting `teams`/`players` tables:
- `stat_leagues` (variable: `leagues`) — source of truth for seeded leagues
- `stat_teams` (variable: `syncTeams`) — external league teams
- `stat_players` (variable: `syncPlayers`) — external league players
- `stat_seasons`, `player_stats`, `stat_standings`, `sync_log`
- Two pgEnums: `league_source`, `sync_status`

**Why:** `teamsTable` (table "teams") and `playersTable` (table "players") already exist.
Adding zip's tables with same DB names would crash the push.

## Sync job adaption

The zip's `feb.scraper.ts` uses Puppeteer (not installed, too heavy for Replit).
`sync.job.ts` instead imports `scrapearTodas` from our existing cheerio-based `feb-scraper.ts`.
`CompeticionData` has field `liga` (not `nombre`) — use `data.liga` for league name.

## Seeded leagues (run once)

8 rows in `stat_leagues`: LF Endesa (feb/4/F), LF2 (feb/9/F), LF Challenge (feb/67/F),
Primera FEB (feb/1/M), Segunda FEB (feb/2/M), Tercera FEB (feb/3/M),
EuroLeague (euroleague/E/M), EuroCup (eurocup/U/M).

## useMock flag

`artifacts/scoutpro/src/pages/admin/sync.tsx` has `const useMock = true`.
Flip to `false` once `/api/admin/sync/status` returns populated data from real syncs.
