// Drag gesture handler for repositioning bubbles in drag mode

import { useSharedValue } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

type DragGestureResult = {
  gesture: ReturnType<typeof Gesture.Pan>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
};

export function useDragGesture(
  onDragEnd: (x: number, y: number) => void,
  enabled: boolean,
): DragGestureResult {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      onDragEnd(translateX.value, translateY.value);
    });

  return { gesture, translateX, translateY };
}
