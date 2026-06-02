// Floating "+" button to add a new category — shows a quick-pick sheet of presets

import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { BLUR, SIZES } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';
import type { BubbleColorKey } from '@/types';

const COLOR_KEYS: BubbleColorKey[] = ['frost', 'mist', 'dusk', 'slate', 'ash', 'haze', 'veil', 'smoke'];

const PRESETS: { emoji: string; name: string }[] = [
  { emoji: '🍔', name: 'Snacks' },
  { emoji: '🍱', name: 'Lunch' },
  { emoji: '🥤', name: 'Drinks' },
  { emoji: '⛽', name: 'Fuel' },
  { emoji: '🎮', name: 'Games' },
  { emoji: '📚', name: 'Books' },
  { emoji: '✈️', name: 'Travel' },
  { emoji: '🏥', name: 'Health' },
  { emoji: '🎁', name: 'Gifts' },
  { emoji: '🐾', name: 'Pets' },
  { emoji: '🏠', name: 'Home' },
  { emoji: '💄', name: 'Beauty' },
];

const FAB_SIZE = 44;

export function AddCategorySheet() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();
  const categories = useCategoryStore((s) => s.categories);
  const addCategory = useCategoryStore((s) => s.addCategory);

  const [open, setOpen] = useState(false);

  const atLimit = categories.length >= SIZES.BUBBLES_LIMIT;

  const handleAdd = useCallback(
    (preset: { emoji: string; name: string }) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const colorKey = COLOR_KEYS[categories.length % COLOR_KEYS.length];
      addCategory({
        name: preset.name,
        emoji: preset.emoji,
        colorKey,
        positionX: 30 + Math.random() * 40,
        positionY: 35 + Math.random() * 35,
      });
      setOpen(false);
    },
    [addCategory, categories.length],
  );

  if (atLimit) return null;

  const fabRim =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)';
  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.82)' : 'rgba(17,17,28,0.82)';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.fabHost, { bottom: insets.bottom + 84 }]}
        hitSlop={8}
      >
        <View style={styles.fab}>
          {/* Liquid Glass FAB circle — same recipe as bubbles, scaled down */}
          <GlassSurface
            borderRadius={FAB_SIZE / 2}
            intensity={28}
            shimmer={false}
            style={StyleSheet.absoluteFill}
          />
          {/* Specular highlight arc — top sheen */}
          <View pointerEvents="none" style={styles.fabSpecularHost}>
            <LinearGradient
              colors={[fabRim, 'rgba(255,255,255,0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.fabSpecular}
            />
          </View>
          <Text style={[styles.fabIcon, { color: colors.text.secondary }]}>+</Text>
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <GlassSurface
            intensity={BLUR.sheet}
            borderRadius={20}
            surfaceTint={sheetTint}
            shimmer
            style={styles.sheetGlass}
          >
            <View style={styles.sheet}>
              <View style={[styles.handle, { backgroundColor: colors.glass.border }]} />
              <Text style={[styles.title, { color: colors.text.primary }]}>{t('addCategory')}</Text>
              <ScrollView contentContainerStyle={styles.grid}>
                {PRESETS.map((p) => (
                  <Pressable
                    key={p.emoji}
                    onPress={() => handleAdd(p)}
                    style={({ pressed }) => [
                      styles.cell,
                      { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
                      pressed && { backgroundColor: colors.glass.borderStrong, transform: [{ scale: 0.95 }] },
                    ]}
                  >
                    <Text style={styles.cellEmoji}>{p.emoji}</Text>
                    <Text style={[styles.cellName, { color: colors.text.primary }]}>{p.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabHost: {
    position: 'absolute',
    right: 16,
    width: FAB_SIZE,
    height: FAB_SIZE,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fabSpecularHost: {
    position: 'absolute',
    top: 3,
    left: 7,
    width: 30,
    height: 14,
    borderRadius: 14,
    overflow: 'hidden',
    transform: [{ rotate: '-18deg' }],
  },
  fabSpecular: {
    flex: 1,
  },
  fabIcon: {
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 26,
  },
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
    maxHeight: '70%',
  },
  sheet: {
    padding: 16,
    paddingBottom: 32,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '31%',
    aspectRatio: 1.1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cellEmoji: {
    fontSize: 26,
  },
  cellName: {
    fontSize: 11,
    fontWeight: '600',
  },
});
