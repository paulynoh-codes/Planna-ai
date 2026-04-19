import type { Itinerary, BudgetTier, TripType, VibeTag } from "./itinerary";
import type { AuthResponse, PublicProfile } from "./user";

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface GenerateItineraryRequest {
  destination: string;
  durationDays: number;
  budgetTier: BudgetTier;
  tripType: TripType;
  vibeTags: VibeTag[];
  notes?: string;
}

export interface GenerateItineraryResponse {
  itinerary: Itinerary;
}

export interface SignupRequest {
  email: string;
  password: string;
  username: string;
  displayName?: string;
  anonymousSessionId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type AuthApiResponse = AuthResponse;

export interface ListItinerariesResponse {
  itineraries: Itinerary[];
}

export interface ItineraryResponse {
  itinerary: Itinerary;
}

export interface UpdateItineraryRequest {
  title?: string;
  summary?: string;
  visibility?: "private" | "public";
  coverImageUrl?: string;
  days?: Itinerary["days"];
}

export interface FeedResponse {
  featured: Itinerary[];
  recent: Itinerary[];
  recentNextCursor: string | null;
}

export interface Comment {
  id: string;
  itineraryId: string;
  userId: string;
  username: string;
  displayName: string;
  text: string;
  createdAt: string;
}

export interface ListCommentsResponse {
  comments: Comment[];
  nextCursor: string | null;
}

export interface AddCommentRequest {
  text: string;
}

export interface AddCommentResponse {
  comment: Comment;
}

export interface ToggleResponse {
  active: boolean;
  count: number;
}

export interface ProfileResponse {
  profile: PublicProfile;
  itineraries: Itinerary[];
}

export const ANON_SESSION_HEADER = "x-anon-session";
