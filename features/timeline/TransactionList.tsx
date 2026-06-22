// Transaction list grouped by date — staggered row entry, theme-aware separators.

import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import type { Transaction, Category } from '@/types';
import { TransactionItem } from './TransactionItem';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  emptyTitle: string;
  emptyHint?: string;
  onDelete: (id: string) => void;
  onEditAmount: (tx: Transaction) => void;
}

type DateGroup = {
  label: string;
  transactions: Transaction[];
};

function groupByDate(transactions: Transaction[]): DateGroup[] {
  const sorted = [...transactions].sort((a, b) => b.transactedAt - a.transactedAt);
  const groups: Map<string, Transaction[]> = new Map();

  for (const tx of sorted) {
    const d = new Date(tx.transactedAt);
    const label = d.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'numeric',
    });
    const existing = groups.get(label);
    if (existing) existing.push(tx);
    else groups.set(label, [tx]);
  }

  return Array.from(groups.entries()).map(([label, txs]) => ({ label, transactions: txs }));
}

export function TransactionList({
  transactions,
  categories,
  emptyTitle,
  emptyHint,
  onDelete,
  onEditAmount,
}: TransactionListProps) {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const groups = useMemo(() => groupByDate(transactions), [transactions]);
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const separatorColor =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.06)' : 'rgba(255,255,255,0.05)';

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>{emptyTitle}</Text>
        {emptyHint ? (
          <Text style={[styles.emptyHint, { color: colors.text.tertiary }]}>{emptyHint}</Text>
        ) : null}
      </View>
    );
  }

  let cumulativeIndex = 0;

  return (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {groups.map((group, gIdx) => (
        <View key={group.label} style={styles.group}>
          <Text style={[styles.dateLabel, { color: colors.text.tertiary }]}>
            {group.label.toUpperCase()}
          </Text>
          {group.transactions.map((tx) => {
            const node = (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                category={categoryMap.get(tx.categoryId)}
                index={cumulativeIndex}
                onDelete={onDelete}
                onEditAmount={onEditAmount}
              />
            );
            cumulativeIndex += 1;
            return node;
          })}
          {gIdx < groups.length - 1 ? (
            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    paddingBottom: 120,
  },
  group: {
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 8,
  },
  separator: {
    height: 1,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
