import React from 'react';
import { Text, Platform, TextStyle, StyleProp } from 'react-native';

interface GradientTextProps {
  text: string;
  colors?: string[];
  style?: StyleProp<TextStyle>;
}

export function GradientText({
  text,
  colors = ['#FF3823', '#FF7F50'],
  style,
}: GradientTextProps) {
  if (Platform.OS === 'web') {
    return (
      <Text
        style={[
          style,
          {
            backgroundImage: `linear-gradient(to right, ${colors.join(', ')})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'inline-block',
          } as any,
        ]}
      >
        {text}
      </Text>
    );
  }

  // Fallback for native without masked view
  return (
    <Text style={[style, { color: colors[0] }]}>
      {text}
    </Text>
  );
}
