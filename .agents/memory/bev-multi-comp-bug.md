---
name: BEV multi-competition gamesPlayed bug
description: BEV player pages show stats per competition (LF2 + Copa LF etc.) each under the same "Temp: YY/YY" label, causing double-counting if not handled.
---

## Rule
In `scrapeBEVPlayerStats`, when iterating table rows, any new "Temp:" row must EXIT the current section BEFORE evaluating whether to enter a new one.

**Why:** BEV renders one stats block per competition (e.g. LF2 Liga + Copa LF) all under the same "Temp: 25/26" label. The first fix attempt used `if (matches && !doneTarget)` — but when the Copa section started, `inTarget=true` and `!doneTarget=true` both held, so the code re-entered instead of exiting. Result: gamesPlayed tripled (e.g. 60 instead of 20).

**How to apply:**
```typescript
if (rowText.includes("Temp:")) {
  if (inTarget) {
    // Exit the section we were accumulating — never re-enter
    doneTarget = true;
    inTarget   = false;
  } else if (rowText.includes(label) && !doneTarget) {
    inTarget = true;
  }
  continue;
}
```
Priority: exit-if-inside FIRST, then check whether to enter. Never check entry condition while already inside a section.

## Re-sync after scraper fix
Use `POST /api/admin/sync/player-stats/:leagueId?year=2025` (dev-bypass, added to admin-sync.routes.ts) to re-scrape a single league without running the full 500-request historical sync. Takes ~3 minutes for LF2 (~270 players).
