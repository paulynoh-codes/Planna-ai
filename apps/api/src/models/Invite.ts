import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import type { Invite } from "@planna/shared";

const inviteSchema = new Schema(
  {
    itineraryId: { type: Schema.Types.ObjectId, ref: "Itinerary", required: true },
    token: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, default: "" },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

inviteSchema.index({ itineraryId: 1, revokedAt: 1, createdAt: -1 });

export type InviteDoc = HydratedDocument<InferSchemaType<typeof inviteSchema>>;
export const InviteModel = model("Invite", inviteSchema);

export function toPublicInvite(doc: InviteDoc): Invite {
  return {
    id: doc._id.toString(),
    itineraryId: doc.itineraryId.toString(),
    token: doc.token,
    createdBy: doc.createdBy.toString(),
    label: doc.label || undefined,
    createdAt: doc.createdAt.toISOString(),
    revokedAt: doc.revokedAt ? doc.revokedAt.toISOString() : null,
  };
}
