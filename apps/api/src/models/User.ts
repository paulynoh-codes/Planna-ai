import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import type { User } from "@planna/shared";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    username: { type: String, required: true, unique: true, trim: true, index: true },
    displayName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    bio: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const UserModel = model("User", userSchema);

export function toPublicUser(doc: UserDoc): User {
  return {
    id: doc._id.toString(),
    email: doc.email,
    username: doc.username,
    displayName: doc.displayName,
    bio: doc.bio || undefined,
    avatarUrl: doc.avatarUrl || undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
