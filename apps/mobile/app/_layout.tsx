import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/components/AuthProvider";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontWeight: "600" },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="plan/index" options={{ title: "Plan a trip" }} />
          <Stack.Screen name="plan/result" options={{ title: "Your itinerary" }} />
          <Stack.Screen name="(auth)/signup" options={{ title: "Create account" }} />
          <Stack.Screen name="(auth)/login" options={{ title: "Log in" }} />
          <Stack.Screen name="library" options={{ title: "Your trips" }} />
          <Stack.Screen name="itinerary/[id]" options={{ title: "Trip" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
