// Cross-platform Liquid Glass surface primitive.
// iOS: BlurView (UIBlurEffect) — native frosted glass, tint follows theme.
// Android: semi-transparent View fallback.
// shimmer adds a 1px top-edge highlight that simulates refraction.

import type { ReactNode } from 'react';
import { BlurView, type BlurTint } from 'expo-blur';
import { Platform, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { RADII } from '@/constants/theme';

interface GlassSurfaceProps {
  children?: ReactNode;
  intensity?: number;
  borderRadius?: number;
  tint?: BlurTint;
  shimmer?: boolean;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function GlassSurface({
  children,
  intensity = 24,
  borderRadius = RADII.card,
  tint,
  shimmer = false,
  borderColor,
  style,
}: GlassSurfaceProps) {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const effectiveTint: BlurTint = tint ?? resolvedTheme;
  const effectiveBorder = borderColor ?? colors.glass.border;
  const radiusStyle = { borderRadius };

  const shimmerNode = shimmer ? (
    <View
      pointerEvents="none"
      style={[styles.shimmer, radiusStyle, { backgroundColor: colors.glass.highlight }]}
    />
  ) : null;

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint={effectiveTint}
        style={[styles.base, { borderColor: effectiveBorder }, radiusStyle, style]}
      >
        {shimmerNode}
        {children}
      </BlurView>
    );
  }

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.glass.base, borderColor: effectiveBorder },
        radiusStyle,
        style,
      ]}
    >
      {shimmerNode}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 1,
  },
});
