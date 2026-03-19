import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getLayoutMetrics } from '../theme/layout';
import { tokens } from '../theme/tokens';

type Props = {
  title: string;
  description?: string;
  subtitle?: string;
  right?: string;
  onPress: () => void;
};

export function ListRow({ title, description, subtitle, right, onPress }: Props) {
  const { width, height } = useWindowDimensions();
  const metrics = getLayoutMetrics(width, height);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { minHeight: metrics.standardCardMinHeight }, pressed ? styles.pressed : null]}
    >
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <View style={styles.rightBadge}>
          <Text style={styles.right}>{right}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: tokens.space[16],
    paddingHorizontal: tokens.space[16],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(25, 25, 25, 0.95)',
    borderRadius: tokens.radius[12], // Softer card
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  pressed: {
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
  },
  left: {
    flex: 1,
    gap: tokens.space[4],
  },
  title: {
    fontSize: tokens.font.size[16],
    fontWeight: '600',
    color: '#F4F4F4',
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 13,
    color: '#A3A3A3',
    lineHeight: 18,
  },
  subtitle: {
    fontSize: tokens.font.size[12],
    color: '#8A8A8A',
  },
  right: {
    fontSize: tokens.font.size[10],
    fontWeight: '700',
    color: tokens.color.brand,
    letterSpacing: 1.5,
  },
  rightBadge: {
    paddingVertical: tokens.space[4],
    paddingHorizontal: tokens.space[12],
    borderRadius: tokens.radius[12],
    backgroundColor: 'rgba(255, 56, 35, 0.15)',
    borderWidth: 0,
  },
});
