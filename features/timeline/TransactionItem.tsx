// Single transaction row — glass icon tinted with category bg, staggered fade-in.

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useBubbleColors, useColors } from '@/hooks/useTheme';
import { SPRING } from '@/constants/theme';
import type { Transaction, Category } from '@/types';

interface TransactionItemProps {
  transaction: Transaction;
  category: Category | undefined;
  index: number;
}

export function TransactionItem({ transaction, category, index }: TransactionItemProps) {
  const { format } = useFormatCurrency();
  const colors = useColors();
  const bubbleColors = useBubbleColors();

  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-8);

  useEffect(() => {
    const delay = index * 30;
    opacity.value = withDelay(delay, withTiming(1, { duration: 220 }));
    translateX.value = withDelay(delay, withSpring(0, SPRING.responsive));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const time = new Date(transaction.transactedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const palette = category ? bubbleColors[category.colorKey] : null;

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <View
        style={[
          styles.icon,
          {
            backgroundColor: palette?.bg ?? colors.glass.base,
            borderColor: palette?.border ?? colors.glass.border,
          },
        ]}
      >
        <Text style={styles.emoji}>{category?.emoji ?? '?'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text.primary }]}>{category?.name ?? '—'}</Text>
        <Text style={[styles.time, { color: colors.text.tertiary }]}>{time}</Text>
      </View>
      <Text style={[styles.amount, { color: colors.text.primary }]}>
        -{format(transaction.amount)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
  },
  time: {
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
  },
});
