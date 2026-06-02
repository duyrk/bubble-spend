// Period tab selector — Liquid Glass pill with a spring-animated white-translucent indicator.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import type { Period } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import { SPRING } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';

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

  const activeFill = resolvedTheme === 'light' ? 'rgba(13,13,20,0.10)' : 'rgba(255,255,255,0.14)';
  const activeText = resolvedTheme === 'light' ? 'rgba(13,13,20,0.92)' : '#fff';
  const inactiveText = resolvedTheme === 'light' ? 'rgba(13,13,20,0.40)' : 'rgba(255,255,255,0.35)';

  return (
    <View style={styles.outer}>
      <GlassSurface borderRadius={14} intensity={28} shimmer>
        <View style={styles.row}>
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, indicatorStyle, { backgroundColor: activeFill }]}
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
                    {
                      color: isActive ? activeText : inactiveText,
                      fontWeight: isActive ? '700' : '600',
                    },
                  ]}
                >
                  {t(p.tKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
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
    letterSpacing: 0.2,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 0,
    bottom: 4,
    borderRadius: 10,
  },
});
