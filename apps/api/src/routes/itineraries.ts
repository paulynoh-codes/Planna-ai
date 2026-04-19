import { Router } from "express";
import { Types } from "mongoose";
import {
  generateItinerarySchema,
  updateItinerarySchema,
  ANON_SESSION_HEADER,
} from "@planna/shared";
import { ItineraryModel, toPublicItinerary, isValidObjectId } from "../models/Itinerary.js";
import { getAiClient } from "../services/ai.js";
import { HttpError } from "../middleware/error.js";
import { optionalAuth, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { logger } from "../logger.js";

export const itinerariesRouter = Router();

itinerariesRouter.post("/generate", optionalAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = generateItinerarySchema.parse(req.body);
    const anonSession = req.header(ANON_SESSION_HEADER);
    if (!req.userId && !anonSession) {
      throw new HttpError(
        400,
        "missing_session",
        "Anonymous session id required when not authenticated",
      );
    }

    const ai = getAiClient();
    let generated;
    try {
      generated = await ai.generateItinerary(input);
    } catch (err) {
      logger.error({ err }, "itinerary generation failed");
      throw new HttpError(502, "ai_unavailable", "Could not generate itinerary. Try again shortly.");
    }

    const doc = await ItineraryModel.create({
      ownerId: req.userId ? new Types.ObjectId(req.userId) : null,
      anonymousSessionId: req.userId ? null : anonSession,
      title: generated.title,
      summary: generated.summary,
      destination: input.destination,
      durationDays: input.durationDays,
      budgetTier: input.budgetTier,
      tripType: input.tripType,
      vibeTags: input.vibeTags,
      visibility: "private",
      days: generated.days,
    });

    res.status(201).json({ itinerary: toPublicItinerary(doc) });
  } catch (err) {
    next(err);
  }
});

itinerariesRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const docs = await ItineraryModel.find({ ownerId: req.userId }).sort({ updatedAt: -1 }).limit(100);
    res.json({ itineraries: docs.map(toPublicItinerary) });
  } catch (err) {
    next(err);
  }
});

itinerariesRouter.get("/:id", optionalAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== "string" || !isValidObjectId(id)) throw new HttpError(404, "not_found", "Itinerary not found");
    const doc = await ItineraryModel.findById(id);
    if (!doc) throw new HttpError(404, "not_found", "Itinerary not found");

    const isOwner = req.userId && doc.ownerId && doc.ownerId.toString() === req.userId;
    if (!isOwner && doc.visibility !== "public") {
      throw new HttpError(404, "not_found", "Itinerary not found");
    }
    res.json({ itinerary: toPublicItinerary(doc) });
  } catch (err) {
    next(err);
  }
});

itinerariesRouter.patch("/:id", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== "string" || !isValidObjectId(id)) throw new HttpError(404, "not_found", "Itinerary not found");
    const input = updateItinerarySchema.parse(req.body);
    const doc = await ItineraryModel.findById(id);
    if (!doc) throw new HttpError(404, "not_found", "Itinerary not found");
    if (!doc.ownerId || doc.ownerId.toString() !== req.userId) {
      throw new HttpError(403, "forbidden", "Not your itinerary");
    }

    if (input.title !== undefined) doc.title = input.title;
    if (input.summary !== undefined) doc.summary = input.summary;
    if (input.visibility !== undefined) doc.visibility = input.visibility;
    if (input.coverImageUrl !== undefined) doc.coverImageUrl = input.coverImageUrl;
    if (input.days !== undefined) {
      doc.set(
        "days",
        input.days.map((d) => ({
          dayNumber: d.dayNumber,
          title: d.title,
          items: d.items.map((it) => ({
            itemId: it.itemId,
            category: it.category,
            name: it.name,
            area: it.area,
            description: it.description,
            timeSlot: it.timeSlot,
            notes: it.notes ?? "",
            sourceType: it.sourceType,
          })),
        })),
      );
    }
    await doc.save();
    res.json({ itinerary: toPublicItinerary(doc) });
  } catch (err) {
    next(err);
  }
});

itinerariesRouter.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== "string" || !isValidObjectId(id)) throw new HttpError(404, "not_found", "Itinerary not found");
    const doc = await ItineraryModel.findById(id);
    if (!doc) throw new HttpError(404, "not_found", "Itinerary not found");
    if (!doc.ownerId || doc.ownerId.toString() !== req.userId) {
      throw new HttpError(403, "forbidden", "Not your itinerary");
    }
    await doc.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
