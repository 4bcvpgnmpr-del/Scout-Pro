---
name: Player stats API returns strings
description: useGetPlayerStats numeric fields come as strings from the API; toFixed() crashes if called directly.
---

The `useGetPlayerStats` hook returns numeric fields (avgPoints, avgRebounds, avgFieldGoalPct, etc.) as **strings**, not numbers, because the OpenAPI schema uses `format: decimal` or similar and the generated Zod schema does not coerce them.

**Why:** The Drizzle schema stores these as `numeric`/`decimal` columns; PostgreSQL returns them as strings in the JSON wire format, and the codegen doesn't add `z.coerce.number()`.

**How to apply:** Any time you call `.toFixed()`, `*100`, or other arithmetic on a stat field, wrap with `Number()` first:

```ts
const fmt = (v: number | string | null | undefined, dec = 1) => {
  const n = Number(v);
  return v != null && !isNaN(n) ? n.toFixed(dec) : "—";
};
const fmtPct = (v: number | string | null | undefined) => {
  const n = Number(v);
  return v != null && !isNaN(n) ? `${(n * 100).toFixed(0)}%` : "—";
};
```

This pattern is already used in `player-detail.tsx` (`Number(stats.avgFieldGoalPct)`) and should be applied everywhere stats are displayed.
