import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens';

type Props = {
  message?: string | null;
  tone?: 'default' | 'danger' | 'success';
  onHide?: () => void;
};

export function Toast({ message, tone = 'default', onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (!message) return;

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -8, duration: 180, useNativeDriver: true }),
      ]).start(() => onHide?.());
    }, 2600);

    return () => clearTimeout(timeout);
  }, [message, onHide, opacity, translateY]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        onPress={onHide}
        style={[
          styles.toast,
          tone === 'danger' ? styles.toastDanger : null,
          tone === 'success' ? styles.toastSuccess : null,
        ]}
      >
        <Text style={styles.text}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 1000,
    alignItems: 'center',
  },
  toast: {
    maxWidth: 520,
    width: '100%',
    paddingHorizontal: tokens.space[16],
    paddingVertical: tokens.space[12],
    borderRadius: tokens.radius[16],
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  toastDanger: {
    borderColor: 'rgba(217, 92, 104, 0.35)',
    backgroundColor: '#251416',
  },
  toastSuccess: {
    borderColor: 'rgba(20, 184, 166, 0.32)',
    backgroundColor: '#102220',
  },
  text: {
    fontSize: tokens.font.size[12],
    color: '#F4F4F4',
    lineHeight: 18,
    textAlign: 'center',
  },
});
