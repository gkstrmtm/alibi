const fs = require("fs");
const code = `import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { tokens } from "../theme/tokens";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, onPress, variant = "primary", disabled, loading }: Props) {
  const isDisabled = Boolean(disabled || loading);

  const innerContent = (
    <View style={[styles.inner, variant === "primary" ? styles.innerPrimary : styles.innerSecondary]}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? tokens.color.surface : tokens.color.textMuted}
          style={styles.spinner}
        />
      ) : null}
      <Text style={[styles.label, variant === "primary" ? styles.labelPrimary : styles.labelSecondary]}>
        {label}
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed, hovered }: any) => [
        variant === "secondary" ? styles.base : null,
        variant === "secondary" ? styles.secondary : null,
        variant === "secondary" && hovered && !isDisabled ? styles.hoverSecondary : null,
        isDisabled ? styles.disabled : null,
        variant === "secondary" && pressed && !isDisabled ? styles.pressedSecondary : null,
        variant === "primary" ? styles.gradientWrap : null,
        variant === "primary" && pressed && !isDisabled ? styles.pressedPrimary : null,
        variant === "primary" && hovered && !isDisabled ? styles.hoverPrimary : null,
      ]}
    >
      {variant === "primary" ? (
        <LinearGradient
            colors={["#03a9f4", "#f441a5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBorder}
        >
          {innerContent}
        </LinearGradient>
      ) : (
        innerContent
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 2,
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  gradientWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    shadowColor: "#f441a5",
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  gradientBorder: {
    padding: 2,
    borderRadius: tokens.radius[12],
    width: "100%",
  },
  inner: {
    width: "100%",
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[8],
    paddingVertical: tokens.space[12],
    paddingHorizontal: tokens.space[16],
    borderRadius: 10,
  },
  innerPrimary: {
    backgroundColor: "#000",
  },
  innerSecondary: {
    backgroundColor: tokens.color.surface,
  },
  spinner: {
    marginTop: 1,
  },
  secondary: {
    backgroundColor: tokens.color.surface3,
    borderColor: tokens.color.border,
  },
  hoverPrimary: {
    transform: [{ translateY: -1 }],
    shadowOpacity: 0.3,
  },
  hoverSecondary: {
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.surface2,
    transform: [{ translateY: -1 }],
  },
  disabled: {
    opacity: 0.58,
  },
  pressedPrimary: {
    opacity: 0.85,
  },
  pressedSecondary: {
    backgroundColor: tokens.color.surface3,
    borderColor: tokens.color.accentRing,
  },
  label: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    letterSpacing: 0.3,
  },
  labelPrimary: {
    color: "#fff",
  },
  labelSecondary: {
    color: tokens.color.text,
  },
});`;
fs.writeFileSync("src/components/Button.tsx", code);
