import { Router, type IRouter } from "express";
import { eq, desc, asc, and, max } from "drizzle-orm";
import { requireAuth } from "../lib/auth.middleware.js";
import { z } from "zod/v4";
import {
  db,
  scoutingReportsTable,
  reportSectionsTable,
  reportBlocksTable,
  playsTable,
  teamsTable,
  gamesTable,
} from "@workspace/db";

const router: IRouter = Router();

router.use("/scouting-reports", requireAuth);

const CreateBody = z.object({
  title: z.string().min(1),
  teamId: z.number().int().nullable().optional(),
  opponentId: z.number().int().nullable().optional(),
  gameId: z.number().int().nullable().optional(),
  scoutName: z.string().nullable().optional(),
  season: z.string().nullable().optional(),
  coverConfig: z.record(z.string(), z.unknown()).optional(),
});

const UpdateBody = CreateBody.partial().extend({
  status: z.enum(["draft", "in_progress", "finalized"]).optional(),
});

const SectionPatchBody = z.object({
  title: z.string().min(1).optional(),
  position: z.number().int().optional(),
  coachNote: z.string().nullable().optional(),
  isVisible: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const SectionCreateBody = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  position: z.number().int().optional(),
  coachNote: z.string().nullable().optional(),
  isVisible: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const DEFAULT_SECTIONS: Array<{ type: string; title: string }> = [
  { type: "team_overview", title: "Visión General del Rival" },
  { type: "match_stats", title: "Estadísticas del Partido" },
  { type: "player_stats", title: "Estadísticas de Jugadoras" },
];

async function loadFullReport(id: string) {
  const [report] = await db
    .select()
    .from(scoutingReportsTable)
    .where(eq(scoutingReportsTable.id, id));
  if (!report) return null;

  const sections = await db
    .select()
    .from(reportSectionsTable)
    .where(eq(reportSectionsTable.reportId, id))
    .orderBy(asc(reportSectionsTable.position));

  const sectionsWithBlocks = await Promise.all(
    sections.map(async (s) => ({
      ...s,
      blocks: await db
        .select()
        .from(reportBlocksTable)
        .where(eq(reportBlocksTable.sectionId, s.id))
        .orderBy(asc(reportBlocksTable.position)),
    })),
  );

  const [team] = report.teamId
    ? await db.select().from(teamsTable).where(eq(teamsTable.id, report.teamId))
    : [];
  const [opponent] = report.opponentId
    ? await db.select().from(teamsTable).where(eq(teamsTable.id, report.opponentId))
    : [];
  const [game] = report.gameId
    ? await db.select().from(gamesTable).where(eq(gamesTable.id, report.gameId))
    : [];

  return { ...report, sections: sectionsWithBlocks, team: team ?? null, opponent: opponent ?? null, game: game ?? null };
}

// ─── List ────────────────────────────────────────────────────────────────────
router.get("/scouting-reports", async (req, res): Promise<void> => {
  const reports = await db
    .select()
    .from(scoutingReportsTable)
    .orderBy(desc(scoutingReportsTable.updatedAt));

  const teams = await db.select().from(teamsTable);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const season = typeof req.query["season"] === "string" ? req.query["season"] : null;
  const filtered = season ? reports.filter((r) => !r.season || r.season === season) : reports;

  res.json(
    filtered.map((r) => ({
      ...r,
      teamName: r.teamId ? (teamById.get(r.teamId)?.name ?? null) : null,
      opponentName: r.opponentId ? (teamById.get(r.opponentId)?.name ?? null) : null,
      opponentLogoUrl: r.opponentId ? (teamById.get(r.opponentId)?.logoUrl ?? null) : null,
    })),
  );
});

// ─── Create (with auto-sections) ─────────────────────────────────────────────
router.post("/scouting-reports", async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [report] = await db.insert(scoutingReportsTable).values(parsed.data).returning();
  if (!report) {
    res.status(500).json({ error: "Failed to create report" });
    return;
  }

  await db.insert(reportSectionsTable).values(
    DEFAULT_SECTIONS.map((s, i) => ({
      reportId: report.id,
      type: s.type,
      title: s.title,
      position: i,
    })),
  );

  const full = await loadFullReport(report.id);
  res.status(201).json(full);
});

// ─── Get one (full) ──────────────────────────────────────────────────────────
router.get("/scouting-reports/:id", async (req, res): Promise<void> => {
  const full = await loadFullReport(req.params["id"] as string);
  if (!full) {
    res.status(404).json({ error: "Scouting report not found" });
    return;
  }
  res.json(full);
});

// ─── Update report meta ──────────────────────────────────────────────────────
router.patch("/scouting-reports/:id", async (req, res): Promise<void> => {
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(scoutingReportsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(scoutingReportsTable.id, req.params["id"] as string))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Scouting report not found" });
    return;
  }
  res.json(updated);
});

// ─── Delete ──────────────────────────────────────────────────────────────────
router.delete("/scouting-reports/:id", async (req, res): Promise<void> => {
  const [deleted] = await db
    .delete(scoutingReportsTable)
    .where(eq(scoutingReportsTable.id, req.params["id"] as string))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Scouting report not found" });
    return;
  }
  res.sendStatus(204);
});

// ─── Sections ────────────────────────────────────────────────────────────────
router.post("/scouting-reports/:id/sections", async (req, res): Promise<void> => {
  const parsed = SectionCreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const reportId = req.params["id"] as string;
  const [report] = await db.select().from(scoutingReportsTable).where(eq(scoutingReportsTable.id, reportId));
  if (!report) {
    res.status(404).json({ error: "Scouting report not found" });
    return;
  }
  const [{ maxPos }] = await db
    .select({ maxPos: max(reportSectionsTable.position) })
    .from(reportSectionsTable)
    .where(eq(reportSectionsTable.reportId, reportId));
  const position = parsed.data.position ?? (maxPos ?? -1) + 1;
  const [section] = await db
    .insert(reportSectionsTable)
    .values({ ...parsed.data, reportId, position })
    .returning();
  await db
    .update(scoutingReportsTable)
    .set({ updatedAt: new Date() })
    .where(eq(scoutingReportsTable.id, reportId));
  res.status(201).json(section);
});

router.patch("/scouting-reports/:id/sections/:sectionId", async (req, res): Promise<void> => {
  const parsed = SectionPatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(reportSectionsTable)
    .set(parsed.data)
    .where(
      and(
        eq(reportSectionsTable.id, req.params["sectionId"] as string),
        eq(reportSectionsTable.reportId, req.params["id"] as string),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Section not found" });
    return;
  }
  await db
    .update(scoutingReportsTable)
    .set({ updatedAt: new Date() })
    .where(eq(scoutingReportsTable.id, req.params["id"] as string));
  res.json(updated);
});

router.delete("/scouting-reports/:id/sections/:sectionId", async (req, res): Promise<void> => {
  const [deleted] = await db
    .delete(reportSectionsTable)
    .where(
      and(
        eq(reportSectionsTable.id, req.params["sectionId"] as string),
        eq(reportSectionsTable.reportId, req.params["id"] as string),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Section not found" });
    return;
  }
  res.sendStatus(204);
});

// ─── Reorder sections (atomic, report-scoped) ────────────────────────────────
router.post("/scouting-reports/:id/sections/reorder", async (req, res): Promise<void> => {
  const parsed = z.object({ sectionIds: z.array(z.string().uuid()).min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const reportId = req.params["id"] as string;
  const sections = await db
    .select({ id: reportSectionsTable.id })
    .from(reportSectionsTable)
    .where(eq(reportSectionsTable.reportId, reportId));
  const valid = new Set(sections.map((s) => s.id));
  const ids = parsed.data.sectionIds;
  const unique = new Set(ids);
  if (unique.size !== ids.length || ids.length !== valid.size || !ids.every((sid) => valid.has(sid))) {
    res.status(400).json({ error: "sectionIds must be exactly the sections of this report, without duplicates" });
    return;
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(reportSectionsTable)
        .set({ position: i })
        .where(and(eq(reportSectionsTable.id, ids[i]!), eq(reportSectionsTable.reportId, reportId)));
    }
    await tx.update(scoutingReportsTable).set({ updatedAt: new Date() }).where(eq(scoutingReportsTable.id, reportId));
  });
  const full = await loadFullReport(reportId);
  res.json(full);
});

// ─── Blocks ──────────────────────────────────────────────────────────────────
const BlockCreateBody = z.object({
  blockType: z.string().min(1),
  position: z.number().int().optional(),
  content: z.record(z.string(), z.unknown()).optional(),
});

const BlockPatchBody = z.object({
  position: z.number().int().optional(),
  content: z.record(z.string(), z.unknown()).optional(),
});

async function validatePlayReference(
  blockType: string,
  content: Record<string, unknown> | undefined,
): Promise<string | null> {
  if (blockType !== "play_ref") return null;
  const parsed = z.object({ playId: z.string().uuid() }).safeParse(content);
  if (!parsed.success) return "El bloque de jugada necesita un playId válido";
  const [play] = await db.select({ id: playsTable.id }).from(playsTable).where(eq(playsTable.id, parsed.data.playId));
  return play ? null : "La jugada seleccionada no existe";
}

async function findScopedSection(reportId: string, sectionId: string) {
  const [section] = await db
    .select()
    .from(reportSectionsTable)
    .where(and(eq(reportSectionsTable.id, sectionId), eq(reportSectionsTable.reportId, reportId)));
  return section ?? null;
}

router.post("/scouting-reports/:id/sections/:sectionId/blocks", async (req, res): Promise<void> => {
  const parsed = BlockCreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const reportId = req.params["id"] as string;
  const sectionId = req.params["sectionId"] as string;
  const section = await findScopedSection(reportId, sectionId);
  if (!section) {
    res.status(404).json({ error: "Section not found" });
    return;
  }
  const playReferenceError = await validatePlayReference(parsed.data.blockType, parsed.data.content);
  if (playReferenceError) {
    res.status(400).json({ error: playReferenceError });
    return;
  }
  const [{ maxPos }] = await db
    .select({ maxPos: max(reportBlocksTable.position) })
    .from(reportBlocksTable)
    .where(eq(reportBlocksTable.sectionId, sectionId));
  const [block] = await db
    .insert(reportBlocksTable)
    .values({
      sectionId,
      blockType: parsed.data.blockType,
      position: parsed.data.position ?? (maxPos ?? -1) + 1,
      content: parsed.data.content ?? {},
    })
    .returning();
  await db.update(scoutingReportsTable).set({ updatedAt: new Date() }).where(eq(scoutingReportsTable.id, reportId));
  res.status(201).json(block);
});

router.patch("/scouting-reports/:id/sections/:sectionId/blocks/:blockId", async (req, res): Promise<void> => {
  const parsed = BlockPatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const reportId = req.params["id"] as string;
  const sectionId = req.params["sectionId"] as string;
  const section = await findScopedSection(reportId, sectionId);
  if (!section) {
    res.status(404).json({ error: "Section not found" });
    return;
  }
  const [existingBlock] = await db
    .select()
    .from(reportBlocksTable)
    .where(
      and(
        eq(reportBlocksTable.id, req.params["blockId"] as string),
        eq(reportBlocksTable.sectionId, sectionId),
      ),
    );
  if (!existingBlock) {
    res.status(404).json({ error: "Block not found" });
    return;
  }
  const playReferenceError = await validatePlayReference(existingBlock.blockType, parsed.data.content);
  if (playReferenceError) {
    res.status(400).json({ error: playReferenceError });
    return;
  }
  const [updated] = await db
    .update(reportBlocksTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(reportBlocksTable.id, req.params["blockId"] as string),
        eq(reportBlocksTable.sectionId, sectionId),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Block not found" });
    return;
  }
  await db.update(scoutingReportsTable).set({ updatedAt: new Date() }).where(eq(scoutingReportsTable.id, reportId));
  res.json(updated);
});

router.delete("/scouting-reports/:id/sections/:sectionId/blocks/:blockId", async (req, res): Promise<void> => {
  const reportId = req.params["id"] as string;
  const sectionId = req.params["sectionId"] as string;
  const section = await findScopedSection(reportId, sectionId);
  if (!section) {
    res.status(404).json({ error: "Section not found" });
    return;
  }
  const [deleted] = await db
    .delete(reportBlocksTable)
    .where(
      and(
        eq(reportBlocksTable.id, req.params["blockId"] as string),
        eq(reportBlocksTable.sectionId, sectionId),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Block not found" });
    return;
  }
  await db.update(scoutingReportsTable).set({ updatedAt: new Date() }).where(eq(scoutingReportsTable.id, reportId));
  res.sendStatus(204);
});

// ─── Statistical data panels ─────────────────────────────────────────────────
import {
  getTeamOverview,
  getTeamPlayerStats,
  getTeamGameTrends,
  getTeamVsLeague,
  generateInsights,
} from "../lib/scouting-stats.js";

async function loadReportOr404(req: { params: Record<string, string | undefined> }, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  const [report] = await db
    .select()
    .from(scoutingReportsTable)
    .where(eq(scoutingReportsTable.id, req.params["id"] as string));
  if (!report) {
    res.status(404).json({ error: "Scouting report not found" });
    return null;
  }
  return report;
}

/**
 * Resolves the team the stats panels refer to. An optional ?teamId override is
 * only honored when it matches one of the report's own teams (own team or
 * opponent) — it must never become an arbitrary-team stats endpoint.
 */
function resolvePanelTeamId(
  report: { teamId: number | null; opponentId: number | null },
  raw: unknown,
): { teamId: number | null; error?: string } {
  if (raw == null || raw === "") return { teamId: report.opponentId };
  const parsed = parseInt(String(raw), 10);
  if (!Number.isInteger(parsed)) return { teamId: null, error: "teamId inválido" };
  if (parsed !== report.opponentId && parsed !== report.teamId) {
    return { teamId: null, error: "teamId no pertenece a este informe" };
  }
  return { teamId: parsed };
}

router.get("/scouting-reports/:id/team-overview", async (req, res): Promise<void> => {
  const report = await loadReportOr404(req, res);
  if (!report) return;
  const resolvedTeam = resolvePanelTeamId(report, req.query["teamId"]);
  if (resolvedTeam.error) {
    res.status(400).json({ error: resolvedTeam.error });
    return;
  }
  const teamId = resolvedTeam.teamId;
  if (!teamId) {
    res.status(400).json({ error: "El informe no tiene equipo rival asignado" });
    return;
  }
  const overview = await getTeamOverview(teamId);
  if (!overview) {
    res.status(404).json({ error: "Equipo no encontrado" });
    return;
  }
  res.json(overview);
});

router.get("/scouting-reports/:id/match-stats", async (req, res): Promise<void> => {
  const report = await loadReportOr404(req, res);
  if (!report) return;
  if (!report.gameId) {
    res.json({ game: null, teamA: null, teamB: null });
    return;
  }
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, report.gameId));
  if (!game) {
    res.json({ game: null, teamA: null, teamB: null });
    return;
  }
  // Team season profiles for each side when they exist as scouting teams
  const allTeams = await db.select().from(teamsTable);
  const homeTeam = allTeams.find((t) => t.name.toLowerCase() === game.homeTeam.toLowerCase());
  const awayTeam = allTeams.find((t) => t.name.toLowerCase() === game.awayTeam.toLowerCase());
  const [teamA, teamB] = await Promise.all([
    homeTeam ? getTeamOverview(homeTeam.id) : Promise.resolve(null),
    awayTeam ? getTeamOverview(awayTeam.id) : Promise.resolve(null),
  ]);
  res.json({ game, teamA, teamB });
});

router.get("/scouting-reports/:id/player-stats", async (req, res): Promise<void> => {
  const report = await loadReportOr404(req, res);
  if (!report) return;
  const resolvedTeam = resolvePanelTeamId(report, req.query["teamId"]);
  if (resolvedTeam.error) {
    res.status(400).json({ error: resolvedTeam.error });
    return;
  }
  const teamId = resolvedTeam.teamId;
  if (!teamId) {
    res.status(400).json({ error: "El informe no tiene equipo rival asignado" });
    return;
  }
  const range = String(req.query["range"] ?? "season");
  const data = await getTeamPlayerStats(teamId);
  // Per-game splits are not available in the data source; season aggregates are
  // served for every range with an explicit flag so the UI can inform the user.
  res.json({ ...data, range, rangeApplied: "season" });
});

router.get("/scouting-reports/:id/trends", async (req, res): Promise<void> => {
  const report = await loadReportOr404(req, res);
  if (!report) return;
  const resolvedTeam = resolvePanelTeamId(report, req.query["teamId"]);
  if (resolvedTeam.error) {
    res.status(400).json({ error: resolvedTeam.error });
    return;
  }
  const teamId = resolvedTeam.teamId;
  if (!teamId) {
    res.status(400).json({ error: "El informe no tiene equipo rival asignado" });
    return;
  }
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) {
    res.status(404).json({ error: "Equipo no encontrado" });
    return;
  }
  const rawRange = String(req.query["range"] ?? "last10");
  const range = rawRange === "last5" || rawRange === "season" ? rawRange : "last10";
  const games = await getTeamGameTrends(team.name, range);
  res.json({ teamName: team.name, range, games });
});

router.get("/scouting-reports/:id/team-vs-league", async (req, res): Promise<void> => {
  const report = await loadReportOr404(req, res);
  if (!report) return;
  const resolvedTeam = resolvePanelTeamId(report, req.query["teamId"]);
  if (resolvedTeam.error) {
    res.status(400).json({ error: resolvedTeam.error });
    return;
  }
  const teamId = resolvedTeam.teamId;
  if (!teamId) {
    res.status(400).json({ error: "El informe no tiene equipo rival asignado" });
    return;
  }
  const data = await getTeamVsLeague(teamId);
  if (!data) {
    res.status(404).json({ error: "El equipo no tiene datos de liga vinculados" });
    return;
  }
  res.json(data);
});

router.get("/scouting-reports/:id/insights", async (req, res): Promise<void> => {
  const report = await loadReportOr404(req, res);
  if (!report) return;
  const resolvedTeam = resolvePanelTeamId(report, req.query["teamId"]);
  if (resolvedTeam.error) {
    res.status(400).json({ error: resolvedTeam.error });
    return;
  }
  const teamId = resolvedTeam.teamId;
  if (!teamId) {
    res.status(400).json({ error: "El informe no tiene equipo rival asignado" });
    return;
  }
  const insights = await generateInsights(teamId);
  res.json({ insights });
});

// ─── Refresh live data (re-stamps report; live sections re-fetch on render) ──
router.post("/scouting-reports/:id/refresh-data", async (req, res): Promise<void> => {
  const [updated] = await db
    .update(scoutingReportsTable)
    .set({ updatedAt: new Date() })
    .where(eq(scoutingReportsTable.id, req.params["id"] as string))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Scouting report not found" });
    return;
  }
  const full = await loadFullReport(updated.id);
  res.json(full);
});

export default router;
