import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import type { Comment } from "@planna/shared";

const commentSchema = new Schema(
  {
    itineraryId: { type: Schema.Types.ObjectId, ref: "Itinerary", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

commentSchema.index({ itineraryId: 1, createdAt: -1 });

export type CommentDoc = HydratedDocument<InferSchemaType<typeof commentSchema>>;
export const CommentModel = model("Comment", commentSchema);

export function toPublicComment(
  doc: CommentDoc,
  author: { id: string; username: string; displayName: string },
): Comment {
  return {
    id: doc._id.toString(),
    itineraryId: doc.itineraryId.toString(),
    userId: author.id,
    username: author.username,
    displayName: author.displayName,
    text: doc.text,
    createdAt: doc.createdAt.toISOString(),
  };
}
