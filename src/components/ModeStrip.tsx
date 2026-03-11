import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StudioMode } from '../store/types';
import { tokens } from '../theme/tokens';

const labels: Record<StudioMode, string> = {
  interview: 'Interview',
  build: 'Build',
  outline: 'Outline',
  draft: 'Draft',
};

export function ModeStrip({ value, onChange }: { value: StudioMode; onChange: (m: StudioMode) => void }) {
  const modes: StudioMode[] = ['interview', 'build', 'outline', 'draft'];
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
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  itemInactive: {
    backgroundColor: 'transparent',
    borderColor: '#E6E6E6',
  },
  label: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
  },
  labelActive: {
    color: '#FFFFFF',
  },
  labelInactive: {
    color: '#111111',
  },
});
