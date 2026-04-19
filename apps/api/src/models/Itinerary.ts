import { Schema, Types, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import type { Itinerary } from "@planna/shared";

const itemSchema = new Schema(
  {
    itemId: { type: String, required: true },
    category: {
      type: String,
      enum: ["food", "activity", "sight", "lodging", "transport", "nightlife", "other"],
      required: true,
    },
    name: { type: String, required: true },
    area: { type: String, default: "" },
    description: { type: String, default: "" },
    timeSlot: {
      type: String,
      enum: ["morning", "midday", "afternoon", "evening", "night"],
      required: true,
    },
    notes: { type: String, default: "" },
    sourceType: {
      type: String,
      enum: ["generated", "manual", "swapped"],
      default: "generated",
    },
  },
  { _id: false },
);

const daySchema = new Schema(
  {
    dayNumber: { type: Number, required: true },
    title: { type: String, required: true },
    items: { type: [itemSchema], default: [] },
  },
  { _id: false },
);

const itinerarySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    anonymousSessionId: { type: String, default: null, index: true },
    title: { type: String, required: true },
    destination: { type: String, required: true },
    durationDays: { type: Number, required: true, min: 1, max: 7 },
    budgetTier: { type: String, enum: ["budget", "mid", "lux"], required: true },
    tripType: { type: String, enum: ["solo", "couple", "group"], required: true },
    vibeTags: { type: [String], default: [] },
    visibility: { type: String, enum: ["private", "public"], default: "private", index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    sourceItineraryId: { type: Schema.Types.ObjectId, ref: "Itinerary", default: null },
    days: { type: [daySchema], default: [] },
    summary: { type: String, default: "" },
    coverImageUrl: { type: String, default: "" },
    likeCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

itinerarySchema.index({ ownerId: 1, updatedAt: -1 });
itinerarySchema.index({ visibility: 1, createdAt: -1 });
itinerarySchema.index({ visibility: 1, isFeatured: 1, createdAt: -1 });

export type ItineraryDoc = HydratedDocument<InferSchemaType<typeof itinerarySchema>>;

export const ItineraryModel = model("Itinerary", itinerarySchema);

export interface OwnerRef {
  id: string;
  username?: string;
  displayName?: string;
}

export interface EngagementFlags {
  likedByMe?: boolean;
  savedByMe?: boolean;
}

export function toPublicItinerary(
  doc: ItineraryDoc,
  opts: { owner?: OwnerRef | null; engagement?: EngagementFlags } = {},
): Itinerary {
  const ownerId = doc.ownerId ? doc.ownerId.toString() : null;
  return {
    id: doc._id.toString(),
    ownerId,
    ownerUsername: opts.owner?.username,
    ownerDisplayName: opts.owner?.displayName,
    title: doc.title,
    destination: doc.destination,
    durationDays: doc.durationDays,
    budgetTier: doc.budgetTier as Itinerary["budgetTier"],
    tripType: doc.tripType as Itinerary["tripType"],
    vibeTags: (doc.vibeTags ?? []) as Itinerary["vibeTags"],
    visibility: doc.visibility as Itinerary["visibility"],
    isFeatured: Boolean(doc.isFeatured),
    sourceItineraryId: doc.sourceItineraryId ? doc.sourceItineraryId.toString() : null,
    days: doc.days.map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      items: d.items.map((it) => ({
        itemId: it.itemId,
        category: it.category as Itinerary["days"][number]["items"][number]["category"],
        name: it.name,
        area: it.area,
        description: it.description,
        timeSlot: it.timeSlot as Itinerary["days"][number]["items"][number]["timeSlot"],
        notes: it.notes || undefined,
        sourceType: it.sourceType as Itinerary["days"][number]["items"][number]["sourceType"],
      })),
    })),
    summary: doc.summary,
    coverImageUrl: doc.coverImageUrl || undefined,
    likeCount: doc.likeCount ?? 0,
    saveCount: doc.saveCount ?? 0,
    commentCount: doc.commentCount ?? 0,
    likedByMe: opts.engagement?.likedByMe,
    savedByMe: opts.engagement?.savedByMe,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}
