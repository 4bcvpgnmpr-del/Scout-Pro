import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const SALT_ROUNDS = 10;

function safeUser(u: typeof usersTable.$inferSelect) {
  return {
    id:               u.id,
    email:            u.email,
    name:             u.name,
    role:             u.role,
    subscriptionTier: u.subscriptionTier,
    selectedTeamId:   u.selectedTeamId,
  };
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────

router.post("/register", async (req, res): Promise<void> => {
  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Email y contraseña son requeridos" });
    return;
  }

  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email.toLowerCase()),
  });
  if (existing) {
    res.status(409).json({ error: "Ya existe una cuenta con ese email" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await db.insert(usersTable).values({
    email:    email.toLowerCase(),
    passwordHash,
    name:     name ?? null,
  }).returning();

  const safe = safeUser(user);
  req.session.userId = user.id;
  req.session.user   = safe;

  res.status(201).json(safe);
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────

router.post("/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Email y contraseña son requeridos" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email.toLowerCase()),
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Email o contraseña incorrectos" });
    return;
  }

  const safe = safeUser(user);
  req.session.userId = user.id;
  req.session.user   = safe;

  res.json(safe);
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

router.post("/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

router.get("/me", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.session.userId),
  });

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  res.json(safeUser(user));
});

// ─── PATCH /api/auth/select-team ─────────────────────────────────────────────

router.patch("/select-team", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const { teamId } = req.body as { teamId?: string | null };

  await db.update(usersTable)
    .set({ selectedTeamId: teamId ?? null })
    .where(eq(usersTable.id, req.session.userId));

  if (req.session.user) {
    req.session.user.selectedTeamId = teamId ?? null;
  }

  res.json({ ok: true, selectedTeamId: teamId ?? null });
});

export default router;
