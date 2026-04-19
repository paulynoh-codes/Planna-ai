import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Comment, Itinerary } from "@planna/shared";
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

  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);

  const isOwner = !!itinerary && !!user && itinerary.ownerId === user.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setError(null);
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
  }, [id]);

  useEffect(() => {
    if (!itinerary) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.listComments(itinerary.id);
        if (!cancelled) {
          setComments(res.comments);
          setCommentsCursor(res.nextCursor);
        }
      } catch {
        if (!cancelled) setComments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itinerary?.id]);

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
      router.replace("/(tabs)/library");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete.");
    }
  }

  async function handleLike() {
    if (!itinerary) return;
    if (!user) {
      router.push("/(auth)/signup");
      return;
    }
    try {
      const res = await api.toggleLike(itinerary.id);
      setItinerary({ ...itinerary, likedByMe: res.active, likeCount: res.count });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update like.");
    }
  }

  async function handleSaveToggle() {
    if (!itinerary) return;
    if (!user) {
      router.push("/(auth)/signup");
      return;
    }
    try {
      const res = await api.toggleSave(itinerary.id);
      setItinerary({ ...itinerary, savedByMe: res.active, saveCount: res.count });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update save.");
    }
  }

  async function handleComment() {
    if (!itinerary || !commentText.trim()) return;
    if (!user) {
      router.push("/(auth)/signup");
      return;
    }
    setCommentPosting(true);
    try {
      const res = await api.addComment(itinerary.id, { text: commentText.trim() });
      setComments((prev) => [res.comment, ...(prev ?? [])]);
      setItinerary({ ...itinerary, commentCount: itinerary.commentCount + 1 });
      setCommentText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not post comment.");
    } finally {
      setCommentPosting(false);
    }
  }

  async function handleCommentDelete(commentId: string) {
    if (!itinerary) return;
    try {
      await api.deleteComment(commentId);
      setComments((prev) => (prev ?? []).filter((c) => c.id !== commentId));
      setItinerary({ ...itinerary, commentCount: Math.max(0, itinerary.commentCount - 1) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete comment.");
    }
  }

  async function loadMoreComments() {
    if (!itinerary || !commentsCursor) return;
    try {
      const res = await api.listComments(itinerary.id, commentsCursor);
      setComments((prev) => [...(prev ?? []), ...res.comments]);
      setCommentsCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more comments.");
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
      {isOwner ? (
        <View style={styles.settings}>
          <Field label="Title" value={title} onChangeText={setTitle} onBlur={handleTitleSave} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>
                {itinerary.visibility === "public"
                  ? "Public — anyone with the link can view."
                  : "Private — only you can see this trip."}
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
        </View>
      ) : itinerary.ownerUsername ? (
        <Pressable
          onPress={() =>
            router.push({ pathname: "/u/[username]", params: { username: itinerary.ownerUsername! } })
          }
        >
          <Text style={styles.byline}>
            BY @{itinerary.ownerUsername}
            {itinerary.ownerDisplayName ? ` · ${itinerary.ownerDisplayName}` : ""}
          </Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ItineraryView itinerary={itinerary} />

      <View style={styles.engagement}>
        <EngagementButton
          label={`♥ ${itinerary.likeCount}`}
          active={!!itinerary.likedByMe}
          onPress={handleLike}
        />
        <EngagementButton
          label={`◉ ${itinerary.saveCount}`}
          active={!!itinerary.savedByMe}
          onPress={handleSaveToggle}
        />
        <EngagementButton label={`▢ ${itinerary.commentCount}`} active={false} onPress={() => {}} />
      </View>

      <View style={{ gap: spacing.md }}>
        <Text style={styles.sectionTitle}>Comments</Text>
        {user ? (
          <View style={styles.commentCompose}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              placeholderTextColor={colors.inkMuted}
              style={styles.commentInput}
              multiline
            />
            <Button
              label="Post"
              onPress={handleComment}
              loading={commentPosting}
              disabled={!commentText.trim()}
            />
          </View>
        ) : (
          <Pressable onPress={() => router.push("/(auth)/signup")} style={styles.commentGate}>
            <Text style={styles.commentGateText}>Sign up to comment and save this trip.</Text>
          </Pressable>
        )}

        {comments === null ? (
          <ActivityIndicator color={colors.ink} />
        ) : comments.length === 0 ? (
          <Text style={styles.meta}>No comments yet.</Text>
        ) : (
          comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.commentAuthor}>@{c.username}</Text>
              <Text style={styles.commentText}>{c.text}</Text>
              {user && (c.userId === user.id || isOwner) ? (
                <Pressable onPress={() => handleCommentDelete(c.id)}>
                  <Text style={styles.commentDelete}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
        {commentsCursor ? (
          <Pressable onPress={loadMoreComments} style={styles.loadMore}>
            <Text style={styles.loadMoreLabel}>Load more</Text>
          </Pressable>
        ) : null}
      </View>

      {isOwner ? <Button label="Delete trip" variant="danger" onPress={handleDelete} /> : null}
    </Screen>
  );
}

function EngagementButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.engagementBtn,
        active && styles.engagementBtnActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.engagementLabel, active && styles.engagementLabelActive]}>{label}</Text>
    </Pressable>
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
  byline: { ...type.caption, color: colors.accent, letterSpacing: 1.5 },
  engagement: { flexDirection: "row", gap: spacing.sm },
  engagementBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  engagementBtnActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  engagementLabel: { ...type.body, color: colors.ink },
  engagementLabelActive: { color: colors.accent, fontWeight: "600" },
  sectionTitle: { ...type.h2, color: colors.ink },
  commentCompose: { gap: spacing.sm },
  commentInput: {
    ...type.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
    minHeight: 80,
  },
  commentGate: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  commentGateText: { ...type.body, color: colors.inkMuted, textAlign: "center" },
  comment: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  commentAuthor: { ...type.caption, color: colors.accent, letterSpacing: 1 },
  commentText: { ...type.body, color: colors.ink },
  commentDelete: { ...type.caption, color: colors.danger, marginTop: spacing.xs },
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
