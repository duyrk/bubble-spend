// Period summary — three columns: expense (default), income (green), net (signed).
// Income column doubles as the entry point for logging income (tappable pill).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

const INCOME_COLOR = '#3DB882';
const DEFICIT_COLOR = '#F76C6C';

interface TotalDisplayProps {
  expense: number;
  income: number;
  net: number;
  onIncomePress: () => void;
}

export function TotalDisplay({ expense, income, net, onIncomePress }: TotalDisplayProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { compact } = useFormatCurrency();

  const expenseStr = compact(expense) ?? '0';
  const incomeStr = compact(income) ?? '0';
  const netStr = compact(Math.abs(net)) ?? '0';
  const netSign = net >= 0 ? '+' : '−';
  const netColor = net >= 0 ? INCOME_COLOR : DEFICIT_COLOR;

  return (
    <View style={styles.container}>
      <View style={styles.col}>
        <Text style={[styles.label, { color: colors.text.tertiary }]}>
          {t('spent').toUpperCase()}
        </Text>
        <Text style={[styles.amount, { color: colors.text.primary }]}>
          ↓ {expenseStr}
        </Text>
      </View>

      <Pressable
        onPress={onIncomePress}
        style={({ pressed }) => [
          styles.col,
          styles.incomeCol,
          pressed && { opacity: 0.7 },
        ]}
        hitSlop={8}
      >
        <Text style={[styles.label, { color: colors.text.tertiary }]}>
          {t('earned').toUpperCase()}
        </Text>
        <Text style={[styles.amount, { color: INCOME_COLOR }]}>
          ↑ {incomeStr}
        </Text>
      </Pressable>

      <View style={styles.col}>
        <Text style={[styles.label, { color: colors.text.tertiary }]}>
          {t('net').toUpperCase()}
        </Text>
        <Text style={[styles.amount, { color: netColor }]}>
          {netSign} {netStr}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  col: {
    alignItems: 'center',
    flex: 1,
  },
  // Visual cue that the income column is interactive — a subtle hairline plus
  // the matching green amount text are usually enough to invite a tap.
  incomeCol: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.3,
    marginBottom: 4,
    fontWeight: '700',
  },
  amount: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
});
