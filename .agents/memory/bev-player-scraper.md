---
name: BEV player scraper chain
description: How to scrape individual player stats from baloncestoenvivo.feb.es — confirmed URL chain, table structure, cell format, season detection, and name format.
---

## Scraping chain (3 steps)

1. **`rankings.aspx?g=N&t=YEAR&nm=SLUG`** → contains `<a href="Equipo.aspx?i=TEAM_ID">` links → extract unique BEV team IDs
2. **`Equipo.aspx?i=TEAM_ID`** → contains `<a href="Jugador.aspx?i=TEAM_ID&c=PLAYER_ID">` links → extract unique player IDs
3. **`jugador/TEAM_ID/PLAYER_ID`** (or `Jugador.aspx?i=TEAM_ID&c=PLAYER_ID`) → player stats page

Functions in `artifacts/api-server/src/scrapers/feb-scraper.ts`:
- `scrapeBEVTeamIds(g, nm, año)` — step 1
- `scrapeBEVPlayerIds(teamBevId)` — step 2
- `scrapeBEVPlayerStats(teamBevId, playerBevId)` — step 3
- `scrapeBEVLeaguePlayers(comp)` — orchestrates all 3 steps
- `scrapeBEVAllLeaguePlayers()` — loops all BEV_COMPETICIONES

## Player page structure

- Player name: `$(".box-jugador .nombre").text()` → **"APELLIDOS, NOMBRE"** format (comma-separated, all caps)
- Team name: `$(".box-jugador .equipo a").text()`
- Photo URL: `$(".box-jugador .foto img").attr("src")` → `https://imagenes.feb.es/Foto.aspx?c=PLAYER_ID`
- **Table index 2** (3rd table, 0-indexed) = totals stats (NOT averages)
- Table index 1 = averages; Table index 0 = career history (trayectoria)

## Totals table structure

```
row 0: section headers (colspan, e.g. "Rebotes Tapones Faltas")
row 1: column headers (FASE Part MIN PT T2 T3 TC TL RO RD RT AS BR BP TF TC-MT MT FC FR VA)
row 2: "Temp: 25/26. Equipo: TEAM_NAME"  ← season label (colspan, tds.length < 5)
row 3+: data rows per phase (LR / PO / CF / Copa …)
row N: "Temp: 24/25. Equipo: …"   ← previous season label
...
```

## Season detection

```typescript
const label = `${String(bevSeasonYear()).slice(-2)}/${String(bevSeasonYear()+1).slice(-2)}`;
// 2025 → "25/26"
// Check: rowText.includes("Temp:") → season label row; set inTarget = rowText.includes(label)
```

Multiple phases (LR + PO + CF) within the same season **all carry the same label** → scraper sums them all. 58 games for a player in LF2 is correct (26 LR + 32 playoff/cup phases).

## Column indices (totals table, 0-indexed)

| idx | stat         | notes                    |
|-----|-------------|--------------------------|
| 0   | FASE        | "LR", "PO", "CF", etc.  |
| 1   | Part        | games played             |
| 2   | MIN         | "MM:SS" format           |
| 3   | PT          | points (integer)         |
| 4   | T2          | "made/att" fraction      |
| 5   | T3          | "made/att" fraction      |
| 6   | TC          | total FG (skip — use T2+T3) |
| 7   | TL          | free throws "made/att"   |
| 8   | RO          | offensive rebounds       |
| 9   | RD          | defensive rebounds       |
| 10  | RT          | total rebounds           |
| 11  | AS          | assists                  |
| 12  | BR          | steals (robos)           |
| 13  | BP          | turnovers (pérdidas)     |
| 14  | TF          | technical fouls (skip)   |
| 15  | TC-MT       | blocks against (skip)    |
| 16  | MT          | blocks made              |
| 17  | FC          | fouls committed          |
| 18  | FR          | fouls received (skip)    |
| 19  | VA          | PIR / valoración         |

## Cell format

All cells are **plain text** (NOT the `\n total \n avg` multiline format that team stats use).
- `td.text().trim()` → "316", "95/215", "670:35"
- Minute parsing: `parseInt(mm) + parseInt(ss)/60`
- Fraction parsing: `raw.split("/") → [made, att]`

## DB storage

- externalId for players: `"bev-{playerBevId}"` (e.g., `"bev-1944150"`)
- externalId for teams: `"bev-{teamBevId}"` (e.g., `"bev-980023"`) — avoids collision with www.feb.es slug externalIds
- Normalizer: `normalizeBEVPlayerStats(data)` in `artifacts/api-server/src/db/normalizer.ts`
- Sync handler: `syncHandlers.bevPlayers` → daily cron at 04:00

**Why separate externalId prefix `bev-`:**
BEV uses integer IDs (980023); www.feb.es uses string slugs ("geieg-pacisa"). Without prefix, a team "1234" could collide with a slug "1234".
