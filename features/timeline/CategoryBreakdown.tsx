// "Where it went" — per-category expense breakdown for the active period.
// Rendered as a scrollable header above the transaction list. Bars are scaled
// relative to the top category (so the biggest reads full-width) and tinted with
// each category's bubble color; the percentage is share of total spending.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, useBubbleColors } from '@/hooks/useTheme';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useTranslation } from '@/hooks/useTranslation';
import { computeCategoryBreakdown } from '@/lib/insights';
import type { Category, Transaction } from '@/types';

interface CategoryBreakdownProps {
  transactions: Transaction[];
  categories: Category[];
}

export function CategoryBreakdown({ transactions, categories }: CategoryBreakdownProps) {
  const colors = useColors();
  const bubbleColors = useBubbleColors();
  const { format } = useFormatCurrency();
  const { t } = useTranslation();

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const slices = useMemo(
    () => computeCategoryBreakdown(transactions, new Set(categoryMap.keys())),
    [transactions, categoryMap],
  );

  if (slices.length === 0) return null;

  const maxTotal = slices[0].total;
  const trackColor = colors.glass.base;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text.tertiary }]}>
        {t('breakdownTitle').toUpperCase()}
      </Text>

      {slices.map((slice) => {
        const category = categoryMap.get(slice.categoryId);
        if (!category) return null;
        const swatch = bubbleColors[category.colorKey];
        const barWidth = maxTotal > 0 ? Math.max(0.04, slice.total / maxTotal) : 0;
        const percent = Math.round(slice.ratio * 100);

        return (
          <View key={slice.categoryId} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.emoji}>{category.emoji}</Text>
              <Text
                style={[styles.name, { color: colors.text.secondary }]}
                numberOfLines={1}
              >
                {category.name}
              </Text>
              <Text style={[styles.amount, { color: colors.text.primary }]}>
                {format(slice.total)}
              </Text>
              <Text style={[styles.percent, { color: colors.text.tertiary }]}>
                {percent}%
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: trackColor }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${barWidth * 100}%`, backgroundColor: swatch.border },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: 10,
  },
  row: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  emoji: {
    fontSize: 14,
    marginRight: 7,
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  amount: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  percent: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 34,
    textAlign: 'right',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
