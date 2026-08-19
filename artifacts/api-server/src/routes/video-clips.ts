import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  videoClipsTable,
  teamMediaTable,
  playersTable,
  playsTable,
} from "@workspace/db";

const router: IRouter = Router();

const mediaParams = z.object({ mediaId: z.coerce.number().int().positive() });
const clipParams = mediaParams.extend({ clipId: z.coerce.number().int().positive() });
const clipBody = z.object({
  startTime: z.coerce.number().finite().min(0),
  endTime: z.coerce.number().finite().min(0),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().min(1).max(80).default("other"),
  playerId: z.coerce.number().int().positive().nullable().optional(),
  playId: z.string().uuid().nullable().optional(),
  reportId: z.string().uuid().nullable().optional(),
}).refine((value) => value.endTime > value.startTime, {
  message: "El final debe ser posterior al inicio",
  path: ["endTime"],
});

const clipUpdateBody = clipBody.partial();

const clipSelect = {
  id: videoClipsTable.id,
  mediaId: videoClipsTable.mediaId,
  startTime: videoClipsTable.startTime,
  endTime: videoClipsTable.endTime,
  title: videoClipsTable.title,
  description: videoClipsTable.description,
  category: videoClipsTable.category,
  playerId: videoClipsTable.playerId,
  playId: videoClipsTable.playId,
  reportId: videoClipsTable.reportId,
  createdAt: videoClipsTable.createdAt,
  playerName: playersTable.name,
  playTitle: playsTable.title,
  mediaTitle: teamMediaTable.title,
  mediaUrl: teamMediaTable.url,
};

function parseOr400<T>(result: { success: true; data: T } | { success: false; error: z.ZodError }, res: any): T | null {
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return null;
  }
  return result.data;
}

async function getClipRows(where?: ReturnType<typeof eq>) {
  return db
    .select(clipSelect)
    .from(videoClipsTable)
    .innerJoin(teamMediaTable, eq(videoClipsTable.mediaId, teamMediaTable.id))
    .leftJoin(playersTable, eq(videoClipsTable.playerId, playersTable.id))
    .leftJoin(playsTable, eq(videoClipsTable.playId, playsTable.id))
    .where(where)
    .orderBy(asc(videoClipsTable.startTime), desc(videoClipsTable.createdAt));
}

router.get("/media/:mediaId/clips", async (req, res): Promise<void> => {
  const params = parseOr400(mediaParams.safeParse(req.params), res);
  if (!params) return;
  const media = await db.query.teamMediaTable.findFirst({
    where: eq(teamMediaTable.id, params.mediaId),
  });
  if (!media) {
    res.status(404).json({ error: "Vídeo no encontrado" });
    return;
  }
  res.json(await getClipRows(eq(videoClipsTable.mediaId, params.mediaId)));
});

router.get("/video-clips", async (req, res): Promise<void> => {
  const playerId = req.query.playerId == null
    ? undefined
    : parseOr400(z.coerce.number().int().positive().safeParse(req.query.playerId), res);
  if (req.query.playerId != null && playerId == null) return;
  res.json(await getClipRows(playerId ? eq(videoClipsTable.playerId, playerId) : undefined));
});

router.post("/media/:mediaId/clips", async (req, res): Promise<void> => {
  const params = parseOr400(mediaParams.safeParse(req.params), res);
  if (!params) return;
  const body = parseOr400(clipBody.safeParse(req.body), res);
  if (!body) return;
  const media = await db.query.teamMediaTable.findFirst({
    where: eq(teamMediaTable.id, params.mediaId),
  });
  if (!media) {
    res.status(404).json({ error: "Vídeo no encontrado" });
    return;
  }
  const [clip] = await db.insert(videoClipsTable).values({
    ...body,
    mediaId: params.mediaId,
    startTime: String(body.startTime),
    endTime: String(body.endTime),
  }).returning();
  res.status(201).json((await getClipRows(eq(videoClipsTable.id, clip.id)))[0]);
});

router.patch("/media/:mediaId/clips/:clipId", async (req, res): Promise<void> => {
  const params = parseOr400(clipParams.safeParse(req.params), res);
  if (!params) return;
  const body = parseOr400(clipUpdateBody.safeParse(req.body), res);
  if (!body) return;
  const existing = await db.query.videoClipsTable.findFirst({
    where: and(eq(videoClipsTable.id, params.clipId), eq(videoClipsTable.mediaId, params.mediaId)),
  });
  if (!existing) {
    res.status(404).json({ error: "Clip no encontrado" });
    return;
  }
  const startTime = body.startTime ?? Number(existing.startTime);
  const endTime = body.endTime ?? Number(existing.endTime);
  if (endTime <= startTime) {
    res.status(400).json({ error: "El final debe ser posterior al inicio" });
    return;
  }
  const [clip] = await db.update(videoClipsTable).set({
    ...body,
    startTime: String(startTime),
    endTime: String(endTime),
  }).where(eq(videoClipsTable.id, params.clipId)).returning();
  res.json((await getClipRows(eq(videoClipsTable.id, clip.id)))[0]);
});

router.delete("/media/:mediaId/clips/:clipId", async (req, res): Promise<void> => {
  const params = parseOr400(clipParams.safeParse(req.params), res);
  if (!params) return;
  const [deleted] = await db.delete(videoClipsTable).where(and(
    eq(videoClipsTable.id, params.clipId),
    eq(videoClipsTable.mediaId, params.mediaId),
  )).returning();
  if (!deleted) {
    res.status(404).json({ error: "Clip no encontrado" });
    return;
  }
  res.sendStatus(204);
});

export default router;