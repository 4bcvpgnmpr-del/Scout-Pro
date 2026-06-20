---
name: BEV scraper conventions
description: baloncestoenvivo.feb.es — confirmed URL patterns, cell format, and what data is/isn't available
---

## What the site provides
- `baloncestoenvivo.feb.es/estadisticas.aspx?g=N&t=YYYY&nm=slug` → **TEAM-level aggregated stats only**
- **No individual player stats** available on these static pages
- Data is in static HTML (no Puppeteer/XHR needed — 60KB page, fully server-rendered ASP.NET)

## URL parameters (confirmed 2026-06)
- `g=` = competition ID (NOT round/phase)
  - `g=1 nm=primerafeb` — Primera FEB
  - `g=2 nm=segundafeb` — Segunda FEB
  - `g=3 nm=tercerafeb` — Tercera FEB
  - `g=4 nm=lfendesa` — Liga Femenina Endesa
  - `g=9 nm=lf2` — LF2
  - `g=67 nm=lfchallenge` — LF Challenge
- `t=` = **start year of the season** (2025-26 season → `t=2025`) — NOT end year
  - Formula: `month >= 7 ? currentYear : currentYear - 1`

## Table structure (confirmed)
- Selector: `$("table").first().find("tr")`
- Row 0: section header cells with colspan (Rebotes, Tapones, Faltas) — skip
- Row 1: column headers (Equipo, Part, MIN, PT, T2, T3, TC, TL, RO, RD, RT, AS, BR, BP, TF, TC-MT, MT, FC, FR, VA) — skip
- Row 2+: one row per team

## Cell format (CRITICAL)
- **Numeric cells**: `"\n  135 \n  67.5"` — value is on the FIRST NON-EMPTY LINE (not `[0]`!), average on second
  - Fix: `raw.split("\n").map(l=>l.trim()).filter(l=>l.length>0)` then take `[0]` and `[1]`
- **Fraction cells (T2/T3/TC/TL)**: `"\n  18/33 \n  54,5%"` — fraction on first non-empty line, percentage second
  - Fix: `raw.split("\n").map(l=>l.trim()).find(l=>l.length>0)` then split on "/"

**Why:** BEV wraps each value in indented spans separated by newlines; `split("\n")[0]` always returns an empty string.

## Column index map (0-indexed, data rows only)
0=Equipo, 1=Part, 2=MIN, 3=PT, 4=T2, 5=T3, 6=TC, 7=TL, 8=RO, 9=RD, 10=RT, 11=AS, 12=BR, 13=BP, 14=TF, 15=TC-MT, 16=MT, 17=FC, 18=FR, 19=VA

## Season data coverage
- In playoffs (May-June), BEV only shows the teams still competing — not all 14-17 teams
- Tercera FEB has 0 standings in www.feb.es too — `clasificacion.aspx` returns 0 rows for that competition
- externalId generation is consistent between www.feb.es and BEV scrapers (same `toLowerCase + replace(/\s+/g,"-")` formula)
