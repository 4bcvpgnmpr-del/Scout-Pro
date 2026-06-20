import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  next();
}

export function requirePro(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  if (req.session.user?.subscriptionTier !== "professional") {
    res.status(403).json({ error: "Esta función requiere el plan Profesional" });
    return;
  }
  next();
}
