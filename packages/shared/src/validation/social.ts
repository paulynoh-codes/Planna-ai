import { z } from "zod";

export const addCommentSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;

export const usernameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only");

export const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;
