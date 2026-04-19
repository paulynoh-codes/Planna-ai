import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { storeInvite } from "../../src/lib/invites";
import { colors, spacing, type } from "../../src/theme";

export default function InviteRedirectScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.resolveInvite(token);
        if (cancelled) return;
        await storeInvite(res.itinerary.id, token);
        router.replace({ pathname: "/itinerary/[id]", params: { id: res.itinerary.id } });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError({ code: err.code, message: err.message });
        } else {
          setError({ code: "unknown", message: "Could not open this invite." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!error) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.meta}>Opening invite…</Text>
        </View>
      </Screen>
    );
  }

  const headline =
    error.code === "invite_revoked"
      ? "This invite was revoked"
      : error.code === "not_found"
        ? "Invite not found"
        : "Something went wrong";
  const body =
    error.code === "invite_revoked"
      ? "The trip owner revoked this invite. Ask them for a fresh link."
      : error.code === "not_found"
        ? "This invite link doesn't exist. Double-check the URL."
        : error.message;

  return (
    <Screen>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.body}>{body}</Text>
      <Button label="Go home" variant="secondary" onPress={() => router.replace("/(tabs)")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxl },
  meta: { ...type.caption, color: colors.inkMuted },
  headline: { ...type.h1, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
});
