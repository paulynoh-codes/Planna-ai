import { createContext, useContext } from "react";
import type { User } from "@planna/shared";
import { getItem, removeItem, setItem } from "./storage";
import { clearAnonSession } from "./session";

const TOKEN_KEY = "planna.token";

export interface AuthState {
  user: User | null;
  loading: boolean;
  signIn(user: User, token: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export async function persistToken(token: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await removeItem(TOKEN_KEY);
  await clearAnonSession();
}
