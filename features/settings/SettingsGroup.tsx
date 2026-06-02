// Section container — Liquid Glass card wrapping its rows.

import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { RADII } from '@/constants/theme';

interface SettingsGroupProps {
  title?: string;
  children: ReactNode;
}

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();

  const iosBg = resolvedTheme === 'light' ? 'rgba(255,255,255,0.55)' : 'rgba(17,17,28,0.5)';
  const cardBg = Platform.OS === 'android' ? colors.bg.elevated : iosBg;

  return (
    <View style={styles.group}>
      {title ? (
        <Text style={[styles.title, { color: colors.text.tertiary }]}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.glass.border }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} tint={resolvedTheme} style={StyleSheet.absoluteFill} />
        ) : null}
        <View
          style={[styles.shimmer, { backgroundColor: colors.glass.highlight }]}
          pointerEvents="none"
        />
        <View style={styles.inner}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 22,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: RADII.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
  },
  inner: {
    paddingHorizontal: 4,
  },
});
