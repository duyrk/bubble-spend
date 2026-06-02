// Computes animated bubble sizes based on spending data
// Will drive spring animations when category totals change

import { useEffect } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { SIZES } from '@/constants/theme';

type BubblePhysics = {
  animatedSize: SharedValue<number>;
};

export function useBubblePhysics(targetSize: number): BubblePhysics {
  const animatedSize = useSharedValue<number>(SIZES.BUBBLE_BASE);

  useEffect(() => {
    animatedSize.value = withSpring(targetSize, {
      damping: 15,
      stiffness: 120,
      mass: 0.8,
    });
  }, [targetSize, animatedSize]);

  return { animatedSize };
}
