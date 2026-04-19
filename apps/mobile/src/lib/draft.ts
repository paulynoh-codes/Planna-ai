import type { Itinerary } from "@planna/shared";
import { getItem, removeItem, setItem } from "./storage";

const KEY = "planna.pendingDraftId";

export async function setPendingDraftId(id: string): Promise<void> {
  await setItem(KEY, id);
}

export async function getPendingDraftId(): Promise<string | null> {
  return getItem(KEY);
}

export async function clearPendingDraftId(): Promise<void> {
  await removeItem(KEY);
}

const LAST_KEY = "planna.lastAnonItinerary";

export async function cacheAnonItinerary(it: Itinerary): Promise<void> {
  await setItem(LAST_KEY, JSON.stringify(it));
}

export async function loadAnonItinerary(): Promise<Itinerary | null> {
  const raw = await getItem(LAST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Itinerary;
  } catch {
    return null;
  }
}

export async function clearAnonItinerary(): Promise<void> {
  await removeItem(LAST_KEY);
}
