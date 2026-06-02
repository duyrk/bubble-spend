// Gyroscope-driven tilt offset for bubble parallax (PS Vita effect)

import { useEffect } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { Gyroscope } from 'expo-sensors';
import { GYROSCOPE } from '@/constants/config';
import type { SharedValue } from 'react-native-reanimated';

type GyroscopeTilt = {
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
};

export function useGyroscopeTilt(): GyroscopeTilt {
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);

  useEffect(() => {
    let filteredX = 0;
    let filteredY = 0;

    Gyroscope.setUpdateInterval(GYROSCOPE.UPDATE_INTERVAL);

    const subscription = Gyroscope.addListener(({ x, y }) => {
      // Low-pass filter for smoothing
      filteredX = filteredX * (1 - GYROSCOPE.SMOOTHING_ALPHA) + x * GYROSCOPE.SMOOTHING_ALPHA;
      filteredY = filteredY * (1 - GYROSCOPE.SMOOTHING_ALPHA) + y * GYROSCOPE.SMOOTHING_ALPHA;

      // Scale and clamp to max drift
      const clampedX = Math.max(-GYROSCOPE.MAX_DRIFT, Math.min(GYROSCOPE.MAX_DRIFT, filteredY * 40));
      const clampedY = Math.max(-GYROSCOPE.MAX_DRIFT, Math.min(GYROSCOPE.MAX_DRIFT, filteredX * 40));

      tiltX.value = withSpring(clampedX, { damping: 20, stiffness: 80 });
      tiltY.value = withSpring(clampedY, { damping: 20, stiffness: 80 });
    });

    return () => subscription.remove();
  }, [tiltX, tiltY]);

  return { tiltX, tiltY };
}
