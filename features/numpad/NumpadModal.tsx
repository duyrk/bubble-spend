// Liquid Glass bottom-sheet numpad — slide-up, GlassSurface body, blurred backdrop.
// Hosts both expense (per-category) and income (global) entry; the type toggle
// at the top swaps between them without resetting the entered amount.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useTranslation } from '@/hooks/useTranslation';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/useUIStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { BLUR, RADII, SPRING, TIMING } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';
import {
  INCOME_CATEGORY_ID,
  type TransactionType,
  type Transaction,
  type Category,
} from '@/types';

const MODAL_HEIGHT = 520;
const INCOME_COLOR = '#3DB882';

interface NumpadModalProps {
  // Create flow (Home) — driven by the global UI store.
  onTransactionConfirmed?: (
    categoryId: string,
    x: number,
    y: number,
    type: TransactionType,
  ) => void;
  // Edit flow (History) — when `editMode` is true the modal ignores the global
  // UI store entirely and is driven by these props. Only the amount is editable;
  // the type/category are locked to the transaction being edited.
  editMode?: boolean;
  editTransaction?: Transaction | null;
  editCategory?: Category;
  onEditClose?: () => void;
  onEditConfirm?: (id: string, amount: number) => void;
}

const KEYS: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'];

export function NumpadModal({
  onTransactionConfirmed,
  editMode,
  editTransaction,
  editCategory,
  onEditClose,
  onEditConfirm,
}: NumpadModalProps) {
  const { t } = useTranslation();
  const { meta } = useFormatCurrency();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();

  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const categories = useCategoryStore((s) => s.categories);
  const add = useTransactionStore((s) => s.add);

  const editing = editMode === true;

  const [amount, setAmount] = useState('0');
  const [txType, setTxType] = useState<TransactionType>('expense');

  // Open/close + source context resolve from either the edit props (History) or
  // the global store (create flow, Home). A given instance is driven by exactly
  // one of them: Home passes no edit props; History sets editMode.
  const isOpen = editing ? editTransaction != null : activeModal !== null;
  const createSourceId = activeModal?.categoryId ?? null;
  const sourceCategory = editing
    ? editCategory
    : createSourceId
      ? categories.find((c) => c.id === createSourceId)
      : undefined;

  // In edit mode the type is fixed to the transaction — both toggle segments are
  // locked. In create mode, expense is locked only at the income entry point
  // (no source bubble to flip back to).
  const expenseDisabled = editing ? true : createSourceId === null;
  const incomeDisabled = editing;

  // Reset amount + type each time the create modal is (re)opened. Switching the
  // type *while* open keeps the typed amount; that's handled by setTxType below.
  const prevActiveModalKey = useRef<string | null>(null);
  useEffect(() => {
    if (editing) return;
    const key = activeModal
      ? `${activeModal.categoryId ?? 'income'}:${activeModal.defaultType}`
      : null;
    if (key !== prevActiveModalKey.current) {
      prevActiveModalKey.current = key;
      if (activeModal !== null) {
        setAmount('0');
        setTxType(activeModal.defaultType);
      }
    }
  }, [activeModal, editing]);

  // Edit mode: pre-fill the amount and lock the type whenever a new transaction
  // is opened for editing.
  const prevEditId = useRef<string | null>(null);
  useEffect(() => {
    if (!editing) return;
    const id = editTransaction?.id ?? null;
    if (id !== prevEditId.current) {
      prevEditId.current = id;
      if (editTransaction) {
        setAmount(String(Math.round(editTransaction.amount)));
        setTxType(editTransaction.type);
      }
    }
  }, [editing, editTransaction]);

  const amountSlide = useSharedValue(0);
  useEffect(() => {
    amountSlide.value = -4;
    amountSlide.value = withTiming(0, { duration: 80 });
  }, [amount, amountSlide]);

  const handleKey = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount((prev) => {
      if (prev === '0') return key === '000' ? '0' : key;
      const next = prev + key;
      // 10-digit cap matches PRD — enough for VND million-scale entries
      return next.length > 10 ? next.slice(0, 10) : next;
    });
  }, []);

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  }, []);

  const handleConfirm = useCallback(() => {
    const value = parseInt(amount, 10) || 0;

    // Edit flow — only the amount changes; type/category are untouched.
    if (editing) {
      if (value > 0 && editTransaction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onEditConfirm?.(editTransaction.id, value);
      }
      onEditClose?.();
      return;
    }

    if (value <= 0) {
      closeModal();
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (txType === 'income') {
      add(INCOME_CATEGORY_ID, value, 'income');
      // For income fireworks we fire near the top-right (income pill location).
      // The Home screen handles positioning when it gets no source category.
      if (onTransactionConfirmed) {
        onTransactionConfirmed(INCOME_CATEGORY_ID, 80, 18, 'income');
      }
    } else if (sourceCategory) {
      add(sourceCategory.id, value, 'expense');
      if (onTransactionConfirmed) {
        onTransactionConfirmed(
          sourceCategory.id,
          sourceCategory.positionX,
          sourceCategory.positionY,
          'expense',
        );
      }
    }
    closeModal();
  }, [
    amount,
    editing,
    editTransaction,
    onEditConfirm,
    onEditClose,
    txType,
    sourceCategory,
    add,
    closeModal,
    onTransactionConfirmed,
  ]);

  const handleCancel = useCallback(() => {
    if (editing) {
      onEditClose?.();
      return;
    }
    closeModal();
  }, [editing, onEditClose, closeModal]);

  const setExpense = useCallback(() => {
    if (expenseDisabled) return;
    Haptics.selectionAsync();
    setTxType('expense');
  }, [expenseDisabled]);

  const setIncome = useCallback(() => {
    if (incomeDisabled) return;
    Haptics.selectionAsync();
    setTxType('income');
  }, [incomeDisabled]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isOpen ? 1 : 0, { duration: TIMING.normal }),
    pointerEvents: isOpen ? ('auto' as const) : ('none' as const),
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: withSpring(isOpen ? 0 : MODAL_HEIGHT + 60, SPRING.sheet) },
    ],
  }));

  const amountStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: amountSlide.value }],
  }));

  const displayValue = parseInt(amount, 10);
  const displayAmount = displayValue.toLocaleString();
  const isZero = displayValue === 0;

  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.72)' : 'rgba(17,17,28,0.72)';
  const confirmRim =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)';
  const toggleTrack =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.06)' : 'rgba(255,255,255,0.06)';
  const toggleActiveFill =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.10)' : 'rgba(255,255,255,0.14)';
  const toggleInactiveText =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.40)' : 'rgba(255,255,255,0.35)';

  const headerEmoji = txType === 'income' ? '💰' : sourceCategory?.emoji ?? '';
  const headerLabel =
    txType === 'income'
      ? t('incomeLabel')
      : sourceCategory
        ? sourceCategory.name
        : '';

  const confirmColor = txType === 'income' ? INCOME_COLOR : colors.accent;

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />
      </Animated.View>

      <Animated.View style={[styles.modalWrapper, modalStyle]}>
        <GlassSurface
          intensity={BLUR.sheet}
          borderRadius={RADII.sheet}
          surfaceTint={sheetTint}
          shimmer
          style={styles.sheetGlass}
        >
          <View style={styles.modalSurface}>
            <View style={[styles.handle, { backgroundColor: colors.glass.borderStrong }]} />

            {/* Type toggle pill */}
            <View style={[styles.toggleTrack, { backgroundColor: toggleTrack }]}>
              <Pressable
                onPress={setExpense}
                disabled={expenseDisabled}
                style={[
                  styles.toggleSegment,
                  txType === 'expense' && { backgroundColor: toggleActiveFill },
                  expenseDisabled && txType !== 'expense' && { opacity: 0.35 },
                ]}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    {
                      color:
                        txType === 'expense' ? colors.text.primary : toggleInactiveText,
                      fontWeight: txType === 'expense' ? '700' : '600',
                    },
                  ]}
                >
                  {t('expense')}
                </Text>
              </Pressable>
              <Pressable
                onPress={setIncome}
                disabled={incomeDisabled}
                style={[
                  styles.toggleSegment,
                  txType === 'income' && { backgroundColor: toggleActiveFill },
                  incomeDisabled && txType !== 'income' && { opacity: 0.35 },
                ]}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    {
                      color:
                        txType === 'income' ? colors.text.primary : toggleInactiveText,
                      fontWeight: txType === 'income' ? '700' : '600',
                    },
                  ]}
                >
                  {t('income')}
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.categoryLabel, { color: colors.text.secondary }]}>
              {headerLabel ? `${headerEmoji}  ${headerLabel}` : ''}
            </Text>

            <Animated.View style={[styles.displayRow, amountStyle]}>
              {meta.symbolBefore ? (
                <Text style={[styles.currency, { color: colors.text.tertiary }]}>
                  {meta.symbol}{' '}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.displayAmount,
                  { color: isZero ? colors.text.tertiary : colors.text.primary },
                ]}
              >
                {displayAmount}
              </Text>
              {!meta.symbolBefore ? (
                <Text style={[styles.currency, { color: colors.text.tertiary }]}>
                  {' '}
                  {meta.symbol}
                </Text>
              ) : null}
            </Animated.View>

            <View style={styles.numpad}>
              {KEYS.map((key) => (
                <NumpadKey key={key} label={key} onPress={() => handleKey(key)} />
              ))}
              <NumpadKey label="⌫" onPress={handleDelete} secondary />
            </View>

            <Pressable
              disabled={isZero}
              onPress={() => {
                if (!isZero) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleConfirm();
              }}
              style={({ pressed }) => [
                styles.confirmBtn,
                {
                  backgroundColor: confirmColor,
                  borderTopColor: confirmRim,
                  opacity: isZero ? 0.35 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.confirmText}>{t('doneCheck')}</Text>
            </Pressable>

            <Pressable onPress={handleCancel} style={styles.cancelBtn} hitSlop={6}>
              <Text style={[styles.cancelText, { color: colors.text.tertiary }]}>
                {t('cancel')}
              </Text>
            </Pressable>
          </View>
        </GlassSurface>
      </Animated.View>
    </>
  );
}

function NumpadKey({
  label,
  onPress,
  secondary,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressedColor =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.10)' : 'rgba(255,255,255,0.18)';
  const baseColor =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.04)' : 'rgba(255,255,255,0.08)';
  const keyBorder =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.08)' : 'rgba(255,255,255,0.10)';

  return (
    <Animated.View style={[styles.keyWrapper, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.92, SPRING.micro);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, SPRING.micro);
        }}
        style={({ pressed }) => [
          styles.key,
          { borderColor: keyBorder },
          { backgroundColor: pressed ? pressedColor : baseColor },
        ]}
      >
        <Text
          style={[
            styles.keyText,
            secondary && styles.keyTextSecondary,
            { color: secondary ? colors.text.secondary : colors.text.primary },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  modalWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 11,
  },
  sheetGlass: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  modalSurface: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  toggleTrack: {
    flexDirection: 'row',
    borderRadius: 99,
    padding: 3,
    alignSelf: 'center',
    marginBottom: 12,
  },
  toggleSegment: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 99,
    minWidth: 110,
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  categoryLabel: {
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 6,
    letterSpacing: 0.2,
    minHeight: 16,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 18,
    minHeight: 56,
  },
  currency: {
    fontSize: 22,
    fontWeight: '300',
  },
  displayAmount: {
    fontSize: 52,
    fontWeight: '200',
    letterSpacing: -1.5,
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keyWrapper: {
    width: '31.5%',
  },
  key: {
    borderRadius: RADII.button,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 0.5,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '500',
  },
  keyTextSecondary: {
    fontSize: 18,
  },
  confirmBtn: {
    width: '100%',
    borderRadius: RADII.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    alignItems: 'center',
    marginTop: 10,
    padding: 4,
  },
  cancelText: {
    fontSize: 13,
  },
});
