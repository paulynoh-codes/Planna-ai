import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Itinerary } from "@planna/shared";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { colors, radius, spacing, type } from "../../src/theme";

export default function ExploreScreen() {
  const [featured, setFeatured] = useState<Itinerary[] | null>(null);
  const [recent, setRecent] = useState<Itinerary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      (async () => {
        try {
          const res = await api.feed();
          if (!cancelled) {
            setFeatured(res.featured);
            setRecent(res.recent);
            setNextCursor(res.recentNextCursor);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.message : "Could not load the feed.");
            setFeatured([]);
            setRecent([]);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.feed(nextCursor);
      setRecent((prev) => [...(prev ?? []), ...res.recent]);
      setNextCursor(res.recentNextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more trips.");
    } finally {
      setLoadingMore(false);
    }
  };

  if (featured === null || recent === null) {
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
      <Text style={styles.eyebrow}>EXPLORE</Text>
      <Text style={styles.headline}>Trips worth stealing.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {featured.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.railTitle}>Featured</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {featured.map((it) => (
              <FeaturedCard key={it.id} it={it} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <Text style={styles.railTitle}>Recent</Text>
        {recent.length === 0 ? (
          <Text style={styles.body}>No public trips yet. Be the first to share one.</Text>
        ) : (
          <View style={{ gap: spacing.md }}>
            {recent.map((it) => (
              <FeedCard key={it.id} it={it} />
            ))}
            {nextCursor ? (
              <Pressable onPress={loadMore} style={styles.loadMore}>
                {loadingMore ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={styles.loadMoreLabel}>Load more</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

function FeaturedCard({ it }: { it: Itinerary }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/itinerary/[id]", params: { id: it.id } })}
      style={({ pressed }) => [styles.featured, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.featuredMeta}>
        {it.destination.toUpperCase()} · {it.durationDays} DAYS
      </Text>
      <Text style={styles.featuredTitle}>{it.title}</Text>
      {it.summary ? (
        <Text style={styles.featuredSummary} numberOfLines={3}>
          {it.summary}
        </Text>
      ) : null}
      <Text style={styles.featuredBy}>
        BY @{it.ownerUsername ?? "traveler"} · ♥ {it.likeCount} · ◉ {it.saveCount}
      </Text>
    </Pressable>
  );
}

function FeedCard({ it }: { it: Itinerary }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/itinerary/[id]", params: { id: it.id } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.meta}>
        {it.destination.toUpperCase()} · {it.durationDays} DAYS · BY @{it.ownerUsername ?? "traveler"}
      </Text>
      <Text style={styles.title}>{it.title}</Text>
      {it.summary ? <Text style={styles.summary}>{it.summary}</Text> : null}
      <Text style={styles.stats}>
        ♥ {it.likeCount} · ◉ {it.saveCount} · ▢ {it.commentCount}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl },
  eyebrow: { ...type.caption, color: colors.accent, letterSpacing: 3 },
  headline: { ...type.h1, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
  error: { ...type.body, color: colors.danger },
  railTitle: { ...type.h2, color: colors.ink },
  rail: { gap: spacing.md, paddingRight: spacing.lg },
  featured: {
    width: 260,
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    minHeight: 180,
  },
  featuredMeta: { ...type.caption, color: colors.accentSoft, letterSpacing: 1 },
  featuredTitle: { ...type.h1, color: "#fff", fontSize: 22 },
  featuredSummary: { ...type.body, color: "#f5ede2" },
  featuredBy: { ...type.caption, color: colors.accentSoft, letterSpacing: 1, marginTop: spacing.xs },
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
  loadMore: {
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  loadMoreLabel: { ...type.body, color: colors.ink, fontWeight: "600" },
});
