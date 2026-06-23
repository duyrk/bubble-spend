// Brief "Logged — Undo" toast shown on Home right after a transaction confirms.
// Auto-dismisses after a few seconds; tapping Undo removes the just-logged tx.
// Driven by an `id` (the undoable transaction's id): a new id re-arms the toast,
// null hides it.

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { BLUR, RADII, SPRING, TIMING } from '@/constants/theme';

const VISIBLE_MS = 4000;

interface UndoToastProps {
  // Stable id of the undoable transaction. A new value re-arms the toast;
  // null hides it.
  id: string | null;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ id, onUndo, onDismiss }: UndoToastProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();

  const visible = id !== null;
  const translateY = useSharedValue(120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : 120, SPRING.sheet);
    opacity.value = withTiming(visible ? 1 : 0, { duration: TIMING.fast });
  }, [visible, translateY, opacity]);

  // Auto-dismiss timer — re-armed whenever a new transaction is logged (id change).
  // onDismiss must be stable so this doesn't reset on unrelated re-renders.
  useEffect(() => {
    if (id === null) return;
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const handleUndo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUndo();
  };

  const surfaceTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.55)' : 'rgba(17,17,28,0.55)';

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.host, { bottom: insets.bottom + 92 }, animStyle]}
    >
      <GlassSurface
        intensity={BLUR.tabBar}
        borderRadius={RADII.pill}
        surfaceTint={surfaceTint}
        shimmer={false}
        style={styles.pill}
      >
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>
            {t('logged')}
          </Text>
          <Pressable onPress={handleUndo} hitSlop={10} style={styles.undoBtn}>
            <Text style={[styles.undoText, { color: colors.accent }]}>
              {t('undo')}
            </Text>
          </Pressable>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  pill: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  undoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADII.pill,
  },
  undoText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
