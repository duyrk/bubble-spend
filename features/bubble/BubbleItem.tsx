// Single bubble — multi-layer Liquid Glass sphere, gyro-aware specular tracking.
// Gestures/store logic preserved; the visual stack inside the bubble is new.
//
// Layer stack (back → front):
//   0  outer drop shadow      — wrapper shadow (unclipped)
//   1  rim gradient ring      — diagonal white gradient, sits behind everything else
//   2  inner core (inset 1.5) — clipped to circle; holds blur + tint + specular
//        a  BlurView           (iOS frosted glass)
//        b  glassFill wash     (also the Android fallback fill)
//        c  bottom color bloom (the bubble's identity hue)
//        d  top specular arc   (gyro-tracked lens flare)
//        e  inner-top sheen    (1px refractive edge highlight)
//   3  content                — emoji, name, amount (sits above everything)

import { memo, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
  type SharedValue,
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
  tiltX?: SharedValue<number>;
  tiltY?: SharedValue<number>;
}

// Border thickness of the rim gradient ring (px)
const RIM_WIDTH = 1.5;

// How far the specular highlight shifts opposite to gyro tilt at max drift (px)
const SPECULAR_PARALLAX = 2.5;

function BubbleItemImpl({ category, dragMode, index, tiltX, tiltY }: BubbleItemProps) {
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

  // Outer wrapper — drop shadow + animated size + transforms
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

  // Rim gradient layer — sits behind the inner core; visible only on the inset ring
  const rimRadiusStyle = useAnimatedStyle(() => ({
    borderRadius: animatedSize.value / 2,
  }));

  // Inner core — inset by RIM_WIDTH so the rim gradient bleeds through as a ring
  const innerCoreStyle = useAnimatedStyle(() => {
    const size = animatedSize.value;
    return {
      borderRadius: (size - RIM_WIDTH * 2) / 2,
    };
  });

  // Specular highlight shifts opposite to gyro tilt — simulates a fixed overhead
  // light source as the device tilts. (-tilt / max-drift) × parallax = px offset.
  const specularStyle = useAnimatedStyle(() => {
    const tx = tiltX ? -tiltX.value * (SPECULAR_PARALLAX / 8) : 0;
    const ty = tiltY ? -tiltY.value * (SPECULAR_PARALLAX / 8) : 0;
    return {
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: '-18deg' }],
    };
  });

  const amountStr = compact(category.total);

  const nameColor =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.78)' : 'rgba(255,255,255,0.78)';
  const innerTopSheen =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.20)';
  // Android has no BlurView fallback — give the inner core a stronger base wash
  // so the bubble has visual mass against the dark background.
  const androidFallback =
    resolvedTheme === 'light' ? 'rgba(245,245,250,0.55)' : 'rgba(28,28,42,0.55)';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.positionWrapper,
          { left: `${category.positionX}%`, top: `${category.positionY}%` },
        ]}
      >
        {/* Layer 0a — pulsing outer glow on transaction confirm */}
        <Animated.View
          pointerEvents="none"
          style={[styles.glowRing, glowRingStyle, { backgroundColor: palette.glow }]}
        />

        {/* Bubble wrapper — owns drop shadow + transforms */}
        <Animated.View
          style={[
            styles.bubble,
            wrapperStyle,
            { shadowColor: palette.glow },
          ]}
        >
          {/* Layer 1 — rim gradient ring (diagonal white sheen). The inner core
              sits inset by RIM_WIDTH, so this only shows on the perimeter. */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.clip, rimRadiusStyle]}
          >
            <LinearGradient
              colors={[palette.rimLight, 'rgba(255,255,255,0.04)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Layer 2 — inner core: blur + tint + specular, clipped & inset */}
          <Animated.View
            pointerEvents="none"
            style={[styles.innerCore, styles.clip, innerCoreStyle]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={BLUR.bubble}
                tint={resolvedTheme}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: androidFallback }]}
              />
            )}

            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: palette.glassFill }]}
            />

            <LinearGradient
              pointerEvents="none"
              colors={['transparent', palette.tintColor]}
              start={{ x: 0.5, y: 0.4 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <Animated.View pointerEvents="none" style={[styles.specularHost, specularStyle]}>
              <LinearGradient
                colors={[palette.rimLight, 'rgba(255,255,255,0)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.specular}
              />
            </Animated.View>

            <View
              pointerEvents="none"
              style={[styles.innerSheen, { backgroundColor: innerTopSheen }]}
            />
          </Animated.View>

          {/* Layer 3 — content */}
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 12,
  },
  clip: {
    overflow: 'hidden',
  },
  innerCore: {
    position: 'absolute',
    top: RIM_WIDTH,
    left: RIM_WIDTH,
    right: RIM_WIDTH,
    bottom: RIM_WIDTH,
  },
  specularHost: {
    position: 'absolute',
    top: '6%',
    left: '14%',
    width: '58%',
    height: '32%',
    borderTopLeftRadius: 200,
    borderTopRightRadius: 200,
    borderBottomLeftRadius: 200,
    borderBottomRightRadius: 200,
    overflow: 'hidden',
  },
  specular: {
    flex: 1,
  },
  innerSheen: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
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
