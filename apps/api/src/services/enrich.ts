import { Types } from "mongoose";
import type { Itinerary } from "@planna/shared";
import { ItineraryModel, toPublicItinerary, type ItineraryDoc } from "../models/Itinerary.js";
import { LikeModel } from "../models/Like.js";
import { SaveModel } from "../models/Save.js";
import { UserModel } from "../models/User.js";

function asId(id: unknown): string | null {
  if (!id) return null;
  if (id instanceof Types.ObjectId) return id.toString();
  if (typeof id === "string") return id;
  return null;
}

export async function enrichItineraries(
  docs: ItineraryDoc[],
  viewerId: string | null,
): Promise<Itinerary[]> {
  if (docs.length === 0) return [];

  const sourceIds = Array.from(
    new Set(
      docs
        .map((d) => asId(d.sourceItineraryId))
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const sources = sourceIds.length
    ? await ItineraryModel.find({ _id: { $in: sourceIds } }).select("ownerId title")
    : [];
  const sourceMap = new Map(sources.map((s) => [s._id.toString(), s]));

  const ownerIds = Array.from(
    new Set(
      [
        ...docs.map((d) => asId(d.ownerId)),
        ...sources.map((s) => asId(s.ownerId)),
      ].filter((v): v is string => Boolean(v)),
    ),
  );
  const owners = ownerIds.length
    ? await UserModel.find({ _id: { $in: ownerIds } }).select("username displayName")
    : [];
  const ownerMap = new Map(owners.map((o) => [o._id.toString(), o]));

  let likedSet = new Set<string>();
  let savedSet = new Set<string>();
  if (viewerId) {
    const ids = docs.map((d) => d._id);
    const [likes, saves] = await Promise.all([
      LikeModel.find({ userId: viewerId, itineraryId: { $in: ids } }).select("itineraryId"),
      SaveModel.find({ userId: viewerId, itineraryId: { $in: ids } }).select("itineraryId"),
    ]);
    likedSet = new Set(likes.map((l) => l.itineraryId.toString()));
    savedSet = new Set(saves.map((s) => s.itineraryId.toString()));
  }

  return docs.map((doc) => {
    const ownerId = asId(doc.ownerId);
    const owner = ownerId ? ownerMap.get(ownerId) : undefined;
    const sourceId = asId(doc.sourceItineraryId);
    const source = sourceId ? sourceMap.get(sourceId) : undefined;
    const sourceOwnerId = source ? asId(source.ownerId) : null;
    const sourceOwner = sourceOwnerId ? ownerMap.get(sourceOwnerId) : undefined;
    return toPublicItinerary(doc, {
      owner: owner
        ? { id: ownerId!, username: owner.username, displayName: owner.displayName }
        : null,
      engagement: viewerId
        ? {
            likedByMe: likedSet.has(doc._id.toString()),
            savedByMe: savedSet.has(doc._id.toString()),
          }
        : undefined,
      remixedFrom: source
        ? {
            id: sourceId!,
            title: source.title,
            ownerUsername: sourceOwner?.username,
            ownerDisplayName: sourceOwner?.displayName,
          }
        : null,
    });
  });
}

export async function enrichItinerary(
  doc: ItineraryDoc,
  viewerId: string | null,
): Promise<Itinerary> {
  const [result] = await enrichItineraries([doc], viewerId);
  return result!;
}

export async function publishedCount(userId: string): Promise<number> {
  return ItineraryModel.countDocuments({ ownerId: userId, visibility: "public" });
}
