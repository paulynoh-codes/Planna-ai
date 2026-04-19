import type { Request } from "express";
import { HttpError } from "./error.js";

export function getParam(req: Request, name: string, notFoundMessage = "Not found"): string {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(404, "not_found", notFoundMessage);
  }
  return value;
}
