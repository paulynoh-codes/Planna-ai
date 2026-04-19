import Constants from "expo-constants";
import {
  ANON_SESSION_HEADER,
  type AddCommentRequest,
  type AddCommentResponse,
  type AuthApiResponse,
  type FeedResponse,
  type GenerateItineraryRequest,
  type GenerateItineraryResponse,
  type ItineraryResponse,
  type ListCommentsResponse,
  type ListItinerariesResponse,
  type LoginRequest,
  type ProfileResponse,
  type SignupRequest,
  type ToggleResponse,
  type UpdateItineraryRequest,
} from "@planna/shared";
import { getItem } from "./storage";
import { getAnonSessionId } from "./session";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:4000";

const TOKEN_KEY = "planna.token";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  const token = await getItem(TOKEN_KEY);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (!token) {
    const anon = await getAnonSessionId();
    headers.set(ANON_SESSION_HEADER, anon);
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? "unknown", err.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  generateItinerary(body: GenerateItineraryRequest) {
    return request<GenerateItineraryResponse>("/api/itinerary/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  signup(body: SignupRequest) {
    return request<AuthApiResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  login(body: LoginRequest) {
    return request<AuthApiResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  me() {
    return request<{ user: AuthApiResponse["user"] }>("/api/auth/me");
  },
  listItineraries() {
    return request<ListItinerariesResponse>("/api/itineraries");
  },
  getItinerary(id: string) {
    return request<ItineraryResponse>(`/api/itineraries/${id}`);
  },
  updateItinerary(id: string, body: UpdateItineraryRequest) {
    return request<ItineraryResponse>(`/api/itineraries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  deleteItinerary(id: string) {
    return request<null>(`/api/itineraries/${id}`, { method: "DELETE" });
  },

  // Phase 2
  feed(cursor?: string | null) {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return request<FeedResponse>(`/api/feed${q}`);
  },
  toggleLike(id: string) {
    return request<ToggleResponse>(`/api/itineraries/${id}/like`, { method: "POST" });
  },
  toggleSave(id: string) {
    return request<ToggleResponse>(`/api/itineraries/${id}/save`, { method: "POST" });
  },
  listComments(id: string, cursor?: string | null) {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return request<ListCommentsResponse>(`/api/itineraries/${id}/comments${q}`);
  },
  addComment(id: string, body: AddCommentRequest) {
    return request<AddCommentResponse>(`/api/itineraries/${id}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  deleteComment(commentId: string) {
    return request<null>(`/api/itineraries/comments/${commentId}`, { method: "DELETE" });
  },
  listSaves() {
    return request<ListItinerariesResponse>("/api/saves");
  },
  profile(username: string) {
    return request<ProfileResponse>(`/api/users/${encodeURIComponent(username)}`);
  },
};
