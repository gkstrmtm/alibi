import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens';

export function ScreenLayout({
  title,
  topRight,
  children,
  stickyBottom,
}: {
  title: string;
  topRight?: React.ReactNode;
  children: React.ReactNode;
  stickyBottom?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.topRight}>{topRight}</View>
      </View>
      <View style={[styles.content, stickyBottom ? styles.contentWithSticky : null]}>{children}</View>
      {stickyBottom ? <View style={styles.sticky}>{stickyBottom}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: tokens.space[16],
    paddingTop: tokens.space[12],
    paddingBottom: tokens.space[12],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: tokens.font.size[20],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  topRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
    paddingHorizontal: tokens.space[16],
    paddingTop: tokens.space[16],
  },
  contentWithSticky: {
    paddingBottom: 96,
  },
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: tokens.space[16],
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
});
