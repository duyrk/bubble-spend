// Confirmation sheet for deleting a category. Triggered by a long-press on a
// bubble while in drag mode (see BubbleItem → requestDeleteCategory). Deleting a
// category also removes all of its transactions.

import { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useUIStore } from '@/stores/useUIStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { BLUR } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';

export function DeleteCategorySheet() {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();

  const pendingDeleteCategoryId = useUIStore((s) => s.pendingDeleteCategoryId);
  const cancelDeleteCategory = useUIStore((s) => s.cancelDeleteCategory);
  const exitDragMode = useUIStore((s) => s.exitDragMode);
  const categories = useCategoryStore((s) => s.categories);
  const deleteCategory = useCategoryStore((s) => s.deleteCategory);

  const target = categories.find((c) => c.id === pendingDeleteCategoryId);
  const visible = pendingDeleteCategoryId !== null && target != null;

  const handleConfirm = useCallback(() => {
    if (!target) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deleteCategory(target.id);
    // Reload Home's transaction slice so totals + remaining bubble sizes refresh.
    const { period, loadByPeriod } = useTransactionStore.getState();
    loadByPeriod(period);
    exitDragMode();
    cancelDeleteCategory();
  }, [target, deleteCategory, exitDragMode, cancelDeleteCategory]);

  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.82)' : 'rgba(17,17,28,0.82)';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancelDeleteCategory}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancelDeleteCategory} />
        <GlassSurface
          intensity={BLUR.modal}
          borderRadius={24}
          surfaceTint={sheetTint}
          shimmer
          style={styles.card}
        >
          <View style={styles.cardInner}>
            {target ? (
              <View style={[styles.chip, { backgroundColor: colors.glass.base, borderColor: colors.glass.border }]}>
                <Text style={styles.chipEmoji}>{target.emoji}</Text>
                <Text style={[styles.chipName, { color: colors.text.primary }]}>{target.name}</Text>
              </View>
            ) : null}

            <Text style={[styles.title, { color: colors.text.primary }]}>
              {t('deleteCategoryTitle')}
            </Text>
            <Text style={[styles.body, { color: colors.text.secondary }]}>
              {t('deleteCategoryBody')}
            </Text>

            <View style={styles.actions}>
              <Pressable
                onPress={cancelDeleteCategory}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.btnText, { color: colors.text.primary }]}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: colors.danger, borderColor: 'transparent' },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.btnText, { color: '#fff' }]}>{t('delete')}</Text>
              </Pressable>
            </View>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
  },
  cardInner: {
    padding: 22,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 0.5,
    marginBottom: 16,
  },
  chipEmoji: {
    fontSize: 20,
  },
  chipName: {
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 99,
    borderWidth: 0.5,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
