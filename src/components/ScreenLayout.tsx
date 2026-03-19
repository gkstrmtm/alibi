import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLayoutMetrics } from '../theme/layout';
import { tokens } from '../theme/tokens';

export function ScreenLayout({
  title,
  topRight,
  children,
  stickyBottom,
  headerShown = true,
  contentPaddingHorizontal,
  contentPaddingTop,
}: {
  title: string;
  topRight?: React.ReactNode;
  children: React.ReactNode;
  stickyBottom?: React.ReactNode;
  headerShown?: boolean;
  contentPaddingHorizontal?: number;
  contentPaddingTop?: number;
}) {
  const navigation = useNavigation<any>();
  const canGoBack = Boolean(navigation?.canGoBack?.());
  const { width, height } = useWindowDimensions();
  const metrics = getLayoutMetrics(width, height);

  const contentOverrides: ViewStyle = {
    ...(contentPaddingHorizontal !== undefined ? { paddingHorizontal: contentPaddingHorizontal } : null),
    ...(contentPaddingTop !== undefined ? { paddingTop: contentPaddingTop } : null),
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      {headerShown ? (
        <View
          style={[
            styles.header,
            {
              minHeight: metrics.headerMinHeight,
              paddingTop: metrics.headerTopGap,
              paddingHorizontal: metrics.horizontalFrame,
            },
          ]}
        >
          <View style={styles.sideLeft}>
            {canGoBack ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.goBack()}
                hitSlop={12}
                style={({ pressed }) => [styles.iconButton, pressed ? styles.iconButtonPressed : null]}
              >
                <Ionicons name="chevron-back" size={18} color={tokens.color.text} />
              </Pressable>
            ) : (
              <View style={styles.sidePlaceholder} />
            )}
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <View style={styles.sideRight}>{topRight ? topRight : <View style={styles.sidePlaceholder} />}</View>
        </View>
      ) : null}

      <View
        style={[
          styles.content,
          {
            paddingHorizontal: metrics.horizontalFrame,
            paddingTop: metrics.stackGap,
          },
          contentPaddingHorizontal !== undefined || contentPaddingTop !== undefined ? contentOverrides : null,
          stickyBottom ? { paddingBottom: metrics.stickyBottomSpace } : null,
        ]}
      >
        {children}
      </View>
      {stickyBottom ? <View style={[styles.sticky, { paddingHorizontal: metrics.horizontalFrame }]}>{stickyBottom}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  header: {
    paddingBottom: tokens.space[8],
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: tokens.color.bg,
  },
  sideLeft: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  sideRight: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  sidePlaceholder: {
    width: 32,
    height: 32,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  iconButtonPressed: {
    backgroundColor: tokens.color.surface2,
  },
  title: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: tokens.color.text,
    textAlign: 'left',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingLeft: tokens.space[12],
    paddingRight: tokens.space[12],
    paddingBottom: 4,
  },
  content: {
    flex: 1,
  },
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: tokens.space[16],
    paddingBottom: tokens.space[24],
    backgroundColor: tokens.color.bg,
  },
});
