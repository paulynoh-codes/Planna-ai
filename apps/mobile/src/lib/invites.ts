import { getItem, setItem } from "./storage";

const KEY = "planna.invites";

async function readMap(): Promise<Record<string, string>> {
  const raw = await getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, string>): Promise<void> {
  await setItem(KEY, JSON.stringify(map));
}

export async function storeInvite(itineraryId: string, token: string): Promise<void> {
  const map = await readMap();
  map[itineraryId] = token;
  await writeMap(map);
}

export async function getInviteToken(itineraryId: string): Promise<string | null> {
  const map = await readMap();
  return map[itineraryId] ?? null;
}

export async function clearInvite(itineraryId: string): Promise<void> {
  const map = await readMap();
  if (!(itineraryId in map)) return;
  delete map[itineraryId];
  await writeMap(map);
}
