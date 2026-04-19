import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const likeSchema = new Schema(
  {
    itineraryId: { type: Schema.Types.ObjectId, ref: "Itinerary", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

likeSchema.index({ itineraryId: 1, userId: 1 }, { unique: true });
likeSchema.index({ userId: 1, createdAt: -1 });

export type LikeDoc = HydratedDocument<InferSchemaType<typeof likeSchema>>;
export const LikeModel = model("Like", likeSchema);
