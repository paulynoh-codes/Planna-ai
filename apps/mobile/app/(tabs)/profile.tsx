import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Itinerary, PublicProfile } from "@planna/shared";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, radius, spacing, type } from "../../src/theme";

export default function ProfileScreen() {
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setProfile(null);
        setItineraries(null);
        return;
      }
      let cancelled = false;
      setError(null);
      (async () => {
        try {
          const res = await api.profile(user.username);
          if (!cancelled) {
            setProfile(res.profile);
            setItineraries(res.itineraries);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.message : "Could not load your profile.");
            setItineraries([]);
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
        <Text style={styles.eyebrow}>PROFILE</Text>
        <Text style={styles.headline}>Your travel wardrobe.</Text>
        <Text style={styles.body}>
          Sign up to save trips, build your profile, and share your itineraries with other travelers.
        </Text>
        <Button label="Create account" onPress={() => router.push("/(auth)/signup")} />
        <Button label="Log in" variant="secondary" onPress={() => router.push("/(auth)/login")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text style={styles.displayName}>{user.displayName || user.username}</Text>
        <Text style={styles.handle}>@{user.username}</Text>
        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      <View style={styles.statsRow}>
        <Stat value={profile?.publishedCount ?? 0} label="PUBLISHED" />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ gap: spacing.md }}>
        <Text style={styles.sectionTitle}>Your published trips</Text>
        {itineraries === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : itineraries.length === 0 ? (
          <View style={{ gap: spacing.md }}>
            <Text style={styles.body}>
              You haven't published any trips yet. Plan one, then set it to public from the library.
            </Text>
            <Button label="Plan a trip" onPress={() => router.push("/plan")} />
          </View>
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
              <Text style={styles.statsRowInline}>
                ♥ {it.likeCount} · ◉ {it.saveCount} · ▢ {it.commentCount}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <Button label="Log out" variant="ghost" onPress={signOut} />
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
  eyebrow: { ...type.caption, color: colors.accent, letterSpacing: 3 },
  headline: { ...type.h1, color: colors.ink },
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
  statsRowInline: { ...type.caption, color: colors.inkMuted, letterSpacing: 1, marginTop: spacing.xs },
});
