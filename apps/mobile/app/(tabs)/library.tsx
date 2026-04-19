import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Itinerary } from "@planna/shared";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, radius, spacing, type } from "../../src/theme";

type Tab = "mine" | "saved";

export default function LibraryScreen() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");
  const [mine, setMine] = useState<Itinerary[] | null>(null);
  const [saved, setSaved] = useState<Itinerary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      setError(null);
      (async () => {
        try {
          const [a, b] = await Promise.all([api.listItineraries(), api.listSaves()]);
          if (!cancelled) {
            setMine(a.itineraries);
            setSaved(b.itineraries);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.message : "Could not load trips.");
            setMine([]);
            setSaved([]);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <Text style={styles.headline}>Log in to see your trips.</Text>
        <Text style={styles.body}>Plans, saved itineraries, and everything you've published will live here.</Text>
        <Button label="Log in" onPress={() => router.push("/(auth)/login")} />
        <Button label="Create account" variant="secondary" onPress={() => router.push("/(auth)/signup")} />
      </Screen>
    );
  }

  const list = tab === "mine" ? mine : saved;

  return (
    <Screen>
      <Text style={styles.eyebrow}>YOUR TRIPS</Text>
      <View style={styles.tabs}>
        <TabButton label="My trips" active={tab === "mine"} onPress={() => setTab("mine")} />
        <TabButton label="Saved" active={tab === "saved"} onPress={() => setTab("saved")} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {list === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : list.length === 0 ? (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.body}>
            {tab === "mine" ? "No trips yet. Plan your first one." : "No saved trips yet. Explore itineraries from other travelers."}
          </Text>
          <Button
            label={tab === "mine" ? "Plan a trip" : "Explore"}
            onPress={() => router.push(tab === "mine" ? "/plan" : "/(tabs)/explore")}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {list.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => router.push({ pathname: "/itinerary/[id]", params: { id: it.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.meta}>
                {it.destination.toUpperCase()} · {it.durationDays} DAYS ·{" "}
                {tab === "mine"
                  ? it.visibility === "public"
                    ? "PUBLIC"
                    : "PRIVATE"
                  : `BY @${it.ownerUsername ?? "traveler"}`}
              </Text>
              <Text style={styles.title}>{it.title}</Text>
              {it.summary ? <Text style={styles.summary}>{it.summary}</Text> : null}
            </Pressable>
          ))}
          {tab === "mine" ? (
            <Button label="Plan another" variant="secondary" onPress={() => router.push("/plan")} />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Text style={[styles.tabBtnLabel, active && styles.tabBtnLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl },
  eyebrow: { ...type.caption, color: colors.inkMuted, letterSpacing: 2 },
  headline: { ...type.h1, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
  error: { ...type.body, color: colors.danger },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tabBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabBtnActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabBtnLabel: { ...type.body, color: colors.ink },
  tabBtnLabelActive: { color: "#fff", fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  meta: { ...type.caption, color: colors.inkMuted, letterSpacing: 1 },
  title: { ...type.h1, color: colors.ink },
  summary: { ...type.body, color: colors.inkMuted },
});
