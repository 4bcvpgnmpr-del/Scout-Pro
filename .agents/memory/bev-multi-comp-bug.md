---
name: BEV multi-competition gamesPlayed bug
description: BEV player pages show stats per competition phase under individual Temp rows; filter by INCLUDE_PHASES set to avoid double-counting.
---

## The Rule

Accumulate only rows whose `cell(0)` is in `INCLUDE_PHASES = new Set(["LR","PO","EL","FF"])`.
Skip `GR` (Copa/Grupo Regular) and `""` (grand total row).

**Why:** BEV player stats pages (table index 2) contain one row per competition phase per season, each preceded by its own `"Temp: YY/YY. Equipo:"` header row.
Phase codes vary by league:

| Code | Meaning | Leagues |
|------|---------|---------|
| `LR` | Liga Regular | All leagues ✓ include |
| `PO` | Playoff | Primera FEB, Segunda FEB, LFE, LF Challenge ✓ include |
| `EL` | Eliminatorias (Playoff) | **LF2** ✓ include |
| `FF` | Fase Final | Some leagues ✓ include |
| `GR` | Copa / Grupo Regular | All leagues ✗ exclude |
| `""` | Grand total (sum of all phases) | All leagues ✗ exclude |

LF2 confirmed structure (25/26, jugador/981128/2325680):
```
Temp: 25/26 → LR | 26 games (Liga Regular)
Temp: 25/26 → EL |  4 games (Eliminatorias/Playoff)
             ""  | 30 games (total — excluded)
```

## How to Apply

```typescript
let inTargetYear = false;
// in loop:
if (rowText.includes("Temp:")) {
  inTargetYear = rowText.includes(label);
  continue;
}
if (!inTargetYear) continue;
if (tds.length < 20) continue;
const cell = (i) => tds.eq(i).text().trim();
if (cell(0) === "FASE") continue;                        // column header rows
const INCLUDE_PHASES = new Set(["LR", "PO", "EL", "FF"]);
if (!INCLUDE_PHASES.has(cell(0))) continue;              // skip GR, "", unknown
// accumulate stats...
```

## BEV player pages are NOT historical
Player pages (`jugador/TEAM/PLAYER`) only show the **latest season** for that team.
The `?t=year` URL parameter is silently ignored. Cannot re-scrape historical seasons.

## Re-sync after scraper fix
Use `POST /api/admin/sync/player-stats/:leagueId?year=YYYY` (dev-bypass) to re-scrape a single league.
Trigger all 6 leagues after any scraper change.
