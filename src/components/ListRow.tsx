import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  right?: string;
  onPress: () => void;
};

export function ListRow({ title, subtitle, right, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <Text style={styles.right}>{right}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: tokens.space[12],
    paddingHorizontal: tokens.space[16],
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  pressed: {
    opacity: 0.85,
  },
  left: {
    flex: 1,
    gap: tokens.space[4],
  },
  title: {
    fontSize: tokens.font.size[16],
    fontWeight: tokens.font.weight.medium,
    color: '#111111',
  },
  subtitle: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  right: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
});
