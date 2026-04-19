import { Router } from "express";
import { InviteModel } from "../models/Invite.js";
import { ItineraryModel } from "../models/Itinerary.js";
import { enrichItinerary } from "../services/enrich.js";
import { HttpError } from "../middleware/error.js";
import { optionalAuth, type AuthenticatedRequest } from "../middleware/auth.js";

export const invitesRouter = Router();

invitesRouter.get("/:token", optionalAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const token = req.params.token;
    if (typeof token !== "string" || token.length < 8)
      throw new HttpError(404, "not_found", "Invite not found");

    const invite = await InviteModel.findOne({ token });
    if (!invite) throw new HttpError(404, "not_found", "Invite not found");
    if (invite.revokedAt) throw new HttpError(410, "invite_revoked", "This invite has been revoked");

    const doc = await ItineraryModel.findById(invite.itineraryId);
    if (!doc) throw new HttpError(404, "not_found", "Itinerary not found");

    const itinerary = await enrichItinerary(doc, req.userId ?? null);
    res.json({ itinerary });
  } catch (err) {
    next(err);
  }
});
