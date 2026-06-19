---
name: Database provider decision
description: Why we switched from Supabase to Replit-managed PostgreSQL for ScoutPro
---

# Database: Replit Postgres (not Supabase)

Use the Replit-managed PostgreSQL (injected via `DATABASE_URL` env — points to `helium/heliumdb`). Do NOT add a Supabase `DATABASE_URL` secret.

**Why:** Supabase free-tier projects pause after inactivity; their hostname becomes unresolvable (`ENOTFOUND`) from Replit's network sandbox. The Replit-internal Postgres is always reachable and needs no SSL config beyond `ssl: false` (already in the URL as `?sslmode=disable`).

**How to apply:** Never prompt the user to set a `DATABASE_URL` secret for this project. If the DB stops working, check that the user has NOT overridden `DATABASE_URL` in Secrets. Run `pnpm --filter @workspace/db run push` after schema changes.

**Pool config:** `lib/db/src/index.ts` — `ssl: { rejectUnauthorized: false }` is set but harmless for the local helium DB; leave it in place so the code still works if someone points it at a remote SSL-enabled Postgres.
