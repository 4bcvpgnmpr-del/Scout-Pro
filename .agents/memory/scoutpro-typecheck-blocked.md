---
name: scoutpro typecheck blocked by non-composite lib reference
description: Why `pnpm --filter @workspace/scoutpro run typecheck` only ever reports TS6306 and silently skips all real file errors, plus the verification workaround.
---

`pnpm --filter @workspace/scoutpro run typecheck` references `lib/object-storage-web`, which lacks `composite: true`. In non-build mode (`tsc -p tsconfig.json --noEmit`) this raises **TS6306 ("Referenced project must have composite: true")** and that error **aborts file-level type checking entirely** — the run reports ONLY the TS6306 line and never surfaces real errors in your source.

**Why this matters:** a "clean except TS6306" run is NOT proof your code typechecks. Verified with a probe: injecting `const x: number = "s"` produced no error, only TS6306. So this typecheck command gives false confidence.

**How to apply / verify scoutpro types properly:**
- Create a throwaway `artifacts/scoutpro/tsconfig.verify.json` that copies the real tsconfig but drops the `object-storage-web` entry from `references` (scoutpro does not import object-storage-web, so removal is safe). Run `pnpm --filter @workspace/scoutpro exec tsc -p tsconfig.verify.json --noEmit`, check exit 0, then delete the temp file.
- api-server typecheck is NOT affected (no TS6306) — it surfaces real file errors normally. It has a separate pre-existing error: `src/lib/objectStorage.ts:265` `Property 'signed_url' does not exist on type 'unknown'`. Both of these are pre-existing and unrelated to feature work.
- Do not "fix" object-storage-web composite as a side effect of unrelated tasks — it pulls in root tsconfig references changes and is out of scope.
