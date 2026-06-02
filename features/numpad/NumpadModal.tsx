// Liquid Glass bottom-sheet numpad — slide-up, GlassSurface body, blurred backdrop.
// Gesture/store logic preserved; visual layer adapts to dark/light theme.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useTranslation } from '@/hooks/useTranslation';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/useUIStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { BLUR, RADII, SPRING, TIMING } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';

const MODAL_HEIGHT = 480;

interface NumpadModalProps {
  onTransactionConfirmed?: (categoryId: string, x: number, y: number) => void;
}

const KEYS: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'];

export function NumpadModal({ onTransactionConfirmed }: NumpadModalProps) {
  const { t } = useTranslation();
  const { meta } = useFormatCurrency();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();

  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const categories = useCategoryStore((s) => s.categories);
  const add = useTransactionStore((s) => s.add);

  const [amount, setAmount] = useState('0');
  const isOpen = activeModal !== null;
  const category = categories.find((c) => c.id === activeModal);

  const prevActiveModal = useRef<string | null>(null);
  useEffect(() => {
    if (activeModal !== prevActiveModal.current) {
      prevActiveModal.current = activeModal;
      if (activeModal !== null) setAmount('0');
    }
  }, [activeModal]);

  const amountSlide = useSharedValue(0);
  useEffect(() => {
    amountSlide.value = -4;
    amountSlide.value = withTiming(0, { duration: 80 });
  }, [amount, amountSlide]);

  const handleKey = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount((prev) => {
      if (prev === '0') return key === '000' ? '0' : key;
      const next = prev + key;
      return next.length > 12 ? next.slice(0, 12) : next;
    });
  }, []);

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  }, []);

  const handleConfirm = useCallback(() => {
    const value = parseInt(amount, 10) || 0;
    if (value > 0 && activeModal) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      add(activeModal, value);
      if (category && onTransactionConfirmed) {
        onTransactionConfirmed(activeModal, category.positionX, category.positionY);
      }
    }
    closeModal();
  }, [amount, activeModal, add, closeModal, category, onTransactionConfirmed]);

  const handleCancel = useCallback(() => {
    closeModal();
  }, [closeModal]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isOpen ? 1 : 0, { duration: TIMING.normal }),
    pointerEvents: isOpen ? ('auto' as const) : ('none' as const),
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: withSpring(isOpen ? 0 : MODAL_HEIGHT + 60, SPRING.sheet) },
    ],
  }));

  const amountStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: amountSlide.value }],
  }));

  const displayValue = parseInt(amount, 10);
  const displayAmount = displayValue.toLocaleString();
  const isZero = displayValue === 0;

  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.72)' : 'rgba(17,17,28,0.72)';
  const confirmRim =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)';

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />
      </Animated.View>

      <Animated.View style={[styles.modalWrapper, modalStyle]}>
        <GlassSurface
          intensity={BLUR.sheet}
          borderRadius={RADII.sheet}
          surfaceTint={sheetTint}
          shimmer
          style={styles.sheetGlass}
        >
          <View style={styles.modalSurface}>
            <View style={[styles.handle, { backgroundColor: colors.glass.borderStrong }]} />

            <Text style={[styles.categoryLabel, { color: colors.text.secondary }]}>
              {category ? `${category.emoji}  ${category.name}` : ''}
            </Text>

            <Animated.View style={[styles.displayRow, amountStyle]}>
              {meta.symbolBefore ? (
                <Text style={[styles.currency, { color: colors.text.tertiary }]}>
                  {meta.symbol}{' '}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.displayAmount,
                  { color: isZero ? colors.text.tertiary : colors.text.primary },
                ]}
              >
                {displayAmount}
              </Text>
              {!meta.symbolBefore ? (
                <Text style={[styles.currency, { color: colors.text.tertiary }]}>
                  {' '}
                  {meta.symbol}
                </Text>
              ) : null}
            </Animated.View>

            <View style={styles.numpad}>
              {KEYS.map((key) => (
                <NumpadKey key={key} label={key} onPress={() => handleKey(key)} />
              ))}
              <NumpadKey label="⌫" onPress={handleDelete} secondary />
            </View>

            <Pressable
              disabled={isZero}
              onPress={() => {
                if (!isZero) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleConfirm();
              }}
              style={({ pressed }) => [
                styles.confirmBtn,
                {
                  backgroundColor: colors.accent,
                  borderTopColor: confirmRim,
                  opacity: isZero ? 0.35 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.confirmText}>{t('doneCheck')}</Text>
            </Pressable>

            <Pressable onPress={handleCancel} style={styles.cancelBtn} hitSlop={6}>
              <Text style={[styles.cancelText, { color: colors.text.tertiary }]}>
                {t('cancel')}
              </Text>
            </Pressable>
          </View>
        </GlassSurface>
      </Animated.View>
    </>
  );
}

function NumpadKey({
  label,
  onPress,
  secondary,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressedColor =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.10)' : 'rgba(255,255,255,0.18)';
  const baseColor =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.04)' : 'rgba(255,255,255,0.08)';
  const keyBorder =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.08)' : 'rgba(255,255,255,0.10)';

  return (
    <Animated.View style={[styles.keyWrapper, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.92, SPRING.micro);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, SPRING.micro);
        }}
        style={({ pressed }) => [
          styles.key,
          { borderColor: keyBorder },
          { backgroundColor: pressed ? pressedColor : baseColor },
        ]}
      >
        <Text
          style={[
            styles.keyText,
            secondary && styles.keyTextSecondary,
            { color: secondary ? colors.text.secondary : colors.text.primary },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  modalWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 11,
  },
  sheetGlass: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  modalSurface: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  categoryLabel: {
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 18,
    minHeight: 56,
  },
  currency: {
    fontSize: 22,
    fontWeight: '300',
  },
  displayAmount: {
    fontSize: 52,
    fontWeight: '200',
    letterSpacing: -1.5,
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keyWrapper: {
    width: '31.5%',
  },
  key: {
    borderRadius: RADII.button,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 0.5,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '500',
  },
  keyTextSecondary: {
    fontSize: 18,
  },
  confirmBtn: {
    width: '100%',
    borderRadius: RADII.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    alignItems: 'center',
    marginTop: 10,
    padding: 4,
  },
  cancelText: {
    fontSize: 13,
  },
});
