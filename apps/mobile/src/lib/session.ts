import { v4 as uuid } from "uuid";
import { getItem, setItem, removeItem } from "./storage";

const KEY = "planna.anonSession";

export async function getAnonSessionId(): Promise<string> {
  const existing = await getItem(KEY);
  if (existing) return existing;
  const id = uuid();
  await setItem(KEY, id);
  return id;
}

export async function clearAnonSession(): Promise<void> {
  await removeItem(KEY);
}
