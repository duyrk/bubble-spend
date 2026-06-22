// History screen — transaction timeline with period tabs

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useUIStore } from '@/stores/useUIStore';
import { TransactionList } from './TransactionList';
import { NumpadModal } from '@/features/numpad/NumpadModal';
import { getPeriodRange, useTransactionStore } from '@/stores/useTransactionStore';
import * as db from '@/lib/db';
import type { Period, Transaction } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

const PERIODS: { key: Period; tKey: TranslationKey }[] = [
  { key: 'today', tKey: 'today' },
  { key: 'yesterday', tKey: 'yesterday' },
  { key: 'week', tKey: 'thisWeek' },
  { key: 'month', tKey: 'thisMonth' },
];

const INCOME_COLOR = '#3DB882';
const DEFICIT_COLOR = '#F76C6C';

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useTranslation();
  const { compact } = useFormatCurrency();
  const categories = useCategoryStore((s) => s.categories);
  const setNumpadEditing = useUIStore((s) => s.setNumpadEditing);
  const [period, setPeriod] = useState<Period>('today');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);

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

  // Mutations go through the transaction store (which re-scales bubbles for
  // Home), then we re-query SQLite so this screen's independent list reflects it.
  const handleDelete = useCallback(
    (id: string) => {
      useTransactionStore.getState().deleteTransaction(id);
      loadTransactions();
    },
    [loadTransactions],
  );

  const handleEditAmount = useCallback(
    (tx: Transaction) => {
      setEditTarget(tx);
      setNumpadEditing(true);
    },
    [setNumpadEditing],
  );

  const handleEditClose = useCallback(() => {
    setEditTarget(null);
    setNumpadEditing(false);
  }, [setNumpadEditing]);

  const handleEditConfirm = useCallback(
    (id: string, amount: number) => {
      useTransactionStore.getState().updateTransactionAmount(id, amount);
      loadTransactions();
    },
    [loadTransactions],
  );

  const editCategory = editTarget
    ? categories.find((c) => c.id === editTarget.categoryId)
    : undefined;

  const { expense, income, net } = useMemo(() => {
    let exp = 0;
    let inc = 0;
    for (const tx of transactions) {
      if (tx.type === 'income') inc += tx.amount;
      else exp += tx.amount;
    }
    return { expense: exp, income: inc, net: inc - exp };
  }, [transactions]);

  const netColor = net >= 0 ? INCOME_COLOR : DEFICIT_COLOR;
  const netSign = net >= 0 ? '+' : '−';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={[styles.periodLabel, { color: colors.text.tertiary }]}>
          {t(PERIODS.find((p) => p.key === period)?.tKey ?? 'today').toUpperCase()}
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>
              {t('spent').toUpperCase()}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
              ↓ {compact(expense) ?? '0'}
            </Text>
          </View>
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>
              {t('earned').toUpperCase()}
            </Text>
            <Text style={[styles.summaryValue, { color: INCOME_COLOR }]}>
              ↑ {compact(income) ?? '0'}
            </Text>
          </View>
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>
              {t('net').toUpperCase()}
            </Text>
            <Text style={[styles.summaryValue, { color: netColor }]}>
              {netSign} {compact(Math.abs(net)) ?? '0'}
            </Text>
          </View>
        </View>
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
        onDelete={handleDelete}
        onEditAmount={handleEditAmount}
      />

      <NumpadModal
        editMode
        editTransaction={editTarget}
        editCategory={editCategory}
        onEditClose={handleEditClose}
        onEditConfirm={handleEditConfirm}
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
    marginBottom: 8,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryCol: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 2,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
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
