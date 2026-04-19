import { Router } from "express";
import { Types } from "mongoose";
import { ItineraryModel, isValidObjectId } from "../models/Itinerary.js";
import { enrichItineraries } from "../services/enrich.js";
import { optionalAuth, type AuthenticatedRequest } from "../middleware/auth.js";

export const feedRouter = Router();

feedRouter.get("/", optionalAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

    const featuredDocs = await ItineraryModel.find({ visibility: "public", isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(10);

    const recentQuery: Record<string, unknown> = { visibility: "public" };
    if (cursor && isValidObjectId(cursor))
      recentQuery._id = { $lt: new Types.ObjectId(cursor) };

    const recentDocs = await ItineraryModel.find(recentQuery).sort({ _id: -1 }).limit(limit + 1);
    const hasMore = recentDocs.length > limit;
    const recentSlice = hasMore ? recentDocs.slice(0, limit) : recentDocs;

    const [featured, recent] = await Promise.all([
      enrichItineraries(featuredDocs, req.userId ?? null),
      enrichItineraries(recentSlice, req.userId ?? null),
    ]);

    res.json({
      featured,
      recent,
      recentNextCursor: hasMore ? recentSlice[recentSlice.length - 1]!._id.toString() : null,
    });
  } catch (err) {
    next(err);
  }
});
