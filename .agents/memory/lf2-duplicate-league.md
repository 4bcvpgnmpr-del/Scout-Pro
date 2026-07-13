---
name: Duplicate stat_leagues for lf2
description: There was a duplicate lf2 row in stat_leagues with 0 teams that blocked sync
---

**Rule:** If lf2 (or another league) has no teams after a scouting sync, first check for duplicate rows in `stat_leagues`:
```sql
SELECT id, short_name, external_id, COUNT(st.id) as teams
FROM stat_leagues sl LEFT JOIN stat_teams st ON st.league_id = sl.id
WHERE sl.short_name = 'lf2' GROUP BY sl.id, sl.short_name, sl.external_id;
```

**Why:** There were two `lf2` rows — one with `external_id='9'` and 0 teams (old/wrong), one with `external_id='lf2'` and 42 teams (correct). Drizzle's `findFirst` returned the empty one, so `syncLeagueTeams` bailed out with no teams found.

**Fix:** Delete the row where `external_id` is a numeric string and `COUNT(stat_teams) = 0`:
```sql
DELETE FROM stat_leagues WHERE id = '<uuid-of-empty-row>';
```

**The real row** for lf2 has `external_id = 'lf2'` and 42 teams. Keep that one.
