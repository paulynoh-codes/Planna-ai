import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Itinerary, PublicProfile } from "@planna/shared";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { colors, radius, spacing, type } from "../../src/theme";

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.profile(username);
        if (!cancelled) {
          setProfile(res.profile);
          setItineraries(res.itineraries);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load this profile.");
          setItineraries([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (!profile && !error) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </Screen>
    );
  }

  if (error || !profile) {
    return (
      <Screen>
        <Text style={styles.error}>{error ?? "Profile not found."}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text style={styles.displayName}>{profile.displayName}</Text>
        <Text style={styles.handle}>@{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      <View style={styles.statsRow}>
        <Stat value={profile.publishedCount} label="PUBLISHED" />
      </View>

      <View style={{ gap: spacing.md }}>
        <Text style={styles.sectionTitle}>Public trips</Text>
        {itineraries === null || itineraries.length === 0 ? (
          <Text style={styles.body}>No public trips yet.</Text>
        ) : (
          itineraries.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => router.push({ pathname: "/itinerary/[id]", params: { id: it.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.meta}>
                {it.destination.toUpperCase()} · {it.durationDays} DAYS
              </Text>
              <Text style={styles.title}>{it.title}</Text>
              {it.summary ? <Text style={styles.summary}>{it.summary}</Text> : null}
              <Text style={styles.stats}>
                ♥ {it.likeCount} · ◉ {it.saveCount} · ▢ {it.commentCount}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl },
  body: { ...type.body, color: colors.inkMuted },
  error: { ...type.body, color: colors.danger },
  displayName: { ...type.display, color: colors.ink, fontSize: 32 },
  handle: { ...type.body, color: colors.inkMuted },
  bio: { ...type.body, color: colors.ink, marginTop: spacing.xs },
  statsRow: { flexDirection: "row", gap: spacing.xl },
  stat: { gap: 2 },
  statValue: { ...type.h1, color: colors.ink },
  statLabel: { ...type.caption, color: colors.inkMuted, letterSpacing: 1 },
  sectionTitle: { ...type.h2, color: colors.ink },
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
  stats: { ...type.caption, color: colors.inkMuted, letterSpacing: 1, marginTop: spacing.xs },
});
