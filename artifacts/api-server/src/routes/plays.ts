import { Router, type IRouter } from "express";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod/v4";
import { db, playFramesTable, playsTable, reportBlocksTable, teamsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.middleware.js";

const router: IRouter = Router();
router.use("/plays", requireAuth);

const CATEGORY_VALUES = ["ataque", "defensa", "especiales"] as const;
const ELEMENT_TYPES = ["token", "arrow", "dashedArrow", "curve", "screen", "zone", "text"] as const;

const elementSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(ELEMENT_TYPES),
  x: z.number().finite().min(0).max(100).optional(),
  y: z.number().finite().min(0).max(100).optional(),
  x2: z.number().finite().min(0).max(100).optional(),
  y2: z.number().finite().min(0).max(100).optional(),
  label: z.string().max(120).optional(),
  color: z.string().max(32).optional(),
  team: z.enum(["home", "away"]).optional(),
  points: z.array(z.object({ x: z.number().finite().min(0).max(100), y: z.number().finite().min(0).max(100) })).max(20).optional(),
}).passthrough();

const createPlayBody = z.object({
  title: z.string().trim().min(1).max(140),
  category: z.enum(CATEGORY_VALUES),
  description: z.string().trim().max(4000).nullable().optional(),
  teamId: z.number().int().positive().nullable().optional(),
  isLibrary: z.boolean().optional(),
});

const patchPlayBody = createPlayBody.partial();
const framesBody = z.object({
  frames: z.array(z.object({
    id: z.string().uuid().optional(),
    frameIndex: z.number().int().min(0).max(5),
    elements: z.array(elementSchema).max(200),
  })).min(1).max(6),
});

const playIdParams = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  category: z.enum(CATEGORY_VALUES).optional(),
  search: z.string().trim().max(140).optional(),
  libraryOnly: z.enum(["true", "false"]).optional(),
});

async function getPlay(playId: string) {
  const [play] = await db.select().from(playsTable).where(eq(playsTable.id, playId));
  if (!play) return null;
  const frames = await db
    .select()
    .from(playFramesTable)
    .where(eq(playFramesTable.playId, playId))
    .orderBy(asc(playFramesTable.frameIndex));
  return { ...play, frames };
}

async function validateTeam(teamId: number | null | undefined): Promise<string | null> {
  if (!teamId) return null;
  const [team] = await db.select({ id: teamsTable.id }).from(teamsTable).where(eq(teamsTable.id, teamId));
  return team ? null : "El equipo indicado no existe";
}

router.get("/plays", async (req, res): Promise<void> => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const conditions = [];
  if (parsed.data.category) conditions.push(eq(playsTable.category, parsed.data.category));
  if (parsed.data.libraryOnly === "true") conditions.push(eq(playsTable.isLibrary, true));
  if (parsed.data.libraryOnly === "false") conditions.push(eq(playsTable.isLibrary, false));
  if (parsed.data.search) {
    const term = `%${parsed.data.search.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(or(ilike(playsTable.title, term), ilike(playsTable.description, term))!);
  }
  const plays = await db
    .select()
    .from(playsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(playsTable.title));
  const withFrames = await Promise.all(plays.map((play) => getPlay(play.id)));
  res.json(withFrames.filter((play): play is NonNullable<typeof play> => play !== null));
});

router.post("/plays", async (req, res): Promise<void> => {
  const parsed = createPlayBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const teamError = await validateTeam(parsed.data.teamId);
  if (teamError) {
    res.status(400).json({ error: teamError });
    return;
  }
  const play = await db.transaction(async (tx) => {
    const [created] = await tx.insert(playsTable).values(parsed.data).returning();
    if (!created) throw new Error("No se pudo crear la jugada");
    await tx.insert(playFramesTable).values({ playId: created.id, frameIndex: 0, elements: [] });
    return created;
  });
  const full = await getPlay(play.id);
  res.status(201).json(full);
});

router.get("/plays/:id", async (req, res): Promise<void> => {
  const params = playIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const play = await getPlay(params.data.id);
  if (!play) {
    res.status(404).json({ error: "Jugada no encontrada" });
    return;
  }
  res.json(play);
});

router.patch("/plays/:id", async (req, res): Promise<void> => {
  const params = playIdParams.safeParse(req.params);
  const parsed = patchPlayBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const teamError = await validateTeam(parsed.data.teamId);
  if (teamError) {
    res.status(400).json({ error: teamError });
    return;
  }
  const [updated] = await db
    .update(playsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(playsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Jugada no encontrada" });
    return;
  }
  res.json(await getPlay(updated.id));
});

router.post("/plays/:id/duplicate", async (req, res): Promise<void> => {
  const params = playIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const source = await getPlay(params.data.id);
  if (!source) {
    res.status(404).json({ error: "Jugada no encontrada" });
    return;
  }
  const duplicate = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(playsTable)
      .values({
        title: `${source.title} (copia)`,
        category: source.category,
        description: source.description,
        teamId: source.teamId,
        isLibrary: source.isLibrary,
      })
      .returning();
    if (!created) throw new Error("No se pudo duplicar la jugada");
    if (source.frames.length) {
      await tx.insert(playFramesTable).values(source.frames.map((frame) => ({
        playId: created.id,
        frameIndex: frame.frameIndex,
        elements: frame.elements,
      })));
    }
    return created;
  });
  res.status(201).json(await getPlay(duplicate.id));
});

router.put("/plays/:id/frames", async (req, res): Promise<void> => {
  const params = playIdParams.safeParse(req.params);
  const parsed = framesBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const uniqueIndexes = new Set(parsed.data.frames.map((frame) => frame.frameIndex));
  if (uniqueIndexes.size !== parsed.data.frames.length) {
    res.status(400).json({ error: "Los frames no pueden repetir posición" });
    return;
  }
  const existing = await getPlay(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Jugada no encontrada" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(playFramesTable).where(eq(playFramesTable.playId, existing.id));
    await tx.insert(playFramesTable).values(
      parsed.data.frames
        .sort((a, b) => a.frameIndex - b.frameIndex)
        .map((frame, index) => ({ playId: existing.id, frameIndex: index, elements: frame.elements })),
    );
    await tx.update(playsTable).set({ updatedAt: new Date() }).where(eq(playsTable.id, existing.id));
  });
  res.json(await getPlay(existing.id));
});

router.delete("/plays/:id", async (req, res): Promise<void> => {
  const params = playIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const referencedBlocks = await db
    .select({ id: reportBlocksTable.id, content: reportBlocksTable.content })
    .from(reportBlocksTable)
    .where(eq(reportBlocksTable.blockType, "play_ref"));
  const blocksToDelete = referencedBlocks.filter((block) => block.content?.["playId"] === params.data.id);
  const [deleted] = await db.transaction(async (tx) => {
    for (const block of blocksToDelete) {
      await tx.delete(reportBlocksTable).where(eq(reportBlocksTable.id, block.id));
    }
    return tx.delete(playsTable).where(eq(playsTable.id, params.data.id)).returning();
  });
  if (!deleted) {
    res.status(404).json({ error: "Jugada no encontrada" });
    return;
  }
  res.sendStatus(204);
});

export default router;