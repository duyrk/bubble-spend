// Single bubble — Liquid Glass surface, gyro-aware, gesture-driven.
// Gestures and store logic preserved; visual layer adapts to dark/light theme.

import { memo, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import type { CategoryWithSize } from '@/types';
import { GESTURE } from '@/constants/config';
import { useUIStore } from '@/stores/useUIStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useBubblePhysics } from './useBubblePhysics';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useBubbleColors, useColors, useResolvedTheme } from '@/hooks/useTheme';
import { BLUR, SPRING } from '@/constants/theme';

interface BubbleItemProps {
  category: CategoryWithSize;
  dragMode: boolean;
  index: number;
}

function BubbleItemImpl({ category, dragMode, index }: BubbleItemProps) {
  const { animatedSize } = useBubblePhysics(category.size);
  const bubbleColors = useBubbleColors();
  const palette = bubbleColors[category.colorKey];
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();
  const { compact } = useFormatCurrency();

  const openModal = useUIStore((s) => s.openModal);
  const enterDragMode = useUIStore((s) => s.enterDragMode);
  const updatePosition = useCategoryStore((s) => s.updatePosition);

  const floatY = useSharedValue(0);
  const wobbleRotate = useSharedValue(0);
  const wobbleScale = useSharedValue(1);
  const pressScale = useSharedValue(1);
  const entryScale = useSharedValue(0);
  const entryOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  const floatDuration = 2800 + ((category.positionX * 30) % 800);
  const floatAmplitude = 4 + ((category.positionY * 0.03) % 3);

  useEffect(() => {
    const delay = index * 80;
    entryOpacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    entryScale.value = withDelay(delay, withSpring(1, SPRING.responsive));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-floatAmplitude, {
          duration: floatDuration / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(floatAmplitude, {
          duration: floatDuration / 2,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(floatY);
  }, [floatY, floatAmplitude, floatDuration]);

  useEffect(() => {
    if (dragMode) {
      wobbleRotate.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 190, easing: Easing.inOut(Easing.sin) }),
          withTiming(4, { duration: 190, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      wobbleScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 220, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.97, { duration: 220, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(wobbleRotate);
      cancelAnimation(wobbleScale);
      wobbleRotate.value = withSpring(0, SPRING.micro);
      wobbleScale.value = withSpring(1, SPRING.micro);
      translateX.value = 0;
      translateY.value = 0;
    }
  }, [dragMode, wobbleRotate, wobbleScale, translateX, translateY]);

  const prevTotal = useRef(category.total);
  useEffect(() => {
    if (category.total > prevTotal.current) {
      glowOpacity.value = withSequence(
        withTiming(0.6, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) }),
      );
    }
    prevTotal.current = category.total;
  }, [category.total, glowOpacity]);

  const tap = Gesture.Tap()
    .maxDuration(GESTURE.TAP_MAX_DURATION)
    .enabled(!dragMode)
    .onBegin(() => {
      pressScale.value = withSpring(0.94, SPRING.micro);
    })
    .onFinalize(() => {
      pressScale.value = withSpring(1, SPRING.micro);
    })
    .onEnd(() => {
      runOnJS(openModal)(category.id);
    });

  const longPress = Gesture.LongPress()
    .minDuration(GESTURE.DRAG_ACTIVATION_DELAY)
    .enabled(!dragMode)
    .onStart(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(enterDragMode)();
    });

  const pan = Gesture.Pan()
    .enabled(dragMode)
    .onStart(() => {
      dragStartX.value = translateX.value;
      dragStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = dragStartX.value + e.translationX;
      translateY.value = dragStartY.value + e.translationY;
    })
    .onEnd(() => {
      const newX = Math.max(5, Math.min(95, category.positionX + translateX.value / 3.6));
      const newY = Math.max(5, Math.min(95, category.positionY + translateY.value / 5));
      runOnJS(updatePosition)(category.id, newX, newY);
      translateX.value = 0;
      translateY.value = 0;
    });

  const gesture = Gesture.Race(pan, Gesture.Exclusive(longPress, tap));

  const wrapperStyle = useAnimatedStyle(() => {
    const size = animatedSize.value;
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      marginLeft: -size / 2,
      marginTop: -size / 2,
      opacity: entryOpacity.value,
      transform: [
        { translateX: translateX.value },
        { translateY: floatY.value + translateY.value },
        { rotate: `${wobbleRotate.value}deg` },
        { scale: entryScale.value * pressScale.value * wobbleScale.value },
      ],
    };
  });

  const glowRingStyle = useAnimatedStyle(() => {
    const size = animatedSize.value;
    const ringSize = size + 28;
    return {
      width: ringSize,
      height: ringSize,
      borderRadius: ringSize / 2,
      marginLeft: -ringSize / 2,
      marginTop: -ringSize / 2,
      opacity: glowOpacity.value,
    };
  });

  const bubbleSurfaceStyle = useAnimatedStyle(() => {
    const size = animatedSize.value;
    return { borderRadius: size / 2 };
  });

  const amountStr = compact(category.total);

  // Theme-aware text and shimmer colors
  const shimmerColor =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
  const nameColor =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.78)' : 'rgba(255,255,255,0.78)';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.positionWrapper,
          { left: `${category.positionX}%`, top: `${category.positionY}%` },
        ]}
      >
        {/* Outer glow ring — pulses on transaction confirm */}
        <Animated.View
          pointerEvents="none"
          style={[styles.glowRing, glowRingStyle, { backgroundColor: palette.glow }]}
        />
        {/* The bubble itself */}
        <Animated.View
          style={[
            styles.bubble,
            wrapperStyle,
            bubbleSurfaceStyle,
            {
              shadowColor: palette.glow,
              borderColor: palette.border,
              backgroundColor: Platform.OS === 'android' ? palette.bg : 'transparent',
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <Animated.View
              style={[StyleSheet.absoluteFill, bubbleSurfaceStyle, { overflow: 'hidden' }]}
            >
              <BlurView intensity={BLUR.bubble} tint={resolvedTheme} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} />
            </Animated.View>
          ) : null}

          <View pointerEvents="none" style={[styles.shimmer, { backgroundColor: shimmerColor }]} />

          <Text style={styles.emoji}>{category.emoji}</Text>
          <Text style={[styles.name, { color: nameColor }]}>{category.name}</Text>
          <Text
            style={[
              amountStr ? styles.amount : styles.amountEmpty,
              { color: amountStr ? colors.text.primary : colors.text.tertiary },
            ]}
          >
            {amountStr ?? t('tap')}
          </Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export const BubbleItem = memo(BubbleItemImpl);

const styles = StyleSheet.create({
  positionWrapper: {
    position: 'absolute',
  },
  glowRing: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
  },
  bubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: '12%',
    right: '12%',
    height: 1,
  },
  emoji: {
    fontSize: 24,
    lineHeight: 28,
  },
  name: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
    lineHeight: 12,
    letterSpacing: 0.2,
  },
  amount: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  amountEmpty: {
    fontSize: 9,
    marginTop: 1,
    letterSpacing: 0.4,
  },
});
