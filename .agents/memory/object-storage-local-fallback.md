---
name: Object Storage local fallback
description: How the API server handles photo uploads when GCS/PRIVATE_OBJECT_DIR is not configured.
---

## Rule

When `PRIVATE_OBJECT_DIR` env var is empty (GCS Object Storage not configured), `storage.ts` falls back to local disk at `process.cwd()/uploads/`.

## How it works

1. `POST /api/storage/uploads/request-url` — tries GCS presigned URL first, catches error, returns local direct-upload URL: `/api/storage/uploads/local/{uuid}` with same `/objects/uploads/{uuid}` objectPath format.
2. `PUT /api/storage/uploads/local/:uuid` — saves raw binary body to `./uploads/{uuid}`, stores content-type in `{uuid}.meta`.
3. `GET /api/storage/objects/*path` — tries GCS, catches error (PRIVATE_OBJECT_DIR or ObjectNotFoundError), then tries `./uploads/{uuid}` from local disk.

The `objectPath` stored in the DB is always `/objects/uploads/{uuid}`, so photo URLs are the same format regardless of backend.

**Why:** PRIVATE_OBJECT_DIR secret exists in Replit secrets list but process.env reads it as empty — GCS sidecar at 127.0.0.1:1106 not active in all environments. Local fallback makes uploads work in dev without Object Storage bucket.

**How to apply:** Any time a new upload endpoint is added or photos fail with 500 "PRIVATE_OBJECT_DIR not set". Check `./uploads/` dir exists (auto-created). Old GCS-stored photos will 404 until re-uploaded.
