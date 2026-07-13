---
name: BEV multi-competition gamesPlayed bug
description: BEV player pages show stats per competition phase under individual Temp rows; correct fix is to filter by cell(0)==="LR" only.
---

## The Rule

Only accumulate rows where `cell(0) === "LR"` (Liga Regular). Use a simple `inTargetYear` boolean (no exit/doneTarget logic).

**Why:** BEV player stats pages (table index 2) contain one row per competition phase per season, each preceded by its own `"Temp: YY/YY. Equipo:"` header row. Phase codes:
- `LR` = Liga Regular (main competition — ONLY this should be accumulated)
- `GR` = Copa FEB / Grupo Regular (cup or pre-season group phase)
- `PO` = Playoff (post-season)
- `""` (empty cell(0)) = totals/summary row that sums ALL phases

**Page structure confirmed (Primera FEB player 1394852/team 951078):**
```
Row: Temp: 24/25 Equipo:  → GR section
Row: GR  |  4  | ...      (Copa/Grupo Regular, 4 games)
Row: Temp: 24/25 Equipo:  → LR section
Row: LR  | 32  | ...      (Liga Regular, 32 games — CORRECT)
Row: Temp: 24/25 Equipo:  → PO section
Row: PO  |  3  | ...      (Playoff round 1)
Row: Temp: 24/25 Equipo:  → PO section
Row: PO  |  5  | ...      (Playoff final)
Row:     | 44  | ...      (Total row, cell(0)="" — sums everything)
```

Without filtering: code sums 4+32+3+5+44=88 or 4+32+3+5=44 (still wrong).
Previous `doneTarget` fix: only entered first Temp section (GR=4 games) and exited. Result: 4 games — wrong.
Correct fix: scan all Temp sections, only accumulate where cell(0)==="LR".

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
if (cell(0) === "FASE") continue;  // column header rows
if (cell(0) !== "LR" && cell(0) !== "PO") continue;  // skip GR/FF (copa) and "" (totals); include LR+PO
// accumulate stats...
```

## Re-sync after scraper fix
Use `POST /api/admin/sync/player-stats/:leagueId?year=YYYY` (dev-bypass) to re-scrape a single league.
Trigger all 6 leagues after any scraper change.
