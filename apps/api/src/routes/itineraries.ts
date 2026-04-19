import { Router } from "express";
import { Types } from "mongoose";
import { randomBytes } from "node:crypto";
import {
  generateItinerarySchema,
  updateItinerarySchema,
  addCommentSchema,
  createInviteSchema,
  swapSuggestionsSchema,
  ANON_SESSION_HEADER,
  INVITE_TOKEN_HEADER,
} from "@planna/shared";
import type { Itinerary, ItineraryItem } from "@planna/shared";
import { ItineraryModel, isValidObjectId, toPublicItinerary } from "../models/Itinerary.js";
import { LikeModel } from "../models/Like.js";
import { SaveModel } from "../models/Save.js";
import { CommentModel, toPublicComment } from "../models/Comment.js";
import { InviteModel, toPublicInvite } from "../models/Invite.js";
import { UserModel } from "../models/User.js";
import { getAiClient } from "../services/ai.js";
import { enrichItineraries, enrichItinerary } from "../services/enrich.js";
import { HttpError } from "../middleware/error.js";
import { optionalAuth, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { generateRateLimiter, swapRateLimiter } from "../middleware/rateLimit.js";
import { getParam } from "../middleware/params.js";
import { logger } from "../logger.js";

export const itinerariesRouter = Router();

itinerariesRouter.post("/generate", optionalAuth, generateRateLimiter, async (req: AuthenticatedRequest, res, next) => {
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
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
    const query: Record<string, unknown> = { ownerId: req.userId };
    if (cursor && isValidObjectId(cursor)) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }
    const docs = await ItineraryModel.find(query).sort({ _id: -1 }).limit(limit + 1);
    const hasMore = docs.length > limit;
    const slice = hasMore ? docs.slice(0, limit) : docs;
    const itineraries = await enrichItineraries(slice, req.userId!);
    res.json({
      itineraries,
      nextCursor: hasMore ? slice[slice.length - 1]!._id.toString() : null,
    });
  } catch (err) {
    next(err);
  }
});

itinerariesRouter.get("/:id", optionalAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = getParam(req, "id", "Itinerary not found");
    const doc = await loadAccessible(id, req.userId ?? null, readInviteToken(req));
    const itinerary = await enrichItinerary(doc, req.userId ?? null);
    res.json({ itinerary });
  } catch (err) {
    next(err);
  }
});

itinerariesRouter.patch("/:id", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = getParam(req, "id", "Itinerary not found");
    if (!isValidObjectId(id)) throw new HttpError(404, "not_found", "Itinerary not found");
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
    const itinerary = await enrichItinerary(doc, req.userId!);
    res.json({ itinerary });
  } catch (err) {
    next(err);
  }
});

itinerariesRouter.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = getParam(req, "id", "Itinerary not found");
    if (!isValidObjectId(id)) throw new HttpError(404, "not_found", "Itinerary not found");
    const doc = await ItineraryModel.findById(id);
    if (!doc) throw new HttpError(404, "not_found", "Itinerary not found");
    if (!doc.ownerId || doc.ownerId.toString() !== req.userId) {
      throw new HttpError(403, "forbidden", "Not your itinerary");
    }
    await Promise.all([
      LikeModel.deleteMany({ itineraryId: doc._id }),
      SaveModel.deleteMany({ itineraryId: doc._id }),
      CommentModel.deleteMany({ itineraryId: doc._id }),
      InviteModel.deleteMany({ itineraryId: doc._id }),
    ]);
    await doc.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

function readInviteToken(req: AuthenticatedRequest): string | null {
  const fromHeader = req.header(INVITE_TOKEN_HEADER);
  if (fromHeader) return fromHeader;
  const q = req.query.invite;
  return typeof q === "string" && q.length > 0 ? q : null;
}

async function loadAccessible(
  id: string,
  viewerId: string | null | undefined,
  inviteToken: string | null,
) {
  if (!isValidObjectId(id)) throw new HttpError(404, "not_found", "Itinerary not found");
  const doc = await ItineraryModel.findById(id);
  if (!doc) throw new HttpError(404, "not_found", "Itinerary not found");

  const isOwner = !!viewerId && !!doc.ownerId && doc.ownerId.toString() === viewerId;
  if (isOwner) return doc;
  if (doc.visibility === "public") return doc;

  if (inviteToken) {
    const invite = await InviteModel.findOne({ token: inviteToken, revokedAt: null });
    if (invite && invite.itineraryId.toString() === doc._id.toString()) return doc;
  }
  throw new HttpError(404, "not_found", "Itinerary not found");
}

itinerariesRouter.post("/:id/like", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = getParam(req, "id", "Itinerary not found");
    const doc = await loadAccessible(id, req.userId, null);

    const existing = await LikeModel.findOne({ itineraryId: doc._id, userId: req.userId });
    let active: boolean;
    if (existing) {
      const result = await LikeModel.deleteOne({ itineraryId: doc._id, userId: req.userId });
      if (result.deletedCount > 0) {
        await ItineraryModel.updateOne({ _id: doc._id }, { $inc: { likeCount: -1 } });
      }
      active = false;
    } else {
      try {
        await LikeModel.create({ itineraryId: doc._id, userId: req.userId });
        await ItineraryModel.updateOne({ _id: doc._id }, { $inc: { likeCount: 1 } });
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
      }
      active = true;
    }
    const fresh = await ItineraryModel.findById(doc._id).select("likeCount");
    res.json({ active, count: Math.max(0, fresh?.likeCount ?? 0) });
  } catch (err) {
    next(err);
  }
});

itinerariesRouter.post("/:id/save", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = getParam(req, "id", "Itinerary not found");
    const doc = await loadAccessible(id, req.userId, null);

    const existing = await SaveModel.findOne({ itineraryId: doc._id, userId: req.userId });
    let active: boolean;
    if (existing) {
      const result = await SaveModel.deleteOne({ itineraryId: doc._id, userId: req.userId });
      if (result.deletedCount > 0) {
        await ItineraryModel.updateOne({ _id: doc._id }, { $inc: { saveCount: -1 } });
      }
      active = false;
    } else {
      try {
        await SaveModel.create({ itineraryId: doc._id, userId: req.userId });
        await ItineraryModel.updateOne({ _id: doc._id }, { $inc: { saveCount: 1 } });
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
      }
      active = true;
    }
    const fresh = await ItineraryModel.findById(doc._id).select("saveCount");
    res.json({ active, count: Math.max(0, fresh?.saveCount ?? 0) });
  } catch (err) {
    next(err);
  }
});

itinerariesRouter.get("/:id/comments", optionalAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = getParam(req, "id", "Itinerary not found");
    const doc = await loadAccessible(id, req.userId ?? null, readInviteToken(req));

    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
    const query: Record<string, unknown> = { itineraryId: doc._id };
    if (cursor && isValidObjectId(cursor)) query._id = { $lt: new Types.ObjectId(cursor) };

    const comments = await CommentModel.find(query).sort({ _id: -1 }).limit(limit + 1);
    const hasMore = comments.length > limit;
    const slice = hasMore ? comments.slice(0, limit) : comments;

    const authorIds = Array.from(new Set(slice.map((c) => c.userId.toString())));
    const authors = await UserModel.find({ _id: { $in: authorIds } }).select("username displayName");
    const authorMap = new Map(
      authors.map((a) => [a._id.toString(), { username: a.username, displayName: a.displayName }]),
    );

    res.json({
      comments: slice.map((c) => {
        const author = authorMap.get(c.userId.toString());
        return toPublicComment(c, {
          id: c.userId.toString(),
          username: author?.username ?? "unknown",
          displayName: author?.displayName ?? "Unknown",
        });
      }),
      nextCursor: hasMore ? slice[slice.length - 1]!._id.toString() : null,
    });
  } catch (err) {
    next(err);
  }
});

itinerariesRouter.post(
  "/:id/comments",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = getParam(req, "id", "Itinerary not found");
      const doc = await loadAccessible(id, req.userId, readInviteToken(req));
      const input = addCommentSchema.parse(req.body);

      const comment = await CommentModel.create({
        itineraryId: doc._id,
        userId: req.userId,
        text: input.text,
      });
      await ItineraryModel.updateOne({ _id: doc._id }, { $inc: { commentCount: 1 } });

      const author = await UserModel.findById(req.userId).select("username displayName");
      if (!author) throw new HttpError(404, "not_found", "User not found");

      res.status(201).json({
        comment: toPublicComment(comment, {
          id: author._id.toString(),
          username: author.username,
          displayName: author.displayName,
        }),
      });
    } catch (err) {
      next(err);
    }
  },
);

itinerariesRouter.delete(
  "/comments/:commentId",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const commentId = getParam(req, "commentId", "Comment not found");
      if (!isValidObjectId(commentId)) throw new HttpError(404, "not_found", "Comment not found");
      const comment = await CommentModel.findById(commentId);
      if (!comment) throw new HttpError(404, "not_found", "Comment not found");

      const itinerary = await ItineraryModel.findById(comment.itineraryId).select("ownerId");
      const isAuthor = comment.userId.toString() === req.userId;
      const isItineraryOwner =
        itinerary?.ownerId && itinerary.ownerId.toString() === req.userId;
      if (!isAuthor && !isItineraryOwner)
        throw new HttpError(403, "forbidden", "Cannot delete this comment");

      await comment.deleteOne();
      await ItineraryModel.updateOne({ _id: comment.itineraryId }, { $inc: { commentCount: -1 } });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

function generateInviteToken(): string {
  return randomBytes(16).toString("base64url");
}

async function requireOwnerItinerary(id: string, userId: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "not_found", "Itinerary not found");
  const doc = await ItineraryModel.findById(id).select("ownerId");
  if (!doc) throw new HttpError(404, "not_found", "Itinerary not found");
  if (!doc.ownerId || doc.ownerId.toString() !== userId)
    throw new HttpError(403, "forbidden", "Not your itinerary");
  return doc;
}

itinerariesRouter.post(
  "/:id/swap",
  requireAuth,
  swapRateLimiter,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = getParam(req, "id", "Itinerary not found");
      if (!isValidObjectId(id)) throw new HttpError(404, "not_found", "Itinerary not found");
      const doc = await ItineraryModel.findById(id);
      if (!doc) throw new HttpError(404, "not_found", "Itinerary not found");
      if (!doc.ownerId || doc.ownerId.toString() !== req.userId)
        throw new HttpError(403, "forbidden", "Not your itinerary");

      const input = swapSuggestionsSchema.parse(req.body);
      const day = doc.days.find((d) => d.dayNumber === input.dayNumber);
      if (!day) throw new HttpError(404, "item_not_found", "Day not found");
      const current = day.items.find((it) => it.itemId === input.itemId);
      if (!current) throw new HttpError(404, "item_not_found", "Item not found");

      const sameDayOthers = day.items
        .filter((it) => it.itemId !== current.itemId)
        .map((it) => ({
          name: it.name,
          area: it.area,
          timeSlot: it.timeSlot as ItineraryItem["timeSlot"],
          category: it.category as ItineraryItem["category"],
        }));

      const ai = getAiClient();
      let suggestions;
      try {
        suggestions = await ai.generateSwapSuggestions({
          destination: doc.destination,
          budgetTier: doc.budgetTier as Itinerary["budgetTier"],
          tripType: doc.tripType as Itinerary["tripType"],
          vibeTags: doc.vibeTags as Itinerary["vibeTags"],
          dayTitle: day.title,
          current: {
            itemId: current.itemId,
            category: current.category as ItineraryItem["category"],
            name: current.name,
            area: current.area,
            description: current.description,
            timeSlot: current.timeSlot as ItineraryItem["timeSlot"],
            notes: current.notes,
            sourceType: current.sourceType as ItineraryItem["sourceType"],
          },
          sameDayOtherItems: sameDayOthers,
        });
      } catch (err) {
        logger.error({ err }, "swap suggestions failed");
        throw new HttpError(502, "ai_unavailable", "Could not fetch alternatives. Try again shortly.");
      }

      res.json({ suggestions });
    } catch (err) {
      next(err);
    }
  },
);

itinerariesRouter.post(
  "/:id/remix",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = getParam(req, "id", "Itinerary not found");
      if (!isValidObjectId(id)) throw new HttpError(404, "not_found", "Itinerary not found");
      const source = await ItineraryModel.findById(id);
      if (!source) throw new HttpError(404, "not_found", "Itinerary not found");

      const sourceOwnerId = source.ownerId ? source.ownerId.toString() : null;
      const isOwner = !!sourceOwnerId && sourceOwnerId === req.userId;
      if (source.visibility !== "public" && !isOwner) {
        throw new HttpError(404, "not_found", "Itinerary not found");
      }

      const remix = await ItineraryModel.create({
        ownerId: new Types.ObjectId(req.userId),
        anonymousSessionId: null,
        title: source.title,
        summary: source.summary,
        destination: source.destination,
        durationDays: source.durationDays,
        budgetTier: source.budgetTier,
        tripType: source.tripType,
        vibeTags: source.vibeTags,
        visibility: "private",
        coverImageUrl: source.coverImageUrl,
        sourceItineraryId: source._id,
        days: source.days.map((d) => ({
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
      });
      await ItineraryModel.updateOne({ _id: source._id }, { $inc: { remixCount: 1 } });

      const itinerary = await enrichItinerary(remix, req.userId!);
      res.status(201).json({ itinerary });
    } catch (err) {
      next(err);
    }
  },
);

itinerariesRouter.post(
  "/:id/invites",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = getParam(req, "id", "Itinerary not found");
      await requireOwnerItinerary(id, req.userId!);
      const input = createInviteSchema.parse(req.body ?? {});

      const invite = await InviteModel.create({
        itineraryId: new Types.ObjectId(id),
        token: generateInviteToken(),
        createdBy: new Types.ObjectId(req.userId),
        label: input.label ?? "",
      });
      res.status(201).json({ invite: toPublicInvite(invite) });
    } catch (err) {
      next(err);
    }
  },
);

itinerariesRouter.get(
  "/:id/invites",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = getParam(req, "id", "Itinerary not found");
      await requireOwnerItinerary(id, req.userId!);

      const invites = await InviteModel.find({ itineraryId: id, revokedAt: null })
        .sort({ createdAt: -1 })
        .limit(50);
      res.json({ invites: invites.map(toPublicInvite) });
    } catch (err) {
      next(err);
    }
  },
);

itinerariesRouter.delete(
  "/invites/:inviteId",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const inviteId = getParam(req, "inviteId", "Invite not found");
      if (!isValidObjectId(inviteId)) throw new HttpError(404, "not_found", "Invite not found");
      const invite = await InviteModel.findById(inviteId);
      if (!invite) throw new HttpError(404, "not_found", "Invite not found");

      const itinerary = await ItineraryModel.findById(invite.itineraryId).select("ownerId");
      if (!itinerary?.ownerId || itinerary.ownerId.toString() !== req.userId)
        throw new HttpError(403, "forbidden", "Not your invite");

      if (!invite.revokedAt) {
        invite.revokedAt = new Date();
        await invite.save();
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
