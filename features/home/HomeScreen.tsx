// Home screen — period tabs, total, bubble field, numpad, fireworks, empty hint

import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBubbleColors, useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useUIStore } from '@/stores/useUIStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { BubbleField } from '@/features/bubble/BubbleField';
import { NumpadModal } from '@/features/numpad/NumpadModal';
import { FireworksOverlay } from '@/features/effects/Fireworks';
import { useFireworks } from '@/features/effects/useFireworks';
import { PeriodBar } from './PeriodBar';
import { TotalDisplay } from './TotalDisplay';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();

  const bubbleColors = useBubbleColors();
  const activePeriod = useUIStore((s) => s.activePeriod);
  const setPeriod = useUIStore((s) => s.setPeriod);
  const dragMode = useUIStore((s) => s.dragMode);
  const exitDragMode = useUIStore((s) => s.exitDragMode);
  const loadByPeriod = useTransactionStore((s) => s.loadByPeriod);
  const transactions = useTransactionStore((s) => s.transactions);
  const getTotal = useTransactionStore((s) => s.getTotal);
  const recalcSizes = useCategoryStore((s) => s.recalcSizes);
  const categories = useCategoryStore((s) => s.categories);
  const loaded = useCategoryStore((s) => s.loaded);

  const { particles, trigger: triggerFireworks } = useFireworks();

  useEffect(() => {
    if (loaded) {
      loadByPeriod(activePeriod);
    }
  }, [activePeriod, loaded, loadByPeriod]);

  useEffect(() => {
    recalcSizes(transactions);
  }, [transactions, recalcSizes]);

  const handleTransactionConfirmed = useCallback(
    (categoryId: string, x: number, y: number) => {
      loadByPeriod(activePeriod);
      const cat = categories.find((c) => c.id === categoryId);
      const glow = cat ? bubbleColors[cat.colorKey].glow : undefined;
      setTimeout(() => triggerFireworks(x, y, glow), 80);
    },
    [activePeriod, bubbleColors, categories, loadByPeriod, triggerFireworks],
  );

  const total = getTotal();
  const isEmpty = transactions.length === 0;

  const bloomCenter = resolvedTheme === 'light' ? 'rgba(124,106,247,0.12)' : 'rgba(124,106,247,0.10)';
  const bloomOffset = resolvedTheme === 'light' ? 'rgba(100,160,200,0.10)' : 'rgba(100,160,200,0.07)';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary, paddingTop: insets.top + 8 }]}>
      {/* Ambient room lighting — soft color blooms behind everything. The two
          oversized circles read as radial halos via natural alpha falloff. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.bloomCenter, { backgroundColor: bloomCenter }]} />
        <View style={[styles.bloomOffset, { backgroundColor: bloomOffset }]} />
      </View>

      <PeriodBar active={activePeriod} onChange={setPeriod} />
      <TotalDisplay amount={total} />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  bloomCenter: {
    position: 'absolute',
    width: 700,
    height: 700,
    borderRadius: 350,
    top: '20%',
    left: '50%',
    marginLeft: -350,
    opacity: 0.85,
  },
  bloomOffset: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    top: -120,
    right: -160,
    opacity: 0.85,
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
