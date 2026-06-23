// Single bubble — multi-layer Liquid Glass sphere.
// Gestures/store logic preserved; the visual stack inside the bubble is new.
//
// The bubble view itself (size×size, centered on its position) is the gesture
// target, so a tap anywhere on the visible bubble registers. (It used to hang
// off a 0×0 anchor, so only the dead-center ~20px was tappable.)
//
// Layer stack (back → front):
//   0  drop shadow + glow halo — wrapper shadow + centered glow ring (pulses on confirm)
//   1  rim gradient ring        — directional white gradient (top-left lit edge)
//   2  inner core (inset 1.5)   — clipped to circle; holds blur + tint + gloss
//        a  BlurView            (iOS frosted glass) / solid fallback (Android)
//        b  glassFill wash       (base tint over the blur)
//        c  bottom color bloom   (the bubble's identity hue, sized to size*0.40)
//        d  top sheen            (diffuse overhead gloss, white→transparent)
//        e  inner-top sheen      (1px refractive edge highlight)
//   3  content                  — emoji, name, amount (sits above everything)

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

// Border thickness of the rim gradient ring (px)
const RIM_WIDTH = 1.5;

// Pan must move 8px before it activates so a tap can fire first. On Android the
// pan gesture is greedier than iOS and will steal the touch if it activates on
// any movement — this gives Tap room to resolve at the start of the gesture.
const PAN_MIN_DISTANCE = 8;

// Hit slop for tap/longPress — Android tap targets are stricter than iOS.
const HIT_SLOP = 10;

// Extra diameter of the glow halo beyond the bubble (px), split evenly each side.
const GLOW_SPREAD = 28;

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
  const requestDeleteCategory = useUIStore((s) => s.requestDeleteCategory);
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

  // Tap and long-press composition is Exclusive (only one can win), and that
  // pair runs Simultaneously with Pan. Pan also has a minDistance so it lets
  // brief taps through on Android, where Pan otherwise steals the touch.
  const tap = Gesture.Tap()
    .maxDuration(GESTURE.TAP_MAX_DURATION)
    .enabled(!dragMode)
    .hitSlop({ top: HIT_SLOP, bottom: HIT_SLOP, left: HIT_SLOP, right: HIT_SLOP })
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
    .hitSlop({ top: HIT_SLOP, bottom: HIT_SLOP, left: HIT_SLOP, right: HIT_SLOP })
    .onStart(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(enterDragMode)();
    });

  // Long-press *while already in drag mode* requests delete. Holding still won't
  // trip the pan (it needs movement), and any drag cancels this LongPress, so the
  // two coexist: hold to delete, drag to reposition.
  const longPressDelete = Gesture.LongPress()
    .minDuration(GESTURE.DRAG_ACTIVATION_DELAY)
    .enabled(dragMode)
    .hitSlop({ top: HIT_SLOP, bottom: HIT_SLOP, left: HIT_SLOP, right: HIT_SLOP })
    .onStart(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
      runOnJS(requestDeleteCategory)(category.id);
    });

  const pan = Gesture.Pan()
    .enabled(dragMode)
    .minDistance(PAN_MIN_DISTANCE)
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

  const gesture = Gesture.Simultaneous(
    Gesture.Exclusive(longPress, longPressDelete, tap),
    pan,
  );

  // Bubble view — positioned by left/top %, centered via negative margins, and
  // carrying the drop shadow + every transform. This is the gesture target, so
  // its size must match the visible circle for the whole bubble to be tappable.
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

  // Glow halo — larger than the bubble and centered inside it (offset = -spread/2).
  const glowRingStyle = useAnimatedStyle(() => {
    const size = animatedSize.value;
    const ringSize = size + GLOW_SPREAD;
    return {
      width: ringSize,
      height: ringSize,
      borderRadius: ringSize / 2,
      top: -GLOW_SPREAD / 2,
      left: -GLOW_SPREAD / 2,
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

  // Bottom color bloom — sized to 40% of the bubble so it occupies the lower
  // hemisphere without spilling into the gloss at the top.
  const bloomStyle = useAnimatedStyle(() => {
    const size = animatedSize.value;
    return {
      height: size * 0.4,
    };
  });

  const amountStr = compact(category.total);

  const nameColor =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.78)' : 'rgba(255,255,255,0.78)';
  const innerTopSheen =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.20)';
  // Diffuse overhead gloss — a soft white dome fading down the top half. Reads as
  // light from above instead of the pasted-on oval the old specular layers gave.
  const topSheen =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.10)';
  // Android has no BlurView fallback — give the inner core a stronger base wash
  // so the bubble has visual mass against the dark background.
  const androidFallback =
    resolvedTheme === 'light' ? 'rgba(245,245,250,0.55)' : 'rgba(28,28,42,0.55)';
  // Directional rim — bright at top-left, fading to near-invisible at bottom-right.
  const rimFade = resolvedTheme === 'light' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.bubble,
          { left: `${category.positionX}%`, top: `${category.positionY}%` },
          wrapperStyle,
          { shadowColor: palette.glow },
        ]}
      >
        {/* Layer 0 — pulsing glow halo, centered behind the bubble */}
        <Animated.View
          pointerEvents="none"
          style={[styles.glowRing, glowRingStyle, { backgroundColor: palette.glow }]}
        />

        {/* Layer 1 — rim gradient ring (directional sheen). The inner core
            sits inset by RIM_WIDTH, so this only shows on the perimeter. */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.clip, rimRadiusStyle]}
        >
          <LinearGradient
            colors={[palette.rimLight, rimFade]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Layer 2 — inner core: blur + tint + gloss, clipped & inset */}
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

          {/* Bottom color bloom — sized at 40% of the bubble */}
          <Animated.View pointerEvents="none" style={[styles.bloomHost, bloomStyle]}>
            <LinearGradient
              colors={['transparent', palette.tintColor]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Top sheen — soft overhead gloss across the upper half */}
          <View pointerEvents="none" style={styles.topSheen}>
            <LinearGradient
              colors={[topSheen, 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

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
    </GestureDetector>
  );
}

export const BubbleItem = memo(BubbleItemImpl);

const styles = StyleSheet.create({
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
  bloomHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '52%',
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
