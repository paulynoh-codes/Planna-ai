import { Link, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loginSchema } from "@planna/shared";
import { Button } from "../../src/components/Button";
import { Field } from "../../src/components/Field";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, spacing, type } from "../../src/theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const parsed = loginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(parsed.data);
      await signIn(res.user, res.tokens.accessToken);
      router.replace("/library");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.headline}>Welcome back.</Text>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Log in" loading={loading} onPress={submit} />
      <View style={{ alignItems: "center" }}>
        <Link href="/(auth)/signup" style={styles.link}>
          New here? Create an account
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headline: { ...type.h1, color: colors.ink },
  error: { ...type.body, color: colors.danger },
  link: { ...type.body, color: colors.ink, textDecorationLine: "underline", marginTop: spacing.md },
});
