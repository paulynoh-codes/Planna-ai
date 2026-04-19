import { Link, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { signupSchema } from "@planna/shared";
import { Button } from "../../src/components/Button";
import { Field } from "../../src/components/Field";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { getAnonSessionId } from "../../src/lib/session";
import {
  clearAnonItinerary,
  clearPendingDraftId,
  getPendingDraftId,
} from "../../src/lib/draft";
import { colors, spacing, type } from "../../src/theme";

export default function SignupScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const anonSession = await getAnonSessionId();
    const parsed = signupSchema.safeParse({
      email: email.trim(),
      username: username.trim(),
      displayName: displayName.trim() || undefined,
      password,
      anonymousSessionId: anonSession,
    });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const first = Object.values(fieldErrors)[0]?.[0];
      setError(first ?? "Please check the form.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.signup(parsed.data);
      await signIn(res.user, res.tokens.accessToken);
      const pending = await getPendingDraftId();
      await clearPendingDraftId();
      await clearAnonItinerary();
      if (pending) {
        router.replace({ pathname: "/itinerary/[id]", params: { id: pending } });
      } else {
        router.replace("/library");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.headline}>Save your trip.</Text>
      <Text style={styles.sub}>Create an account to keep, edit, and share your itineraries.</Text>

      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" hint="Letters, numbers, and underscores" />
      <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="(optional)" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry hint="At least 8 characters" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Create account" loading={loading} onPress={submit} />

      <View style={{ alignItems: "center" }}>
        <Link href="/(auth)/login" style={styles.link}>
          Already have an account? Log in
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headline: { ...type.h1, color: colors.ink },
  sub: { ...type.body, color: colors.inkMuted },
  error: { ...type.body, color: colors.danger },
  link: { ...type.body, color: colors.ink, textDecorationLine: "underline", marginTop: spacing.md },
});
