import { ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

interface Props extends ScrollViewProps {
  padded?: boolean;
}

export function Screen({ children, padded = true, ...rest }: Props) {
  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        {...rest}
        contentContainerStyle={[padded ? styles.padded : undefined, rest.contentContainerStyle]}
      >
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg, paddingBottom: spacing.xxl },
  inner: { width: "100%", maxWidth: 640, alignSelf: "center", gap: spacing.lg },
});
