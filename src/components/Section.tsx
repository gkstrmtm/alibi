import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.space[8],
  },
  title: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  body: {
    gap: tokens.space[8],
  },
});
