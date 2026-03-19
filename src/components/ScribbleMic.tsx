import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens';

function colorWithAlpha(color: string, alpha: number) {
  if (color.startsWith('#')) {
    const value = color.slice(1);
    const normalized = value.length === 3
      ? value.split('').map((part) => part + part).join('')
      : value;

    if (normalized.length === 6) {
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  return color;
}

interface ScribbleMicProps {
  size?: number;
  iconSize?: number;
  aggressive?: boolean;
  icon?: React.ReactNode;
  iconColor?: string;
  auraColor?: string;
  orbitalColor?: string;
  coreBackgroundColor?: string;
  coreBorderColor?: string;
  coreShadowColor?: string;
}

export function ScribbleMic({
  size = 132,
  iconSize = 42,
  aggressive = false,
  icon,
  iconColor,
  auraColor = tokens.color.brand,
  orbitalColor = tokens.color.text,
  coreBackgroundColor = '#171717',
  coreBorderColor = 'rgba(255, 90, 54, 0.56)',
  coreShadowColor = '#ff6b47',
}: ScribbleMicProps) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: aggressive ? 2400 : 2800,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: aggressive ? 2400 : 2800,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [aggressive, drift]);

  const layers = useMemo(
    () => ({
      auraFarInset: size * 0.17,
      auraNearInset: size * 0.045,
      coreInset: size * 0.28,
      scribbleOne: { top: size * 0.08, left: size * 0.08, width: size * 0.78, height: size * 0.72, rotate: '15deg', borderWidth: aggressive ? 1.8 : 1.55, color: colorWithAlpha(orbitalColor, aggressive ? 0.34 : 0.28) },
      scribbleTwo: { top: size * 0.13, left: size * 0.02, width: size * 0.86, height: size * 0.64, rotate: '-18deg', borderWidth: aggressive ? 1.55 : 1.35, color: colorWithAlpha(orbitalColor, aggressive ? 0.28 : 0.23) },
      scribbleThree: { top: size * 0.09, left: size * 0.13, width: size * 0.66, height: size * 0.83, rotate: '31deg', borderWidth: aggressive ? 1.4 : 1.2, color: colorWithAlpha(orbitalColor, aggressive ? 0.22 : 0.19) },
      scribbleFour: { top: size * 0.17, left: size * 0.19, width: size * 0.56, height: size * 0.52, rotate: '-39deg', borderWidth: aggressive ? 1.25 : 1.05, color: colorWithAlpha(orbitalColor, aggressive ? 0.18 : 0.16) },
    }),
    [aggressive, orbitalColor, size],
  );

  const driftOne = drift.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] });
  const driftTwo = drift.interpolate({ inputRange: [0, 1], outputRange: [3, -4] });
  const driftThree = drift.interpolate({ inputRange: [0, 1], outputRange: [-3, 5] });
  const driftFour = drift.interpolate({ inputRange: [0, 1], outputRange: [2, -2] });
  const skewOne = drift.interpolate({ inputRange: [0, 1], outputRange: [-2, 2] });
  const skewTwo = drift.interpolate({ inputRange: [0, 1], outputRange: [2, -2] });

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <View
        pointerEvents="none"
        style={[
          styles.aura,
          {
            top: -layers.auraFarInset,
            left: -layers.auraFarInset,
            right: -layers.auraFarInset,
            bottom: -layers.auraFarInset,
            borderRadius: size,
            opacity: aggressive ? 0.11 : 0.08,
            backgroundColor: auraColor,
            ...(Platform.OS === 'web'
              ? { filter: aggressive ? 'blur(42px)' : 'blur(34px)' }
              : { shadowColor: auraColor, shadowOpacity: aggressive ? 0.2 : 0.16, shadowRadius: aggressive ? 28 : 22 }) as any,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.aura,
          {
            top: -layers.auraNearInset,
            left: -layers.auraNearInset,
            right: -layers.auraNearInset,
            bottom: -layers.auraNearInset,
            borderRadius: size * 0.54,
            backgroundColor: 'rgba(255,255,255,0.03)',
            ...(Platform.OS === 'web' ? { filter: 'blur(18px)' } : {}) as any,
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.scribble,
          {
            top: layers.scribbleOne.top,
            left: layers.scribbleOne.left,
            width: layers.scribbleOne.width,
            height: layers.scribbleOne.height,
            borderRadius: layers.scribbleOne.height / 2,
            borderWidth: layers.scribbleOne.borderWidth,
            borderColor: layers.scribbleOne.color,
            transform: [{ translateY: driftOne }, { translateX: skewOne }, { rotate: layers.scribbleOne.rotate }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.scribble,
          {
            top: layers.scribbleTwo.top,
            left: layers.scribbleTwo.left,
            width: layers.scribbleTwo.width,
            height: layers.scribbleTwo.height,
            borderRadius: layers.scribbleTwo.height / 2,
            borderWidth: layers.scribbleTwo.borderWidth,
            borderColor: layers.scribbleTwo.color,
            transform: [{ translateY: driftTwo }, { translateX: skewTwo }, { rotate: layers.scribbleTwo.rotate }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.scribble,
          {
            top: layers.scribbleThree.top,
            left: layers.scribbleThree.left,
            width: layers.scribbleThree.width,
            height: layers.scribbleThree.height,
            borderRadius: layers.scribbleThree.height / 2,
            borderWidth: layers.scribbleThree.borderWidth,
            borderColor: layers.scribbleThree.color,
            transform: [{ translateY: driftThree }, { rotate: layers.scribbleThree.rotate }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.scribble,
          {
            top: layers.scribbleFour.top,
            left: layers.scribbleFour.left,
            width: layers.scribbleFour.width,
            height: layers.scribbleFour.height,
            borderRadius: layers.scribbleFour.height / 2,
            borderWidth: layers.scribbleFour.borderWidth,
            borderColor: layers.scribbleFour.color,
            transform: [{ translateY: driftFour }, { rotate: layers.scribbleFour.rotate }],
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.core,
          {
            top: layers.coreInset,
            left: layers.coreInset,
            right: layers.coreInset,
            bottom: layers.coreInset,
            borderRadius: size * 0.23,
            backgroundColor: coreBackgroundColor,
            borderColor: coreBorderColor,
            shadowColor: coreShadowColor,
            shadowOpacity: aggressive ? 0.32 : 0.26,
            shadowRadius: aggressive ? 18 : 14,
          },
        ]}
      />
      <View style={styles.iconWrap}>
        {icon ?? <Ionicons name="mic" size={iconSize} color={iconColor ?? (aggressive ? tokens.color.brand : 'rgba(255,255,255,0.94)')} style={styles.icon} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  aura: {
    position: 'absolute',
  },
  scribble: {
    position: 'absolute',
  },
  core: {
    position: 'absolute',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 4,
  },
  iconWrap: {
    zIndex: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    zIndex: 6,
  },
});
