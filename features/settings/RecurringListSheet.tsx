// Recurring-templates manager — slide-up sheet listing every template (one per
// category) with its schedule and amount, plus a per-row delete. Templates are
// created from Home (long-press a bubble → "Set recurring"); this is the
// view/remove surface, so the empty state points back at that gesture.

import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useRecurringStore } from '@/stores/useRecurringStore';
import { WEEKDAYS_SHORT } from '@/lib/i18n/dates';
import { BLUR, RADII } from '@/constants/theme';
import type { Language } from '@/lib/i18n';
import type { RecurringTemplate } from '@/types';

interface RecurringListSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function RecurringListSheet({ visible, onClose }: RecurringListSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t, language } = useTranslation();
  const { format } = useFormatCurrency();

  const templates = useRecurringStore((s) => s.templates);
  const removeForCategory = useRecurringStore((s) => s.removeForCategory);
  const categories = useCategoryStore((s) => s.categories);

  // "Weekly · T2" / "Monthly · 5" — weekday labels reuse the calendar's
  // Monday-first narrow names, converted from the template's JS getDay() value.
  const scheduleLabel = (tmpl: RecurringTemplate, lang: Language): string => {
    switch (tmpl.frequency) {
      case 'daily':
        return t('freqDaily');
      case 'weekly':
        return `${t('freqWeekly')} · ${WEEKDAYS_SHORT[lang][((tmpl.dayOfWeek ?? 0) + 6) % 7]}`;
      case 'monthly':
        return `${t('freqMonthly')} · ${tmpl.dayOfMonth}`;
    }
  };

  const handleDelete = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeForCategory(categoryId);
  };

  const iosBg = resolvedTheme === 'light' ? 'rgba(255,255,255,0.78)' : 'rgba(17,17,28,0.78)';
  const sheetBg = Platform.OS === 'android' ? colors.bg.elevated : iosBg;
  const divider = resolvedTheme === 'light' ? 'rgba(13,13,20,0.07)' : 'rgba(255,255,255,0.06)';

  // A template whose category vanished can't render a row (and shouldn't exist —
  // category deletion cascades) — skip defensively.
  const rows = templates
    .map((tmpl) => ({ tmpl, category: categories.find((c) => c.id === tmpl.categoryId) }))
    .filter((r) => r.category != null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: sheetBg, borderColor: colors.glass.border, paddingBottom: insets.bottom + 16 },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={BLUR.modal} tint={resolvedTheme} style={StyleSheet.absoluteFill} />
          ) : null}
          <View
            style={[styles.shimmer, { backgroundColor: colors.glass.highlight }]}
            pointerEvents="none"
          />
          <View style={[styles.handle, { backgroundColor: colors.glass.borderStrong }]} />
          <Text style={[styles.title, { color: colors.text.primary }]}>{t('recurringExpenses')}</Text>

          {rows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>
                {t('noRecurring')}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.text.tertiary }]}>
                {t('noRecurringHint')}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {rows.map(({ tmpl, category }, idx) => (
                <View
                  key={tmpl.id}
                  style={[
                    styles.row,
                    idx !== rows.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: divider },
                  ]}
                >
                  <Text style={styles.rowEmoji}>{category!.emoji}</Text>
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowName, { color: colors.text.primary }]} numberOfLines={1}>
                      {category!.name}
                    </Text>
                    <Text style={[styles.rowDetail, { color: colors.text.secondary }]} numberOfLines={1}>
                      {scheduleLabel(tmpl, language)}
                      {tmpl.note ? ` · ${tmpl.note}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: colors.text.primary }]}>
                    {format(tmpl.amount)}
                  </Text>
                  <Pressable
                    onPress={() => handleDelete(tmpl.categoryId)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Feather name="trash-2" size={17} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    paddingTop: 8,
    paddingHorizontal: 16,
    maxHeight: '70%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 6,
  },
  rowEmoji: {
    fontSize: 22,
  },
  rowLeft: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 4,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 12,
  },
});
