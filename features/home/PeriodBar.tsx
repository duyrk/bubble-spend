// Period tab selector — pill row inside a glass container with a spring-animated indicator.

import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import type { Period } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import { RADII, SPRING } from '@/constants/theme';

const PERIODS: { key: Period; tKey: TranslationKey }[] = [
  { key: 'today', tKey: 'today' },
  { key: 'yesterday', tKey: 'yesterday' },
  { key: 'week', tKey: 'thisWeek' },
  { key: 'month', tKey: 'thisMonth' },
];

interface PeriodBarProps {
  active: Period;
  onChange: (period: Period) => void;
}

export function PeriodBar({ active, onChange }: PeriodBarProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const [tabLayouts, setTabLayouts] = useState<Record<Period, { x: number; width: number }>>(
    {} as Record<Period, { x: number; width: number }>,
  );

  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);

  const activeLayout = tabLayouts[active];

  useEffect(() => {
    if (activeLayout) {
      indicatorX.value = withSpring(activeLayout.x, SPRING.responsive);
      indicatorW.value = withSpring(activeLayout.width, SPRING.responsive);
    }
  }, [activeLayout, indicatorX, indicatorW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  const handleLayout = useMemo(
    () => (key: Period) => (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      setTabLayouts((prev) =>
        prev[key]?.x === x && prev[key]?.width === width
          ? prev
          : { ...prev, [key]: { x, width } },
      );
    },
    [],
  );

  const iosGlassBg =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.55)' : 'rgba(17,17,28,0.55)';
  const glassBg = Platform.OS === 'android' ? colors.bg.elevated : iosGlassBg;

  return (
    <View style={styles.outer}>
      <View style={[styles.glass, { backgroundColor: glassBg, borderColor: colors.glass.border }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={28} tint={resolvedTheme} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.row}>
          <Animated.View
            style={[
              styles.indicator,
              indicatorStyle,
              { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
            ]}
          />
          {PERIODS.map((p) => {
            const isActive = active === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => onChange(p.key)}
                onLayout={handleLayout(p.key)}
                style={styles.tab}
                hitSlop={4}
              >
                <Text
                  style={[
                    styles.label,
                    { color: isActive ? colors.text.primary : colors.text.tertiary },
                  ]}
                >
                  {t(p.tKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  glass: {
    borderRadius: RADII.pill,
    overflow: 'hidden',
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    padding: 4,
    position: 'relative',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    zIndex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 0,
    bottom: 4,
    borderRadius: RADII.pill,
    borderWidth: 0.5,
  },
});
