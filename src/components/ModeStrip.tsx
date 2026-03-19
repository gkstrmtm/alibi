import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StudioMode } from '../store/types';
import { tokens } from '../theme/tokens';

const labels: Record<StudioMode, string> = {
  interview: 'Intake',
  outline: 'Outline',
  draft: 'Draft',
};

export function ModeStrip({ value, onChange }: { value: StudioMode; onChange: (m: StudioMode) => void }) {
  const modes: StudioMode[] = ['interview', 'outline', 'draft'];
  return (
    <View style={styles.container}>
      {modes.map((m) => {
        const active = m === value;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={[styles.item, active ? styles.itemActive : styles.itemInactive]}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>{labels[m]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ModeStripControlled({
  value,
  onChange,
  modes,
}: {
  value: StudioMode;
  onChange: (m: StudioMode) => void;
  modes: StudioMode[];
}) {
  return (
    <View style={styles.container}>
      {modes.map((m) => {
        const active = m === value;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={[styles.item, active ? styles.itemActive : styles.itemInactive]}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>{labels[m]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: tokens.space[8],
  },
  item: {
    flex: 1,
    paddingVertical: tokens.space[8],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: {
    backgroundColor: tokens.color.accentSoft,
    borderColor: tokens.color.accentRing,
  },
  itemInactive: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.borderSubtle,
  },
  label: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
  },
  labelActive: {
    color: tokens.color.text,
  },
  labelInactive: {
    color: tokens.color.textMuted,
  },
});
