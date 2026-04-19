import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";
import type { Itinerary } from "@planna/shared";
import { Button } from "../../src/components/Button";
import { Field } from "../../src/components/Field";
import { ItineraryView } from "../../src/components/ItineraryView";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, radius, spacing, type } from "../../src/theme";

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getItinerary(id);
        if (!cancelled) {
          setItinerary(res.itinerary);
          setTitle(res.itinerary.title);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load trip.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  async function handleTitleSave() {
    if (!itinerary || title.trim() === itinerary.title) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.updateItinerary(itinerary.id, { title: title.trim() });
      setItinerary(res.itinerary);
      setMessage("Saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(value: boolean) {
    if (!itinerary) return;
    const next = value ? "public" : "private";
    try {
      const res = await api.updateItinerary(itinerary.id, { visibility: next });
      setItinerary(res.itinerary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update visibility.");
    }
  }

  async function handleDelete() {
    if (!itinerary) return;
    try {
      await api.deleteItinerary(itinerary.id);
      router.replace("/library");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete.");
    }
  }

  if (!itinerary) {
    return (
      <Screen>
        <View style={styles.center}>
          {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.ink} />}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.settings}>
        <Field label="Title" value={title} onChangeText={setTitle} onBlur={handleTitleSave} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>
              {itinerary.visibility === "public" ? "Public — anyone with the link can view." : "Private — only you can see this trip."}
            </Text>
          </View>
          <Switch
            value={itinerary.visibility === "public"}
            onValueChange={toggleVisibility}
            thumbColor={colors.surface}
            trackColor={{ false: colors.line, true: colors.accent }}
          />
        </View>
        {saving ? <Text style={styles.meta}>Saving…</Text> : null}
        {message ? <Text style={styles.meta}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <ItineraryView itinerary={itinerary} />

      <Button label="Delete trip" variant="danger" onPress={handleDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl },
  settings: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowLabel: { ...type.body, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted },
  error: { ...type.body, color: colors.danger },
});
