import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, gamesTable } from "@workspace/db";
import {
  CreateGameBody,
  GetGameParams,
  UpdateGameParams,
  UpdateGameBody,
  DeleteGameParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/games", async (req, res): Promise<void> => {
  const seasonYear = req.query.season ? parseInt(req.query.season as string, 10) : null;

  let query = db.select().from(gamesTable).$dynamic();

  if (seasonYear && !Number.isNaN(seasonYear)) {
    const seasonStart = `${seasonYear}-08-01`;
    const seasonEnd   = `${seasonYear + 1}-07-31`;
    query = query.where(and(gte(gamesTable.date, seasonStart), lte(gamesTable.date, seasonEnd)));
  }

  const games = await query.orderBy(gamesTable.date);
  res.json(games);
});

router.post("/games", async (req, res): Promise<void> => {
  const parsed = CreateGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [game] = await db.insert(gamesTable).values(parsed.data).returning();
  res.status(201).json(game);
});

router.get("/games/:id", async (req, res): Promise<void> => {
  const params = GetGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.id));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  res.json(game);
});

router.patch("/games/:id", async (req, res): Promise<void> => {
  const params = UpdateGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [game] = await db.update(gamesTable).set(parsed.data).where(eq(gamesTable.id, params.data.id)).returning();
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  res.json(game);
});

router.delete("/games/:id", async (req, res): Promise<void> => {
  const params = DeleteGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [game] = await db.delete(gamesTable).where(eq(gamesTable.id, params.data.id)).returning();
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
