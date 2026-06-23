// Container that positions all category bubbles and applies gyroscope tilt offset

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useCategoriesWithSize } from '@/hooks/useCategoriesWithSize';
import { useGyroscopeTilt } from '@/hooks/useGyroscopeTilt';
import { useUIStore } from '@/stores/useUIStore';
import { BubbleItem } from './BubbleItem';
import { AddCategorySheet } from './AddCategorySheet';
import { DeleteCategorySheet } from './DeleteCategorySheet';

export function BubbleField() {
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
          />
        ))}
      </Animated.View>
      {!dragMode && <AddCategorySheet />}
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
