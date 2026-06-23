// Home screen — period tabs, summary row, bubble field, numpad, fireworks, empty hint

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBubbleColors, useColors } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useUIStore } from '@/stores/useUIStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { BubbleField } from '@/features/bubble/BubbleField';
import { AmbientBloom } from '@/components/ui/AmbientBloom';
import { UndoToast } from '@/components/ui/UndoToast';
import { NumpadModal } from '@/features/numpad/NumpadModal';
import { FireworksOverlay } from '@/features/effects/Fireworks';
import { useFireworks } from '@/features/effects/useFireworks';
import { OnboardingOverlay } from '@/features/onboarding/OnboardingOverlay';
import { PeriodBar } from './PeriodBar';
import { TotalDisplay } from './TotalDisplay';
import type { TransactionType } from '@/types';

const INCOME_GLOW = 'rgba(61,184,130,0.6)';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useTranslation();

  const bubbleColors = useBubbleColors();
  const activePeriod = useUIStore((s) => s.activePeriod);
  const setPeriod = useUIStore((s) => s.setPeriod);
  const dragMode = useUIStore((s) => s.dragMode);
  const exitDragMode = useUIStore((s) => s.exitDragMode);
  const openIncomeModal = useUIStore((s) => s.openIncomeModal);
  const loadByPeriod = useTransactionStore((s) => s.loadByPeriod);
  const transactions = useTransactionStore((s) => s.transactions);
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction);
  const recalcSizes = useCategoryStore((s) => s.recalcSizes);
  const categories = useCategoryStore((s) => s.categories);
  const loaded = useCategoryStore((s) => s.loaded);

  const { particles, trigger: triggerFireworks } = useFireworks();
  const [pendingUndoId, setPendingUndoId] = useState<string | null>(null);

  useEffect(() => {
    if (loaded) {
      loadByPeriod(activePeriod);
    }
  }, [activePeriod, loaded, loadByPeriod]);

  useEffect(() => {
    recalcSizes(transactions);
  }, [transactions, recalcSizes]);

  const handleTransactionConfirmed = useCallback(
    (categoryId: string, x: number, y: number, type: TransactionType, txId: string) => {
      loadByPeriod(activePeriod);
      setPendingUndoId(txId);
      if (type === 'income') {
        setTimeout(() => triggerFireworks(x, y, INCOME_GLOW), 80);
        return;
      }
      const cat = categories.find((c) => c.id === categoryId);
      const glow = cat ? bubbleColors[cat.colorKey].glow : undefined;
      setTimeout(() => triggerFireworks(x, y, glow), 80);
    },
    [activePeriod, bubbleColors, categories, loadByPeriod, triggerFireworks],
  );

  const dismissUndo = useCallback(() => setPendingUndoId(null), []);

  const handleUndo = useCallback(() => {
    // deleteTransaction drops the row, re-scales bubbles, and updates the store
    // transactions this screen reads from — no reload needed.
    if (pendingUndoId) {
      deleteTransaction(pendingUndoId);
    }
    setPendingUndoId(null);
  }, [pendingUndoId, deleteTransaction]);

  // Derive totals from the subscribed `transactions` (same source the bubbles'
  // recalcSizes uses) rather than calling store getters that read get() during
  // render — the latter tears on cold start, showing 0 until a re-render.
  const { expenseTotal, incomeTotal, netBalance } = useMemo(() => {
    let exp = 0;
    let inc = 0;
    for (const tx of transactions) {
      if (tx.type === 'income') inc += tx.amount;
      else exp += tx.amount;
    }
    return { expenseTotal: exp, incomeTotal: inc, netBalance: inc - exp };
  }, [transactions]);
  const isEmpty = transactions.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary, paddingTop: insets.top + 8 }]}>
      {/* Ambient room lighting — soft radial color halos behind everything. */}
      <AmbientBloom />

      <PeriodBar active={activePeriod} onChange={setPeriod} />
      <TotalDisplay
        expense={expenseTotal}
        income={incomeTotal}
        net={netBalance}
        onIncomePress={openIncomeModal}
      />

      <BubbleField />

      {isEmpty && !dragMode ? (
        <View style={[styles.emptyHint, { bottom: insets.bottom + 112 }]} pointerEvents="none">
          <Text style={[styles.emptyHintText, { color: colors.text.tertiary }]}>
            {t('emptyHomeTitle')}
          </Text>
        </View>
      ) : null}

      {dragMode && (
        <Pressable
          style={[styles.doneBtn, { backgroundColor: colors.accent }]}
          onPress={exitDragMode}
        >
          <Text style={styles.doneBtnText}>{t('doneCheck')}</Text>
        </Pressable>
      )}

      <NumpadModal onTransactionConfirmed={handleTransactionConfirmed} />
      <FireworksOverlay particles={particles} />

      <UndoToast id={pendingUndoId} onUndo={handleUndo} onDismiss={dismissUndo} />

      <OnboardingOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  emptyHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  emptyHintText: {
    fontSize: 12,
    letterSpacing: 0.4,
  },
  doneBtn: {
    position: 'absolute',
    top: 52,
    right: 12,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 5,
    zIndex: 2,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
