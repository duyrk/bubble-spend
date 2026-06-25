// Single transaction row — glass icon tinted with category bg, staggered fade-in.
// Income rows use a 💰 emoji and green amount; expense rows keep the white amount.
//
// Swipe the row left to reveal a Delete action; tap the amount to edit it.
// The swipe is a plain Gesture Handler Pan + Reanimated translate — no external
// swipeable library — to stay consistent with the rest of the app.

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useBubbleColors, useColors } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { SPRING } from '@/constants/theme';
import type { Transaction, Category } from '@/types';

const INCOME_COLOR = '#3DB882';
const DELETE_WIDTH = 84;

interface TransactionItemProps {
  transaction: Transaction;
  category: Category | undefined;
  index: number;
  onDelete: (id: string) => void;
  onEditAmount: (tx: Transaction) => void;
}

export function TransactionItem({
  transaction,
  category,
  index,
  onDelete,
  onEditAmount,
}: TransactionItemProps) {
  const { format } = useFormatCurrency();
  const colors = useColors();
  const bubbleColors = useBubbleColors();
  const { t } = useTranslation();

  const opacity = useSharedValue(0);
  const swipeX = useSharedValue(0);
  const startX = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(index * 30, withTiming(1, { duration: 220 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Horizontal swipe to reveal the Delete action. activeOffsetX keeps taps (for
  // editing the amount) and vertical scroll from triggering it; failOffsetY lets
  // the parent ScrollView win a vertical drag.
  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onStart(() => {
      startX.value = swipeX.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      swipeX.value = Math.min(0, Math.max(-DELETE_WIDTH, next));
    })
    .onEnd(() => {
      const open = swipeX.value < -DELETE_WIDTH / 2;
      swipeX.value = withSpring(open ? -DELETE_WIDTH : 0, SPRING.responsive);
    });

  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: swipeX.value }],
  }));

  const time = new Date(transaction.transactedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isIncome = transaction.type === 'income';
  const palette = !isIncome && category ? bubbleColors[category.colorKey] : null;

  const displayEmoji = isIncome ? '💰' : category?.emoji ?? '?';
  const displayName = isIncome ? t('incomeLabel') : category?.name ?? '—';
  const sign = isIncome ? '+' : '−';
  const amountColor = isIncome ? INCOME_COLOR : colors.text.primary;

  return (
    <View style={styles.container}>
      {/* Delete action sits behind the row; the row slides left to reveal it. */}
      <View style={[styles.deleteAction, { backgroundColor: colors.danger }]}>
        <Pressable
          onPress={() => onDelete(transaction.id)}
          style={styles.deleteBtn}
          hitSlop={6}
        >
          <Text style={styles.deleteText}>{t('delete')}</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, rowStyle, { backgroundColor: colors.bg.primary }]}>
          <View
            style={[
              styles.icon,
              {
                backgroundColor: palette?.bg ?? colors.glass.base,
                borderColor: palette?.border ?? colors.glass.border,
              },
            ]}
          >
            <Text style={styles.emoji}>{displayEmoji}</Text>
          </View>
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.text.primary }]}>{displayName}</Text>
            <Text style={[styles.time, { color: colors.text.tertiary }]} numberOfLines={1}>
              {transaction.note ? `${time}  ·  ${transaction.note}` : time}
            </Text>
          </View>
          <Pressable onPress={() => onEditAmount(transaction)} hitSlop={8}>
            <Text style={[styles.amount, { color: amountColor }]}>
              {sign}
              {format(transaction.amount)}
            </Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DELETE_WIDTH,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
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
