import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const saveSchema = new Schema(
  {
    itineraryId: { type: Schema.Types.ObjectId, ref: "Itinerary", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

saveSchema.index({ itineraryId: 1, userId: 1 }, { unique: true });
saveSchema.index({ userId: 1, createdAt: -1 });

export type SaveDoc = HydratedDocument<InferSchemaType<typeof saveSchema>>;
export const SaveModel = model("Save", saveSchema);
