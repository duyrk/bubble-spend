// Period total spend display

import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface TotalDisplayProps {
  amount: number;
}

export function TotalDisplay({ amount }: TotalDisplayProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { format } = useFormatCurrency();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>
        {t('spent').toUpperCase()}
      </Text>
      <Text style={[styles.amount, { color: colors.text.primary }]}>{format(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 4,
    fontWeight: '600',
  },
  amount: {
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: -1,
  },
});
