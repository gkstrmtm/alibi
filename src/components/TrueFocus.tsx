import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { tokens } from '../theme/tokens';

interface TrueFocusProps {
  sentence?: string;
  separator?: string;
  manualMode?: boolean;
  blurAmount?: number;
  borderColor?: string;
  glowColor?: string;
  animationDuration?: number;
  pauseBetweenAnimations?: number;
  maxItems?: number;
}

export function TrueFocus({
  sentence = 'True Focus',
  separator = ' ',
  manualMode = false,
  blurAmount = 4,
  borderColor = tokens.color.brand,
  glowColor = tokens.color.brandSoft,
  animationDuration = 500,
  pauseBetweenAnimations = 1500,
  maxItems = 5,
}: TrueFocusProps) {
  const words = sentence
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Focus box position animation
  const animX = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(0)).current;
  const animW = useRef(new Animated.Value(0)).current;
  const animH = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(0)).current;

  const [layouts, setLayouts] = useState<Record<number, { x: number; y: number; w: number; h: number }>>({});

  useEffect(() => {
    if (currentIndex >= words.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, words.length]);

  useEffect(() => {
    if (!manualMode && Object.keys(layouts).length === words.length) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % words.length);
      }, animationDuration + pauseBetweenAnimations);
      return () => clearInterval(interval);
    }
  }, [manualMode, animationDuration, pauseBetweenAnimations, words.length, layouts]);

  useEffect(() => {
    const layout = layouts[currentIndex];
    if (layout) {
      const insetX = 2;
      const insetY = 2;
      Animated.parallel([
        Animated.spring(animX, { toValue: layout.x - insetX, useNativeDriver: false, tension: 80, friction: 12 }),
        Animated.spring(animY, { toValue: layout.y - insetY, useNativeDriver: false, tension: 80, friction: 12 }),
        Animated.spring(animW, { toValue: layout.w + insetX * 2, useNativeDriver: false, tension: 80, friction: 12 }),
        Animated.spring(animH, { toValue: layout.h + insetY * 2, useNativeDriver: false, tension: 80, friction: 12 }),
        Animated.timing(animOpacity, { toValue: 1, duration: 200, useNativeDriver: false })
      ]).start();
    }
  }, [currentIndex, layouts]);

  return (
    <View 
      style={styles.container} 
      onLayout={() => {}}
    >
      <View style={styles.wordWrap}>
        {words.map((word, index) => {
          const isActive = index === currentIndex;
          const filterStyle = Platform.OS === 'web' ? {
            filter: isActive ? 'blur(0px)' : `blur(${blurAmount}px)`,
            transition: `filter ${animationDuration / 1000}s ease, color ${animationDuration / 1000}s ease`,
          } : {};

          return (
            <Text
              key={index}
              onLayout={(e) => {
                const { x, y, width, height } = e.nativeEvent.layout;
                setLayouts((prev) => ({ ...prev, [index]: { x, y, w: width, h: height } }));
              }}
              style={[
                styles.word,
                filterStyle as any,
                {
                  color: isActive ? tokens.color.text : tokens.color.textMuted,
                  opacity: Platform.OS !== 'web' ? (isActive ? 1 : 0.4) : 1
                }
              ]}
            >
              {word}
            </Text>
          );
        })}
      </View>

      <Animated.View
        style={[
          styles.focusFrame,
          {
            borderColor,
            transform: [
               { translateX: animX },
               { translateY: animY }
            ],
            width: animW,
            height: animH,
            opacity: animOpacity,
            ...(Platform.OS === 'web' ? {
               boxShadow: `0 0 10px ${glowColor}, inset 0 0 10px ${glowColor}`
            } : {})
          } as any
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    paddingVertical: 16,
    alignItems: 'center'
  },
  wordWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 8,
    rowGap: 6,
  },
  word: {
    fontSize: tokens.font.size[24],
    fontWeight: tokens.font.weight.bold,
    lineHeight: 34,
    marginRight: 0,
    marginBottom: 0,
    paddingHorizontal: 2,
  },
  focusFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 1.5,
    borderRadius: tokens.radius[8],
    pointerEvents: 'none',
  }
});
