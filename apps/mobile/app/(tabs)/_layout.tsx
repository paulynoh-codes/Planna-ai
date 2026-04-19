import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { colors, spacing, type } from "../../src/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.icon}>
      <Text style={[styles.iconText, focused && styles.iconTextFocused]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          paddingTop: 6,
          height: 64,
        },
        tabBarLabelStyle: { ...type.caption, letterSpacing: 1 },
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon label="◆" focused={focused} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ focused }) => <TabIcon label="▲" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ focused }) => <TabIcon label="◉" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon label="●" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: "center", justifyContent: "center", paddingTop: 2 },
  iconText: { fontSize: 14, color: colors.inkMuted },
  iconTextFocused: { color: colors.ink },
});
