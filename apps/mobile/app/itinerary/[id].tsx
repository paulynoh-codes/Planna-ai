import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Comment, Invite, Itinerary } from "@planna/shared";
import { Button } from "../../src/components/Button";
import { Field } from "../../src/components/Field";
import { ItineraryView } from "../../src/components/ItineraryView";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { clearInvite, getInviteToken } from "../../src/lib/invites";
import { colors, radius, spacing, type } from "../../src/theme";

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_URL ??
  (typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost:19006");

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);

  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [inviteLabel, setInviteLabel] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [remixing, setRemixing] = useState(false);

  const isOwner = !!itinerary && !!user && itinerary.ownerId === user.id;
  const canRemix = !!itinerary && !isOwner && itinerary.visibility === "public";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setError(null);
    (async () => {
      const storedToken = await getInviteToken(id);
      if (cancelled) return;
      setInviteToken(storedToken);
      try {
        const res = await api.getItinerary(id, storedToken);
        if (cancelled) return;
        setItinerary(res.itinerary);
        setTitle(res.itinerary.title);
        if (storedToken && (res.itinerary.ownerId === null || res.itinerary.visibility === "public")) {
          // No longer need the stored token
          await clearInvite(id);
          setInviteToken(null);
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
        const res = await api.listComments(itinerary.id, null, inviteToken);
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
  }, [itinerary?.id, inviteToken]);

  const refreshInvites = useCallback(async () => {
    if (!itinerary || !isOwner) return;
    try {
      const res = await api.listInvites(itinerary.id);
      setInvites(res.invites);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load invites.");
    }
  }, [itinerary, isOwner]);

  useEffect(() => {
    if (isOwner) refreshInvites();
  }, [isOwner, refreshInvites]);

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
      const res = await api.addComment(itinerary.id, { text: commentText.trim() }, inviteToken);
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
      const res = await api.listComments(itinerary.id, commentsCursor, inviteToken);
      setComments((prev) => [...(prev ?? []), ...res.comments]);
      setCommentsCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more comments.");
    }
  }

  async function handleCreateInvite() {
    if (!itinerary) return;
    setCreatingInvite(true);
    try {
      const res = await api.createInvite(itinerary.id, { label: inviteLabel.trim() || undefined });
      setInvites((prev) => [res.invite, ...(prev ?? [])]);
      setInviteLabel("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create invite.");
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      await api.revokeInvite(inviteId);
      setInvites((prev) => (prev ?? []).filter((i) => i.id !== inviteId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke invite.");
    }
  }

  async function handleRemix() {
    if (!itinerary) return;
    if (!user) {
      router.push("/(auth)/signup");
      return;
    }
    setRemixing(true);
    try {
      const res = await api.remixItinerary(itinerary.id);
      router.replace({ pathname: "/itinerary/[id]", params: { id: res.itinerary.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remix trip.");
    } finally {
      setRemixing(false);
    }
  }

  async function handleShareInvite(url: string, token: string) {
    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          setCopiedToken(token);
          setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 2000);
          return;
        }
      }
      await Share.share({ message: url, url });
    } catch {
      // User cancelled share — ignore.
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

      {itinerary.remixedFrom ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/itinerary/[id]",
              params: { id: itinerary.remixedFrom!.id },
            })
          }
          style={styles.remixBadge}
        >
          <Text style={styles.remixBadgeText}>
            REMIXED FROM {itinerary.remixedFrom.ownerUsername
              ? `@${itinerary.remixedFrom.ownerUsername}`
              : "original"}
            {" · "}
            {itinerary.remixedFrom.title}
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
        {itinerary.remixCount > 0 ? (
          <EngagementButton label={`⟳ ${itinerary.remixCount}`} active={false} onPress={() => {}} />
        ) : null}
      </View>

      {canRemix ? (
        <Button
          label={remixing ? "Remixing…" : "Remix into my library"}
          onPress={handleRemix}
          loading={remixing}
        />
      ) : null}

      {isOwner ? (
        <View style={styles.invitesCard}>
          <Text style={styles.sectionTitle}>Invite links</Text>
          <Text style={styles.meta}>
            Share a link with friends so they can view and comment — even if this trip is private.
          </Text>
          <View style={styles.inviteCompose}>
            <TextInput
              value={inviteLabel}
              onChangeText={setInviteLabel}
              placeholder="Label (optional) — e.g. honeymoon crew"
              placeholderTextColor={colors.inkMuted}
              style={styles.inviteInput}
              maxLength={40}
            />
            <Button
              label="Create invite link"
              onPress={handleCreateInvite}
              loading={creatingInvite}
            />
          </View>

          {invites === null ? (
            <ActivityIndicator color={colors.ink} />
          ) : invites.length === 0 ? (
            <Text style={styles.meta}>No invites yet.</Text>
          ) : (
            invites.map((invite) => {
              const url = `${WEB_BASE_URL}/i/${invite.token}`;
              return (
                <View key={invite.id} style={styles.invite}>
                  <Text style={styles.inviteLabel}>{invite.label || "Untitled"}</Text>
                  <TextInput
                    value={url}
                    editable={false}
                    selectTextOnFocus
                    style={styles.inviteUrl}
                  />
                  <View style={styles.inviteActions}>
                    <Button
                      label={copiedToken === invite.token ? "Copied!" : "Share / copy"}
                      variant="secondary"
                      onPress={() => handleShareInvite(url, invite.token)}
                    />
                    <Button
                      label="Revoke"
                      variant="ghost"
                      onPress={() => handleRevokeInvite(invite.id)}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}

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
  remixBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  remixBadgeText: { ...type.caption, color: colors.ink, letterSpacing: 1 },
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
  invitesCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  inviteCompose: { gap: spacing.sm },
  inviteInput: {
    ...type.body,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
  },
  invite: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  inviteLabel: { ...type.h2, color: colors.ink },
  inviteUrl: {
    ...type.body,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.ink,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 13,
  },
  inviteActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
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
