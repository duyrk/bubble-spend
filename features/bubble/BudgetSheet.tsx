// Monthly budget editor — opened from the bubble action sheet ("Set budget").
// A bottom sheet with a numeric input for the category's monthly cap, plus a
// "Remove budget" affordance when one is already set. Saving writes through the
// category store, which updates the bubble's budget ring immediately.

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
import { BLUR } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';

export function BudgetSheet() {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();
  const { meta } = useFormatCurrency();

  const budgetEditCategoryId = useUIStore((s) => s.budgetEditCategoryId);
  const cancelEditBudget = useUIStore((s) => s.cancelEditBudget);
  const categories = useCategoryStore((s) => s.categories);
  const setBudget = useCategoryStore((s) => s.setBudget);

  const target = categories.find((c) => c.id === budgetEditCategoryId);
  const visible = budgetEditCategoryId !== null && target != null;

  const [value, setValue] = useState('');

  // Seed the field from the existing cap each time the sheet opens for a bubble.
  useEffect(() => {
    if (budgetEditCategoryId) {
      const current = categories.find((c) => c.id === budgetEditCategoryId)?.budget;
      setValue(current ? String(current) : '');
    }
    // Only re-seed when the target changes, not on every keystroke/category edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetEditCategoryId]);

  // Keep input to digits (plus a single decimal point for decimal currencies).
  const handleChange = useCallback(
    (text: string) => {
      const cleaned =
        meta.decimals > 0
          ? text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
          : text.replace(/[^0-9]/g, '');
      setValue(cleaned);
    },
    [meta.decimals],
  );

  const parsed = parseFloat(value);
  const canSave = Number.isFinite(parsed) && parsed > 0;

  const handleSave = useCallback(() => {
    if (!target || !canSave) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBudget(target.id, parsed);
    cancelEditBudget();
  }, [target, canSave, parsed, setBudget, cancelEditBudget]);

  const handleRemove = useCallback(() => {
    if (!target) return;
    Haptics.selectionAsync();
    setBudget(target.id, undefined);
    cancelEditBudget();
  }, [target, setBudget, cancelEditBudget]);

  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.82)' : 'rgba(17,17,28,0.82)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancelEditBudget}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={cancelEditBudget} />
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
                  <Text style={[styles.title, { color: colors.text.primary }]}>{t('monthlyBudget')}</Text>
                  <Text style={[styles.subtitle, { color: colors.text.tertiary }]} numberOfLines={1}>
                    {target.name} · {t('budgetSubtitle')}
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
                value={value}
                onChangeText={handleChange}
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

            {target?.budget ? (
              <Pressable onPress={handleRemove} hitSlop={8} style={styles.removeBtn}>
                <Text style={[styles.removeText, { color: colors.danger }]}>{t('removeBudget')}</Text>
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
    marginBottom: 18,
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
