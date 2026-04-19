import { Link, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { Screen } from "../src/components/Screen";
import { useAuth } from "../src/lib/auth";
import { colors, spacing, type } from "../src/theme";

export default function Landing() {
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PLANNA</Text>
        <Text style={styles.headline}>Plan your next trip in minutes.</Text>
        <Text style={styles.sub}>
          Tell us where you want to go and what kind of trip you want. We'll build a day-by-day
          itinerary you can save, edit, and share.
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button label="Plan a trip" onPress={() => router.push("/plan")} />
        {user ? (
          <>
            <Button label="Your trips" variant="secondary" onPress={() => router.push("/library")} />
            <Button label="Log out" variant="ghost" onPress={signOut} />
          </>
        ) : (
          <Link href="/(auth)/login" asChild>
            <Button label="Log in" variant="secondary" />
          </Link>
        )}
      </View>

      {user ? (
        <Text style={styles.signedIn}>Signed in as @{user.username}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.md, marginTop: spacing.xxl },
  eyebrow: { ...type.caption, color: colors.accent, letterSpacing: 3 },
  headline: { ...type.display, color: colors.ink, fontSize: 40, lineHeight: 46 },
  sub: { ...type.body, color: colors.inkMuted, fontSize: 17, lineHeight: 26 },
  signedIn: { ...type.caption, color: colors.inkMuted, textAlign: "center" },
});
