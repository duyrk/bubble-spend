// Fireworks overlay — animates each particle on the UI thread via Reanimated.
// Physics: vx/vy initial velocity, gravity bias accumulates over the lifetime,
// opacity and scale fade out over 900ms with ease-out quadratic.

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import type { Particle } from './useFireworks';
import { LIFETIME_MS } from './useFireworks';

function ParticleView({ p }: { p: Particle }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: LIFETIME_MS, easing: Easing.out(Easing.quad) }));
  }, [p.delay, t]);

  const style = useAnimatedStyle(() => {
    'worklet';
    const k = t.value;
    // Position: linear by velocity, gravity term grows with k^2
    const dx = p.vx * k;
    const dy = p.vy * k + 240 * k * k;
    const opacity = 1 - k;
    const scale = 1 - k * 0.6;
    return {
      transform: [
        { translateX: dx },
        { translateY: dy },
        { scale },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        {
          left: p.startX,
          top: p.startY,
          width: p.size,
          height: p.size,
          borderRadius: p.size / 2,
          backgroundColor: p.color,
        },
      ]}
    />
  );
}

export function FireworksOverlay({ particles }: { particles: Particle[] }) {
  if (particles.length === 0) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      {particles.map((p) => (
        <ParticleView key={p.id} p={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  particle: {
    position: 'absolute',
  },
});
