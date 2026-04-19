import { z } from "zod";
import { VIBE_TAGS } from "../types/itinerary";

export const budgetTierSchema = z.enum(["budget", "mid", "lux"]);
export const tripTypeSchema = z.enum(["solo", "couple", "group"]);
export const vibeTagSchema = z.enum(VIBE_TAGS);
export const visibilitySchema = z.enum(["private", "public"]);

export const generateItinerarySchema = z.object({
  destination: z.string().min(2).max(120),
  durationDays: z.number().int().min(1).max(7),
  budgetTier: budgetTierSchema,
  tripType: tripTypeSchema,
  vibeTags: z.array(vibeTagSchema).min(1).max(4),
  notes: z.string().max(500).optional(),
});

export type GenerateItineraryInput = z.infer<typeof generateItinerarySchema>;

export const itineraryItemSchema = z.object({
  itemId: z.string().min(1),
  category: z.enum(["food", "activity", "sight", "lodging", "transport", "nightlife", "other"]),
  name: z.string().min(1).max(140),
  area: z.string().max(140),
  description: z.string().max(600),
  timeSlot: z.enum(["morning", "midday", "afternoon", "evening", "night"]),
  notes: z.string().max(400).optional(),
  sourceType: z.enum(["generated", "manual", "swapped"]),
});

export const itineraryDaySchema = z.object({
  dayNumber: z.number().int().min(1).max(7),
  title: z.string().min(1).max(140),
  items: z.array(itineraryItemSchema).min(1).max(8),
});

export const updateItinerarySchema = z.object({
  title: z.string().min(1).max(140).optional(),
  summary: z.string().max(600).optional(),
  visibility: visibilitySchema.optional(),
  coverImageUrl: z.string().url().max(500).optional(),
  days: z.array(itineraryDaySchema).max(7).optional(),
});

export type UpdateItineraryInput = z.infer<typeof updateItinerarySchema>;
