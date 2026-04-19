import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radius, spacing, type } from "../theme";

interface Props extends Omit<PressableProps, "children"> {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}

export function Button({ label, variant = "primary", loading, disabled, style, ...rest }: Props) {
  const v = styles[variant];
  const textStyle = variant === "primary" || variant === "danger" ? styles.textOnDark : styles.textOnLight;
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={(state) => [
        styles.base,
        v,
        (disabled || loading) && styles.disabled,
        state.pressed && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#fff" : colors.ink} />
      ) : (
        <Text style={[styles.label, textStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primary: { backgroundColor: colors.ink },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { ...type.body, fontWeight: "600" },
  textOnDark: { color: "#fff" },
  textOnLight: { color: colors.ink },
});
