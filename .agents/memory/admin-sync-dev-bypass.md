---
name: Admin sync dev-bypass pattern
description: How to correctly add a dev-only auth bypass to Express route handlers compiled by esbuild
---

**Rule:** Put the `NODE_ENV` check INSIDE the async handler body, never as a middleware-level conditional.

**Working pattern:**
```typescript
router.post("/my-endpoint", async (req, res): Promise<void> => {
  const isDev = String(process.env["NODE_ENV"]) === "development";
  if (!isDev && !req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  // ... handler logic
});
```

**Why:** A middleware-level ternary like `router.post("/x", isDev ? passthrough : requireAuth, handler)` is evaluated at MODULE LOAD TIME when the router is set up. If for any reason the ternary doesn't evaluate correctly at that point, the wrong middleware is registered permanently. In contrast, checking `process.env["NODE_ENV"]` inside the handler is evaluated at REQUEST TIME, which is always correct. esbuild does NOT replace `process.env["NODE_ENV"]` at build time (no `define` option is set in build.mjs), so runtime reads work as expected.
