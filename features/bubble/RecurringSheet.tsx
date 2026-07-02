// Recurring-template editor — opened from the bubble quick-actions menu ("Set
// recurring"). A bottom sheet with an amount, a daily/weekly/monthly frequency
// toggle (plus weekday or day-of-month pickers), and an optional note. Saving
// writes through the recurring store; the template then auto-logs an expense on
// each matching app open. Max one template per category — opening the sheet for
// a bubble that already has one seeds the form so saving edits in place.

import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useUIStore } from '@/stores/useUIStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useRecurringStore } from '@/stores/useRecurringStore';
import { WEEKDAYS_SHORT } from '@/lib/i18n/dates';
import { BLUR } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';
import type { RecurringFrequency } from '@/types';

const FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly'];
// Pills render Monday-first (matching the calendar); each maps to a JS getDay() value.
const WEEKDAY_JS_DAYS = [1, 2, 3, 4, 5, 6, 0];

export function RecurringSheet() {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t, language } = useTranslation();
  const { meta } = useFormatCurrency();

  const recurringEditCategoryId = useUIStore((s) => s.recurringEditCategoryId);
  const cancelEditRecurring = useUIStore((s) => s.cancelEditRecurring);
  const categories = useCategoryStore((s) => s.categories);
  const templates = useRecurringStore((s) => s.templates);
  const setForCategory = useRecurringStore((s) => s.setForCategory);
  const removeForCategory = useRecurringStore((s) => s.removeForCategory);

  const target = categories.find((c) => c.id === recurringEditCategoryId);
  const existing = templates.find((tmpl) => tmpl.categoryId === recurringEditCategoryId);
  const visible = recurringEditCategoryId !== null && target != null;

  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [weekday, setWeekday] = useState(new Date().getDay());
  const [monthDay, setMonthDay] = useState('1');
  const [note, setNote] = useState('');

  // Seed the form each time the sheet opens — from the category's existing
  // template when there is one, otherwise sensible defaults ("today").
  useEffect(() => {
    if (!recurringEditCategoryId) return;
    const current = useRecurringStore
      .getState()
      .templates.find((tmpl) => tmpl.categoryId === recurringEditCategoryId);
    const now = new Date();
    setAmount(current ? String(current.amount) : '');
    setFrequency(current?.frequency ?? 'monthly');
    setWeekday(current?.dayOfWeek ?? now.getDay());
    setMonthDay(String(current?.dayOfMonth ?? Math.min(now.getDate(), 28)));
    setNote(current?.note ?? '');
  }, [recurringEditCategoryId]);

  // Keep input to digits (plus a single decimal point for decimal currencies).
  const handleAmountChange = useCallback(
    (text: string) => {
      const cleaned =
        meta.decimals > 0
          ? text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
          : text.replace(/[^0-9]/g, '');
      setAmount(cleaned);
    },
    [meta.decimals],
  );

  const handleMonthDayChange = useCallback((text: string) => {
    setMonthDay(text.replace(/[^0-9]/g, ''));
  }, []);

  const parsedAmount = parseFloat(amount);
  const parsedDay = parseInt(monthDay, 10);
  const canSave =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    (frequency !== 'monthly' || (parsedDay >= 1 && parsedDay <= 28));

  const handleSave = useCallback(() => {
    if (!target || !canSave) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setForCategory({
      categoryId: target.id,
      amount: parsedAmount,
      note: note.trim() || undefined,
      frequency,
      dayOfWeek: frequency === 'weekly' ? weekday : undefined,
      dayOfMonth: frequency === 'monthly' ? parsedDay : undefined,
    });
    cancelEditRecurring();
  }, [target, canSave, parsedAmount, note, frequency, weekday, parsedDay, setForCategory, cancelEditRecurring]);

  const handleRemove = useCallback(() => {
    if (!target) return;
    Haptics.selectionAsync();
    removeForCategory(target.id);
    cancelEditRecurring();
  }, [target, removeForCategory, cancelEditRecurring]);

  const freqLabel = (f: RecurringFrequency) =>
    f === 'daily' ? t('freqDaily') : f === 'weekly' ? t('freqWeekly') : t('freqMonthly');

  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.82)' : 'rgba(17,17,28,0.82)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancelEditRecurring}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={cancelEditRecurring} />
        <GlassSurface
          intensity={BLUR.sheet}
          borderRadius={20}
          surfaceTint={sheetTint}
          shimmer
          style={styles.sheetGlass}
        >
          <View style={styles.sheet}>
            <View style={[styles.handle, { backgroundColor: colors.glass.border }]} />

            {target ? (
              <View style={styles.headerRow}>
                <Text style={styles.headerEmoji}>{target.emoji}</Text>
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: colors.text.primary }]}>{t('recurringTitle')}</Text>
                  <Text style={[styles.subtitle, { color: colors.text.tertiary }]} numberOfLines={1}>
                    {target.name} · {t('recurringSubtitle')}
                  </Text>
                </View>
              </View>
            ) : null}

            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
              ]}
            >
              {meta.symbolBefore ? (
                <Text style={[styles.symbol, { color: colors.text.secondary }]}>{meta.symbol}</Text>
              ) : null}
              <TextInput
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="numeric"
                autoFocus
                maxLength={12}
                style={[styles.input, { color: colors.text.primary }]}
              />
              {!meta.symbolBefore ? (
                <Text style={[styles.symbol, { color: colors.text.secondary }]}>{meta.symbol}</Text>
              ) : null}
            </View>

            <View style={styles.freqRow}>
              {FREQUENCIES.map((f) => {
                const selected = f === frequency;
                return (
                  <Pressable
                    key={f}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setFrequency(f);
                    }}
                    style={[
                      styles.freqPill,
                      selected
                        ? { backgroundColor: colors.accent }
                        : { backgroundColor: colors.glass.base, borderColor: colors.glass.border, borderWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    <Text
                      style={[
                        styles.freqPillText,
                        { color: selected ? '#fff' : colors.text.secondary },
                      ]}
                    >
                      {freqLabel(f)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {frequency === 'weekly' ? (
              <View style={styles.weekdayRow}>
                {WEEKDAY_JS_DAYS.map((jsDay, i) => {
                  const selected = jsDay === weekday;
                  return (
                    <Pressable
                      key={jsDay}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setWeekday(jsDay);
                      }}
                      style={[
                        styles.weekdayPill,
                        selected
                          ? { backgroundColor: colors.accent }
                          : { backgroundColor: colors.glass.base, borderColor: colors.glass.border, borderWidth: StyleSheet.hairlineWidth },
                      ]}
                    >
                      <Text
                        style={[
                          styles.weekdayPillText,
                          { color: selected ? '#fff' : colors.text.secondary },
                        ]}
                      >
                        {WEEKDAYS_SHORT[language][i]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {frequency === 'monthly' ? (
              <View
                style={[
                  styles.monthDayRow,
                  { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
                ]}
              >
                <Text style={[styles.monthDayLabel, { color: colors.text.secondary }]}>
                  {t('dayOfMonthLabel')}
                </Text>
                <TextInput
                  value={monthDay}
                  onChangeText={handleMonthDayChange}
                  placeholder="1"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="numeric"
                  maxLength={2}
                  style={[styles.monthDayInput, { color: colors.text.primary }]}
                />
                <Text style={[styles.monthDayHint, { color: colors.text.tertiary }]}>1–28</Text>
              </View>
            ) : null}

            <View
              style={[
                styles.noteRow,
                { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
              ]}
            >
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('notePlaceholder')}
                placeholderTextColor={colors.text.tertiary}
                maxLength={80}
                style={[styles.noteInput, { color: colors.text.primary }]}
              />
            </View>

            <Pressable
              disabled={!canSave}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.accent, opacity: !canSave ? 0.35 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.saveBtnText}>{t('save')}</Text>
            </Pressable>

            {existing ? (
              <Pressable onPress={handleRemove} hitSlop={8} style={styles.removeBtn}>
                <Text style={[styles.removeText, { color: colors.danger }]}>{t('removeRecurring')}</Text>
              </Pressable>
            ) : null}
          </View>
        </GlassSurface>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetGlass: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sheet: {
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  headerEmoji: {
    fontSize: 30,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  symbol: {
    fontSize: 22,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    padding: 0,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  freqPill: {
    flex: 1,
    borderRadius: 99,
    paddingVertical: 10,
    alignItems: 'center',
  },
  freqPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  weekdayPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
  },
  monthDayLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  monthDayInput: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
    padding: 0,
  },
  monthDayHint: {
    fontSize: 12,
  },
  noteRow: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 18,
  },
  noteInput: {
    fontSize: 14,
    padding: 0,
  },
  saveBtn: {
    borderRadius: 99,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  removeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  removeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
