---
name: Player profile localStorage
description: Architecture of the extended player profile — what's in DB vs localStorage.
---

## Rule

Player profile is split: basic fields in DB (API), extended scouting data in localStorage per player.

## DB fields (via useUpdatePlayer / useGetPlayer)
`name`, `position`, `jerseyNumber`, `age`, `height`, `weight`, `nationality`, `handedness`, `photoUrl`, `notes`, `teamId`, `teamName`, `watchlisted`

## localStorage fields (via usePlayerProfile hook, key: `sp-profile-{playerId}`)
`secondaryPosition`, `birthday`, `playStyle`, `role`, `strengths`, `weaknesses`, `potential`, `currentLevel`, `overallRating`, `technicalNotes`, `tacticalNotes`, `physicalNotes`, `offensiveTendencies`, `defensiveTendencies`, `transitionBehavior`, `decisionMaking`, `tacticalReading`, `pressurePerformance`, `scoutingNotes`, `seasonStats` (16 stat fields), `advancedStats` (PER, ORtg, DRtg, NetRtg, Usage%, Pace), `videos[]`

## Autosave
600ms debounce — `update()`, `updateStats()`, `updateAdvanced()`, `addVideo()`, `removeVideo()` all save to localStorage immediately (for add/remove) or debounced.

## Computed advanced stats
`computeAdvancedStats(seasonStats)` returns `eFG%` and `TS%` from raw shooting stats. PER/ORtg/DRtg/NetRtg/Usage%/Pace are manually entered.

**Why:** Avoids major DB migration for a rich set of scouting-specific fields. Works offline. Trade-off: not synced across devices/sessions.
