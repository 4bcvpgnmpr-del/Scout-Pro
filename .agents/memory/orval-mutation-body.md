---
name: Orval mutation body wrapper
description: Orval-generated mutation hooks wrap the request body in { data: payload } — mutate call must match this shape.
---

Orval (react-query client) wraps all mutation bodies as `{ data: BodyType<Schema> }`.

**Rule:** always call `mutate({ data: { ...fields } })`, never `mutate({ ...fields })`.

**Example:**
```typescript
// Hook signature (generated):
useCreateSeason<TError, TContext>(options?: {
  mutation?: UseMutationOptions<Season, TError, { data: BodyType<SeasonInput> }, TContext>
})

// Correct call:
createSeason.mutate({ data: { leagueId, name, startYear, endYear } })

// Wrong call (TS2353 error):
createSeason.mutate({ leagueId, name, startYear, endYear })
```

**Why:** Orval adds the `data` wrapper to support body serialization via the custom mutator. The TypeScript error `Object literal may only specify known properties, and 'X' does not exist in type '{ data: Schema }'` is the symptom.

**How to apply:** Any time you write a `useMutation`-based mutate call using an Orval-generated hook.
