import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Itinerary } from "@planna/shared";
import { Button } from "../src/components/Button";
import { Screen } from "../src/components/Screen";
import { api, ApiError } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, radius, spacing, type } from "../src/theme";

export default function LibraryScreen() {
  const { user } = useAuth();
  const [itineraries, setItineraries] = useState<Itinerary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const res = await api.listItineraries();
          if (!cancelled) setItineraries(res.itineraries);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.message : "Could not load trips.");
            setItineraries([]);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  if (itineraries === null) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>YOUR TRIPS</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {itineraries.length === 0 ? (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.body}>No trips yet. Plan your first one.</Text>
          <Button label="Plan a trip" onPress={() => router.push("/plan")} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {itineraries.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => router.push({ pathname: "/itinerary/[id]", params: { id: it.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.meta}>
                {it.destination.toUpperCase()} · {it.durationDays} DAYS ·{" "}
                {it.visibility === "public" ? "PUBLIC" : "PRIVATE"}
              </Text>
              <Text style={styles.title}>{it.title}</Text>
              {it.summary ? <Text style={styles.summary}>{it.summary}</Text> : null}
            </Pressable>
          ))}
          <Button label="Plan another" variant="secondary" onPress={() => router.push("/plan")} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl },
  eyebrow: { ...type.caption, color: colors.inkMuted, letterSpacing: 2 },
  body: { ...type.body, color: colors.inkMuted },
  error: { ...type.body, color: colors.danger },
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
