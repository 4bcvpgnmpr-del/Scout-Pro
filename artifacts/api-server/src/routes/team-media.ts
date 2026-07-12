import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, teamMediaTable } from "@workspace/db";
import {
  ListTeamMediaParams,
  ListTeamMediaQueryParams,
  CreateTeamMediaParams,
  CreateTeamMediaBody,
  UpdateTeamMediaParams,
  UpdateTeamMediaBody,
  DeleteTeamMediaParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/teams/:id/media", async (req, res): Promise<void> => {
  const params = ListTeamMediaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = ListTeamMediaQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [eq(teamMediaTable.teamId, params.data.id)];
  if (query.data.category) {
    conditions.push(eq(teamMediaTable.category, query.data.category));
  }
  const media = await db
    .select()
    .from(teamMediaTable)
    .where(and(...conditions))
    .orderBy(desc(teamMediaTable.createdAt));
  res.json(media);
});

router.post("/teams/:id/media", async (req, res): Promise<void> => {
  const params = CreateTeamMediaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateTeamMediaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [media] = await db
    .insert(teamMediaTable)
    .values({ ...parsed.data, teamId: params.data.id })
    .returning();
  res.status(201).json(media);
});

router.patch("/teams/:id/media/:mediaId", async (req, res): Promise<void> => {
  const params = UpdateTeamMediaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTeamMediaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [media] = await db
    .update(teamMediaTable)
    .set(parsed.data)
    .where(and(eq(teamMediaTable.id, params.data.mediaId), eq(teamMediaTable.teamId, params.data.id)))
    .returning();
  if (!media) {
    res.status(404).json({ error: "Media not found" });
    return;
  }
  res.json(media);
});

router.delete("/teams/:id/media/:mediaId", async (req, res): Promise<void> => {
  const params = DeleteTeamMediaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [media] = await db
    .delete(teamMediaTable)
    .where(and(eq(teamMediaTable.id, params.data.mediaId), eq(teamMediaTable.teamId, params.data.id)))
    .returning();
  if (!media) {
    res.status(404).json({ error: "Media not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
