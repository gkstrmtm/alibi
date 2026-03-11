import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <View>
        <Text style={[styles.label, variant === 'primary' ? styles.labelPrimary : styles.labelSecondary]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: tokens.space[12],
    paddingHorizontal: tokens.space[16],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: '#D0D0D0',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: tokens.font.size[16],
    fontWeight: tokens.font.weight.semibold,
  },
  labelPrimary: {
    color: '#FFFFFF',
  },
  labelSecondary: {
    color: '#111111',
  },
});
