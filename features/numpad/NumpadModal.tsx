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
import * as db from '@/lib/db';
import { BLUR, RADII, SPRING, TIMING } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { Calendar } from '@/components/ui/Calendar';
import { CategoryPicker } from './CategoryPicker';
import { NoteEditor } from './NoteEditor';
import { formatShortDate, isSameDay } from '@/lib/i18n';
import {
  INCOME_CATEGORY_ID,
  type TransactionType,
  type Transaction,
  type TransactionEdit,
  type Category,
} from '@/types';

const MODAL_HEIGHT = 560;
const INCOME_COLOR = '#3DB882';

// Stamp a backdated entry at the current wall-clock time on the chosen day so it
// lands in the right day bucket and sorts naturally; today → exactly now.
function timestampFor(date: Date): number {
  const now = new Date();
  if (isSameDay(date, now)) return now.getTime();
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ).getTime();
}

interface NumpadModalProps {
  // Create flow (Home) — driven by the global UI store.
  onTransactionConfirmed?: (
    categoryId: string,
    x: number,
    y: number,
    type: TransactionType,
    txId: string,
  ) => void;
  // Edit flow (History) — when `editMode` is true the modal ignores the global
  // UI store entirely and is driven by these props. Amount, date, category
  // (expenses) and note are editable; the income/expense type stays locked.
  editMode?: boolean;
  editTransaction?: Transaction | null;
  editCategory?: Category;
  onEditClose?: () => void;
  onEditConfirm?: (id: string, fields: TransactionEdit) => void;
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
  const { t, language } = useTranslation();
  const { meta, format } = useFormatCurrency();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();

  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const categories = useCategoryStore((s) => s.categories);
  const add = useTransactionStore((s) => s.add);

  const editing = editMode === true;

  const [amount, setAmount] = useState('0');
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [recentAmounts, setRecentAmounts] = useState<number[]>([]);
  // Backdating — create flow defaults to today on open; edit flow seeds from the
  // transaction. Picking a day keeps the original time-of-day on edit.
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  // Edit-only state: the (re-assignable) category, the note text, and which
  // editor overlay is open.
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);

  // Open/close + source context resolve from either the edit props (History) or
  // the global store (create flow, Home). A given instance is driven by exactly
  // one of them: Home passes no edit props; History sets editMode.
  const isOpen = editing ? editTransaction != null : activeModal !== null;
  const createSourceId = activeModal?.categoryId ?? null;
  const sourceCategory = editing
    ? categories.find((c) => c.id === editCategoryId) ?? editCategory
    : createSourceId
      ? categories.find((c) => c.id === createSourceId)
      : undefined;

  // In edit mode the type is fixed to the transaction — both toggle segments are
  // locked. In create mode, expense is locked only at the income entry point
  // (no source bubble to flip back to).
  const expenseDisabled = editing ? true : createSourceId === null;
  const incomeDisabled = editing;

  // Source bucket for the "recent amount" chips: the tapped category for an
  // expense, the global income bucket for income, none while editing.
  const recentSourceId = editing
    ? null
    : txType === 'income'
      ? INCOME_CATEGORY_ID
      : sourceCategory?.id ?? null;

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
        setSelectedDate(new Date());
        setShowCalendar(false);
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
        setEditCategoryId(editTransaction.categoryId);
        setNote(editTransaction.note ?? '');
        setSelectedDate(new Date(editTransaction.transactedAt));
        setShowCalendar(false);
        setShowCategoryPicker(false);
        setShowNoteEditor(false);
      }
    }
  }, [editing, editTransaction]);

  // Refresh recent-amount chips whenever the sheet opens or the source/type
  // changes. The SQLite read is synchronous and cheap (small scan window).
  useEffect(() => {
    if (!isOpen || recentSourceId === null) {
      setRecentAmounts([]);
      return;
    }
    setRecentAmounts(db.getRecentAmounts(recentSourceId, txType, 3));
  }, [isOpen, recentSourceId, txType]);

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

  const applyRecent = useCallback((value: number) => {
    Haptics.selectionAsync();
    setAmount(String(value));
  }, []);

  const handleConfirm = useCallback(() => {
    const value = parseInt(amount, 10) || 0;

    // Edit flow — amount, date, category (expenses) and note can change; the
    // income/expense type stays as it was.
    if (editing) {
      if (value > 0 && editTransaction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Keep the original time-of-day; only the calendar day is editable.
        const orig = new Date(editTransaction.transactedAt);
        const transactedAt = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          orig.getHours(),
          orig.getMinutes(),
          orig.getSeconds(),
          orig.getMilliseconds(),
        ).getTime();
        const trimmedNote = note.trim();
        onEditConfirm?.(editTransaction.id, {
          amount: value,
          categoryId:
            editTransaction.type === 'income'
              ? editTransaction.categoryId
              : editCategoryId ?? editTransaction.categoryId,
          transactedAt,
          note: trimmedNote.length > 0 ? trimmedNote : undefined,
        });
      }
      onEditClose?.();
      return;
    }

    if (value <= 0) {
      closeModal();
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const at = timestampFor(selectedDate);
    if (txType === 'income') {
      const tx = add(INCOME_CATEGORY_ID, value, 'income', undefined, at);
      // For income fireworks we fire near the top-right (income pill location).
      // The Home screen handles positioning when it gets no source category.
      if (onTransactionConfirmed) {
        onTransactionConfirmed(INCOME_CATEGORY_ID, 80, 18, 'income', tx.id);
      }
    } else if (sourceCategory) {
      const tx = add(sourceCategory.id, value, 'expense', undefined, at);
      if (onTransactionConfirmed) {
        onTransactionConfirmed(
          sourceCategory.id,
          sourceCategory.positionX,
          sourceCategory.positionY,
          'expense',
          tx.id,
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
    selectedDate,
    note,
    editCategoryId,
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

  // Date pill label — "Today"/"Yesterday" for the common cases, else a short date.
  const todayDate = new Date();
  const yesterdayDate = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate() - 1,
  );
  const dateLabel = isSameDay(selectedDate, todayDate)
    ? t('today')
    : isSameDay(selectedDate, yesterdayDate)
      ? t('yesterday')
      : formatShortDate(selectedDate, language);

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

            {editing && txType === 'expense' ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowCategoryPicker(true);
                }}
                style={[
                  styles.editPill,
                  styles.categoryPill,
                  { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
                ]}
              >
                <Text
                  style={[styles.editPillText, { color: colors.text.secondary }]}
                  numberOfLines={1}
                >
                  {sourceCategory
                    ? `${sourceCategory.emoji}  ${sourceCategory.name}  ›`
                    : `${t('changeCategory')}  ›`}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.categoryLabel, { color: colors.text.secondary }]}>
                {headerLabel ? `${headerEmoji}  ${headerLabel}` : ''}
              </Text>
            )}

            <View style={styles.pillRow}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowCalendar(true);
                }}
                style={[
                  styles.editPill,
                  { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
                ]}
              >
                <Text style={[styles.editPillText, { color: colors.text.secondary }]}>
                  📅  {dateLabel}
                </Text>
              </Pressable>

              {editing ? (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowNoteEditor(true);
                  }}
                  style={[
                    styles.editPill,
                    styles.notePill,
                    { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.editPillText,
                      { color: note ? colors.text.secondary : colors.text.tertiary },
                    ]}
                    numberOfLines={1}
                  >
                    📝  {note ? note : t('addNote')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

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

            {recentAmounts.length > 0 ? (
              <View style={styles.recentRow}>
                {recentAmounts.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => applyRecent(value)}
                    style={({ pressed }) => [
                      styles.recentChip,
                      { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
                      pressed && { backgroundColor: colors.glass.borderStrong },
                    ]}
                  >
                    <Text
                      style={[styles.recentChipText, { color: colors.text.secondary }]}
                      numberOfLines={1}
                    >
                      {format(value)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

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

      {showCalendar ? (
        <View style={styles.calendarOverlay}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.calendarBackdrop]}
            onPress={() => setShowCalendar(false)}
          />
          <GlassSurface
            intensity={BLUR.sheet}
            borderRadius={RADII.sheet}
            surfaceTint={sheetTint}
            shimmer
            style={styles.calendarCard}
          >
            <Calendar
              selected={selectedDate}
              language={language}
              onSelect={(d) => {
                setSelectedDate(d);
                setShowCalendar(false);
              }}
            />
          </GlassSurface>
        </View>
      ) : null}

      {editing && isOpen && showCategoryPicker ? (
        <CategoryPicker
          categories={categories}
          selectedId={editCategoryId}
          title={t('changeCategory')}
          onSelect={(id) => {
            setEditCategoryId(id);
            setShowCategoryPicker(false);
          }}
          onClose={() => setShowCategoryPicker(false)}
        />
      ) : null}

      {editing && isOpen && showNoteEditor ? (
        <NoteEditor
          initialValue={note}
          placeholder={t('notePlaceholder')}
          saveLabel={t('save')}
          accentColor={confirmColor}
          onSave={(v) => {
            setNote(v);
            setShowNoteEditor(false);
          }}
          onClose={() => setShowNoteEditor(false)}
        />
      ) : null}
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
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 0.5,
  },
  editPillText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  categoryPill: {
    marginBottom: 10,
    maxWidth: '80%',
  },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  notePill: {
    maxWidth: 220,
  },
  calendarOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  calendarBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  calendarCard: {
    width: '100%',
    maxWidth: 360,
    padding: 16,
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
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    minHeight: 34,
  },
  recentChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 0.5,
    maxWidth: '33%',
  },
  recentChipText: {
    fontSize: 13,
    fontWeight: '600',
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
