// Reactive currency formatting based on settings

import { useCallback } from 'react';
import { formatCurrency, formatCompact, CURRENCIES } from '@/lib/currency';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function useFormatCurrency() {
  const currency = useSettingsStore((s) => s.currency);
  const meta = CURRENCIES[currency];

  const format = useCallback((amount: number) => formatCurrency(amount, currency), [currency]);
  const compact = useCallback((amount: number) => formatCompact(amount, currency), [currency]);

  return { format, compact, currency, meta };
}
