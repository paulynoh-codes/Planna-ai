import { Router } from "express";
import { UserModel, toPublicProfile } from "../models/User.js";
import { ItineraryModel } from "../models/Itinerary.js";
import { enrichItineraries } from "../services/enrich.js";
import { HttpError } from "../middleware/error.js";
import { optionalAuth, type AuthenticatedRequest } from "../middleware/auth.js";

export const usersRouter = Router();

usersRouter.get("/:username", optionalAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const username = req.params.username;
    if (typeof username !== "string" || !/^[a-zA-Z0-9_]+$/.test(username))
      throw new HttpError(404, "not_found", "Profile not found");

    const user = await UserModel.findOne({ username });
    if (!user) throw new HttpError(404, "not_found", "Profile not found");

    const publicDocs = await ItineraryModel.find({
      ownerId: user._id,
      visibility: "public",
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const itineraries = await enrichItineraries(publicDocs, req.userId ?? null);
    res.json({
      profile: toPublicProfile(user, publicDocs.length),
      itineraries,
    });
  } catch (err) {
    next(err);
  }
});
