import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { AuthenticatedRequest } from "./auth.js";
import { env } from "../env.js";

const disabled = env.NODE_ENV === "test";

function keyByUserOrIp(req: AuthenticatedRequest): string {
  if (req.userId) return `u:${req.userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

function rejectHandler(code: string, message: string) {
  return (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
    res.status(429).json({ error: { code, message } });
  };
}

export const generateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  keyGenerator: keyByUserOrIp,
  handler: rejectHandler(
    "rate_limited_generate",
    "Too many itinerary generations. Try again later.",
  ),
});

export const swapRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  keyGenerator: keyByUserOrIp,
  handler: rejectHandler("rate_limited_swap", "Too many swaps. Try again later."),
});
