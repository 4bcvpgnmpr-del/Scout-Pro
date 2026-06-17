---
name: TEAM_SECTIONS HMR compatibility
description: Why TEAM_SECTIONS must not be defined or exported from a React component file
---

Vite Fast Refresh (HMR) requires that files with React components only export components.
Exporting a non-component array like TEAM_SECTIONS (even if it contains React element types like LucideIcon) from a `.tsx` file that also exports components causes the warning:

  "Could not Fast Refresh — export is incompatible"

This triggers a full page reload on every file save, which resets React state and prevents users from seeing code changes without a manual Ctrl+Shift+R.

**Fix:** Move the constant + type to a pure TS module (`src/lib/team-sections.ts`).
Both consumer files (`scout.tsx`, `team-scouting.tsx`, etc.) import from there directly.

**How to apply:** Whenever a `.tsx` component file needs to export a shared constant that contains icon/React types, extract it to `src/lib/<name>.ts`.
