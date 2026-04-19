export type Visibility = "private" | "public";
export type TripType = "solo" | "couple" | "group";
export type BudgetTier = "budget" | "mid" | "lux";

export const VIBE_TAGS = [
  "relaxing",
  "food",
  "adventure",
  "romantic",
  "social",
  "luxury",
  "budget",
  "culture",
  "nature",
  "nightlife",
] as const;
export type VibeTag = (typeof VIBE_TAGS)[number];

export type ItemCategory =
  | "food"
  | "activity"
  | "sight"
  | "lodging"
  | "transport"
  | "nightlife"
  | "other";

export type ItemTimeSlot = "morning" | "midday" | "afternoon" | "evening" | "night";

export type ItemSourceType = "generated" | "manual" | "swapped";

export interface ItineraryItem {
  itemId: string;
  category: ItemCategory;
  name: string;
  area: string;
  description: string;
  timeSlot: ItemTimeSlot;
  notes?: string;
  sourceType: ItemSourceType;
}

export interface ItineraryDay {
  dayNumber: number;
  title: string;
  items: ItineraryItem[];
}

export interface Itinerary {
  id: string;
  ownerId: string | null;
  ownerUsername?: string;
  ownerDisplayName?: string;
  title: string;
  destination: string;
  durationDays: number;
  budgetTier: BudgetTier;
  tripType: TripType;
  vibeTags: VibeTag[];
  visibility: Visibility;
  isFeatured: boolean;
  sourceItineraryId: string | null;
  remixedFrom: RemixSource | null;
  remixCount: number;
  days: ItineraryDay[];
  summary: string;
  coverImageUrl?: string;
  likeCount: number;
  saveCount: number;
  commentCount: number;
  likedByMe?: boolean;
  savedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RemixSource {
  id: string;
  title: string;
  ownerUsername?: string;
  ownerDisplayName?: string;
}

export interface RemixItineraryResponse {
  itinerary: Itinerary;
}
