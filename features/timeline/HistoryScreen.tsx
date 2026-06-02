// History screen — transaction timeline with period tabs

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { TransactionList } from './TransactionList';
import { getPeriodRange } from '@/stores/useTransactionStore';
import * as db from '@/lib/db';
import type { Period, Transaction } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

const PERIODS: { key: Period; tKey: TranslationKey }[] = [
  { key: 'today', tKey: 'today' },
  { key: 'yesterday', tKey: 'yesterday' },
  { key: 'week', tKey: 'thisWeek' },
  { key: 'month', tKey: 'thisMonth' },
];

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useTranslation();
  const { format } = useFormatCurrency();
  const categories = useCategoryStore((s) => s.categories);
  const [period, setPeriod] = useState<Period>('today');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const loadTransactions = useCallback(() => {
    const { start, end } = getPeriodRange(period);
    setTransactions(db.getTransactionsByPeriod(start, end));
  }, [period]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions]),
  );

  const total = useMemo(
    () => transactions.reduce((sum, tx) => sum + tx.amount, 0),
    [transactions],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={[styles.periodLabel, { color: colors.text.tertiary }]}>
          {t(PERIODS.find((p) => p.key === period)?.tKey ?? 'today').toUpperCase()}
        </Text>
        <Text style={[styles.totalAmount, { color: colors.text.primary }]}>{format(total)}</Text>
      </View>

      <View style={styles.tabRow}>
        {PERIODS.map((p) => {
          const isActive = period === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[
                styles.tab,
                {
                  borderColor: isActive ? 'transparent' : colors.glass.border,
                  backgroundColor: isActive ? colors.glass.base : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.text.primary : colors.text.tertiary },
                ]}
              >
                {t(p.tKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TransactionList
        transactions={transactions}
        categories={categories}
        emptyTitle={t('noTransactions')}
        emptyHint={t('noTransactionsHint')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  periodLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 4,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexWrap: 'wrap',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 0.5,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
