// Container that positions all category bubbles and applies gyroscope tilt offset

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { GestureType } from 'react-native-gesture-handler';
import { useCategoriesWithSize } from '@/hooks/useCategoriesWithSize';
import { useGyroscopeTilt } from '@/hooks/useGyroscopeTilt';
import { useUIStore } from '@/stores/useUIStore';
import { BubbleItem } from './BubbleItem';
import { AddCategorySheet } from './AddCategorySheet';
import { QuickActionsMenu } from './QuickActionsMenu';
import { BudgetSheet } from './BudgetSheet';
import { DeleteCategorySheet } from './DeleteCategorySheet';

interface BubbleFieldProps {
  // Home period-swipe pan, forwarded to each bubble so a horizontal swipe that
  // starts on a bubble isn't swallowed by the bubble's own gestures.
  swipeGesture?: GestureType;
}

export function BubbleField({ swipeGesture }: BubbleFieldProps) {
  const dragMode = useUIStore((s) => s.dragMode);
  const { tiltX, tiltY } = useGyroscopeTilt();

  const tiltStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tiltX.value }, { translateY: tiltY.value }],
  }));
  const categoriesWithSize = useCategoriesWithSize();

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.field, tiltStyle]}>
        {categoriesWithSize.map((cat, index) => (
          <BubbleItem
            key={cat.id}
            category={cat}
            index={index}
            dragMode={dragMode}
            swipeGesture={swipeGesture}
          />
        ))}
      </Animated.View>
      {!dragMode && <AddCategorySheet />}
      <QuickActionsMenu />
      <BudgetSheet />
      <DeleteCategorySheet />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  field: {
    flex: 1,
    position: 'relative',
  },
});
