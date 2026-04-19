import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/jwt.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

function extractToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
  } catch {
    // ignore; optional
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: { code: "unauthorized", message: "Missing bearer token" } });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: { code: "unauthorized", message: "Invalid token" } });
  }
}
