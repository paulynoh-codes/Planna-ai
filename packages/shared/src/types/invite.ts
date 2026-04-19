import type { Itinerary } from "./itinerary";

export interface Invite {
  id: string;
  itineraryId: string;
  token: string;
  createdBy: string;
  label?: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreateInviteRequest {
  label?: string;
}

export interface CreateInviteResponse {
  invite: Invite;
}

export interface ListInvitesResponse {
  invites: Invite[];
}

export interface ResolveInviteResponse {
  itinerary: Itinerary;
}

export const INVITE_TOKEN_HEADER = "x-invite-token";
