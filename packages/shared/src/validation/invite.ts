import { z } from "zod";

export const createInviteSchema = z.object({
  label: z.string().trim().max(40).optional(),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
