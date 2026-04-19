import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Itinerary } from "@planna/shared";
import { Button } from "../../src/components/Button";
import { ItineraryView } from "../../src/components/ItineraryView";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { clearAnonItinerary, loadAnonItinerary, setPendingDraftId } from "../../src/lib/draft";
import { colors, spacing, type } from "../../src/theme";

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (user && id) {
          const res = await api.getItinerary(id);
          if (!cancelled) setItinerary(res.itinerary);
        } else {
          const cached = await loadAnonItinerary();
          if (!cancelled) {
            setItinerary(cached);
            if (!cached) setError("Draft not found. Try planning again.");
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load draft.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  async function handleSave() {
    if (!itinerary) return;
    if (user) {
      router.replace({ pathname: "/itinerary/[id]", params: { id: itinerary.id } });
      return;
    }
    await setPendingDraftId(itinerary.id);
    router.push("/(auth)/signup");
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.loading}>Building your itinerary…</Text>
        </View>
      </Screen>
    );
  }

  if (!itinerary) {
    return (
      <Screen>
        <Text style={styles.error}>{error ?? "No itinerary loaded."}</Text>
        <Button label="Back to planner" variant="secondary" onPress={() => router.replace("/plan")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ItineraryView itinerary={itinerary} />
      <View style={{ gap: spacing.sm }}>
        <Button
          label={user ? "Open in your library" : "Save this trip"}
          onPress={handleSave}
        />
        <Button label="Plan another" variant="secondary" onPress={() => {
          if (!user) void clearAnonItinerary();
          router.replace("/plan");
        }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxl },
  loading: { ...type.body, color: colors.inkMuted },
  error: { ...type.body, color: colors.danger },
});
