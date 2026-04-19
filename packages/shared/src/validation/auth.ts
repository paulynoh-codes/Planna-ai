import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
  displayName: z.string().min(1).max(60).optional(),
  anonymousSessionId: z.string().uuid().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;
