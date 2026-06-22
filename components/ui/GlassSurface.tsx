// Cross-platform Liquid Glass surface primitive.
// iOS: BlurView (UIBlurEffect) — native frosted glass, tint follows theme.
// Android: semi-transparent solid fallback (windowed blur is not reliable cross-device).
// shimmer renders a 1px inner-top highlight to suggest refractive edge lighting.

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
  /** Solid color to layer over the blur (or use as Android fallback). Defaults to themed glass base. */
  surfaceTint?: string;
  style?: StyleProp<ViewStyle>;
}

export function GlassSurface({
  children,
  intensity = 22,
  borderRadius = RADII.card,
  tint,
  shimmer = true,
  borderColor,
  surfaceTint,
  style,
}: GlassSurfaceProps) {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const effectiveTint: BlurTint = tint ?? resolvedTheme;
  const effectiveBorder = borderColor ?? colors.glass.border;
  // Android has no reliable BlurView fallback in Expo managed workflow
  // (windowIsTranslucent not set), so we render a near-opaque solid fill.
  // iOS uses surfaceTint as a translucent wash on top of native BlurView.
  const androidFallback = surfaceTint ?? (resolvedTheme === 'light' ? 'rgba(245,245,250,0.94)' : 'rgba(20,19,35,0.92)');
  const radiusStyle = { borderRadius };

  const shimmerNode = shimmer ? (
    <View
      pointerEvents="none"
      style={[styles.shimmer, { backgroundColor: colors.glass.highlight }]}
    />
  ) : null;

  let blurNode: ReactNode = null;
  if (Platform.OS === 'ios') {
    try {
      blurNode = (
        <BlurView
          intensity={intensity}
          tint={effectiveTint}
          style={StyleSheet.absoluteFill}
        />
      );
    } catch {
      blurNode = null;
    }
  }

  const overlayBg = Platform.OS === 'ios' ? surfaceTint : androidFallback;

  return (
    <View
      style={[
        styles.base,
        { borderColor: effectiveBorder },
        radiusStyle,
        style,
      ]}
    >
      {blurNode}
      {overlayBg ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: overlayBg }]} />
      ) : null}
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
