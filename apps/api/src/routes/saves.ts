import { Router } from "express";
import { ItineraryModel } from "../models/Itinerary.js";
import { SaveModel } from "../models/Save.js";
import { enrichItineraries } from "../services/enrich.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

export const savesRouter = Router();

savesRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const saves = await SaveModel.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(100);
    const itineraryIds = saves.map((s) => s.itineraryId);
    const docs = await ItineraryModel.find({
      _id: { $in: itineraryIds },
      $or: [{ visibility: "public" }, { ownerId: req.userId }],
    });
    // preserve order by save recency
    const docMap = new Map(docs.map((d) => [d._id.toString(), d]));
    const ordered = itineraryIds
      .map((id) => docMap.get(id.toString()))
      .filter((d): d is NonNullable<typeof d> => Boolean(d));

    const itineraries = await enrichItineraries(ordered, req.userId!);
    res.json({ itineraries, nextCursor: null });
  } catch (err) {
    next(err);
  }
});
