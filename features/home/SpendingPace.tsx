// Spending pace — a compact projection line shown under the summary on the
// "This month" tab. Extrapolates month-to-date spend to a full-month estimate
// and, when budgets are set, flags whether that pace is on track or over.

import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useColors } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { projectMonthlySpend } from '@/lib/forecast';

const INCOME_COLOR = '#3DB882';
const DEFICIT_COLOR = '#F76C6C';

interface SpendingPaceProps {
  // Expense total for the current calendar month so far.
  monthToDate: number;
  // Sum of all category budgets (0 = none set).
  totalBudget: number;
}

export function SpendingPace({ monthToDate, totalBudget }: SpendingPaceProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { compact } = useFormatCurrency();

  // Nothing meaningful to project before any spend lands this month.
  if (monthToDate <= 0) return null;

  const { projected } = projectMonthlySpend(monthToDate);

  const hasBudget = totalBudget > 0;
  const over = hasBudget && projected > totalBudget;
  const statusColor = over ? DEFICIT_COLOR : INCOME_COLOR;
  const statusText = !hasBudget
    ? null
    : over
      ? `${compact(projected - totalBudget) ?? '0'} ${t('paceOver')}`
      : t('paceOnTrack');

  return (
    <View style={styles.row}>
      <Feather name="trending-up" size={13} color={colors.text.tertiary} />
      <Text style={[styles.label, { color: colors.text.tertiary }]}>
        {t('projected')}{' '}
        <Text style={[styles.value, { color: colors.text.secondary }]}>
          {compact(projected) ?? '0'}
        </Text>{' '}
        {t('paceThisMonth')}
      </Text>
      {statusText ? (
        <Text style={[styles.status, { color: statusColor }]}>· {statusText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -6,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  value: {
    fontWeight: '700',
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
  },
});
