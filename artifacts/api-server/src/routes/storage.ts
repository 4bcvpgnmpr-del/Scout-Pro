import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import path from "path";
import fs from "fs";
import { promises as fsp } from "fs";
import { randomUUID } from "crypto";
import {
  RequestUploadUrlBody,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const LOCAL_UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

async function ensureUploadsDir() {
  await fsp.mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
}

/**
 * POST /storage/uploads/request-url
 *
 * Request an upload URL. Tries GCS first; falls back to local disk
 * when PRIVATE_OBJECT_DIR is not configured.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { name, size, contentType } = parsed.data;

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    return;
  } catch {
    // GCS not configured — fall back to local disk
  }

  try {
    await ensureUploadsDir();
    const uuid = randomUUID();
    const objectPath = `/objects/uploads/${uuid}`;
    await fsp.writeFile(
      path.join(LOCAL_UPLOADS_DIR, `${uuid}.meta`),
      JSON.stringify({ contentType, name }),
      "utf8"
    );
    const uploadURL = `/api/storage/uploads/local/${uuid}`;
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating local upload slot");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * PUT /storage/uploads/local/:uuid
 *
 * Direct binary upload to local disk (fallback when GCS is unavailable).
 * The client PUTs the raw file body here instead of a GCS presigned URL.
 */
router.put("/storage/uploads/local/:uuid", async (req: Request, res: Response) => {
  const { uuid } = req.params as { uuid: string };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
    res.status(400).json({ error: "Invalid UUID" });
    return;
  }
  try {
    await ensureUploadsDir();
    const dest = path.join(LOCAL_UPLOADS_DIR, uuid);
    const writeStream = fs.createWriteStream(dest);
    req.pipe(writeStream);
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    res.json({ ok: true });
  } catch (error) {
    req.log.error({ err: error }, "Error saving local upload");
    res.status(500).json({ error: "Failed to save file" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities. Tries GCS first, falls back to local disk.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  const raw = req.params.path;
  const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
  const objectPath = `/objects/${wildcardPath}`;

  // 1. Try GCS
  let gcsUnavailable = false;
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
    return;
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      gcsUnavailable = false;
    } else {
      gcsUnavailable = true;
    }
  }

  // 2. Try local disk
  const parts = wildcardPath.split("/");
  const uuid = parts[parts.length - 1];
  const localFile = path.join(LOCAL_UPLOADS_DIR, uuid);

  try {
    await fsp.access(localFile);
    const stat = await fsp.stat(localFile);

    let contentType = "application/octet-stream";
    try {
      const metaRaw = await fsp.readFile(
        path.join(LOCAL_UPLOADS_DIR, `${uuid}.meta`),
        "utf8"
      );
      contentType = (JSON.parse(metaRaw) as { contentType?: string }).contentType ?? contentType;
    } catch {}

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Cache-Control", "private, max-age=3600");
    fs.createReadStream(localFile).pipe(res);
    return;
  } catch {
    // file doesn't exist locally
  }

  if (gcsUnavailable) {
    req.log.warn({ objectPath }, "Object not found (GCS unavailable, not in local store)");
  } else {
    req.log.warn({ objectPath }, "Object not found");
  }
  res.status(404).json({ error: "Object not found" });
});

export default router;
