import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getLayoutMetrics } from '../theme/layout';
import { tokens } from '../theme/tokens';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const metrics = getLayoutMetrics(width, height);

  return (
    <View style={[styles.container, { gap: metrics.tightGap + 4 }] }>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.body, { gap: metrics.stackGap * 0.75 }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.space[8],
  },
  title: {
    fontSize: 10,
    fontWeight: tokens.font.weight.bold,
    color: '#000000', // Hard black for editorial contrast
    letterSpacing: 2, // Extra wide tracking for tiny caps
  },
  body: {},
});
