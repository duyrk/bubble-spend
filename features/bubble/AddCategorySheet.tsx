// Floating "+" button to add a new category. Two-step sheet:
//   1. Preset grid (quick-pick) — or tap "Custom" to start blank
//   2. Customise — pick an emoji + type a name, then Add
// Color key is auto-assigned by cycling the 8 bubble colors; the 8-bubble hard
// limit hides the whole control.

import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

// ~40 common spending icons for the custom picker.
const EMOJIS: string[] = [
  '🍔', '🍱', '🥤', '☕', '🍜', '🍕', '🍺', '🍰',
  '🛒', '🛍️', '👕', '👟', '💄', '🎁', '🎮', '🎬',
  '🎧', '📚', '✈️', '🚗', '🛵', '⛽', '🚌', '🚇',
  '🏠', '💡', '📱', '💊', '🏥', '🐾', '💇', '🏋️',
  '⚽', '🎵', '🧾', '💳', '🌿', '🍎', '🧴', '🎨',
];

const FAB_SIZE = 44;

type Step = 'preset' | 'customize';

export function AddCategorySheet() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();
  const categories = useCategoryStore((s) => s.categories);
  const addCategory = useCategoryStore((s) => s.addCategory);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('preset');
  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');

  const atLimit = categories.length >= SIZES.BUBBLES_LIMIT;

  const close = useCallback(() => {
    setOpen(false);
    setStep('preset');
    setEmoji('');
    setName('');
  }, []);

  const pickPreset = useCallback((preset: { emoji: string; name: string }) => {
    Haptics.selectionAsync();
    setEmoji(preset.emoji);
    setName(preset.name);
    setStep('customize');
  }, []);

  const startCustom = useCallback(() => {
    Haptics.selectionAsync();
    // Default to a valid emoji so Add is gated only by the name (per spec).
    setEmoji(EMOJIS[0]);
    setName('');
    setStep('customize');
  }, []);

  const confirmAdd = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed || !emoji) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const colorKey = COLOR_KEYS[categories.length % COLOR_KEYS.length];
    addCategory({
      name: trimmed.slice(0, 20),
      emoji,
      colorKey,
      positionX: 30 + Math.random() * 40,
      positionY: 35 + Math.random() * 35,
    });
    close();
  }, [name, emoji, categories.length, addCategory, close]);

  if (atLimit) return null;

  const fabRim =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)';
  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.82)' : 'rgba(17,17,28,0.82)';

  const addDisabled = name.trim() === '';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.fabHost, { bottom: insets.bottom + 84 }]}
        hitSlop={8}
      >
        <View style={styles.fab}>
          <GlassSurface
            borderRadius={FAB_SIZE / 2}
            intensity={28}
            shimmer={false}
            style={StyleSheet.absoluteFill}
          />
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

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <GlassSurface
            intensity={BLUR.sheet}
            borderRadius={20}
            surfaceTint={sheetTint}
            shimmer
            style={styles.sheetGlass}
          >
            {step === 'preset' ? (
              <View style={styles.sheet}>
                <View style={[styles.handle, { backgroundColor: colors.glass.border }]} />
                <View style={styles.headerRow}>
                  <Text style={[styles.title, { color: colors.text.primary }]}>
                    {t('addCategory')}
                  </Text>
                  <Pressable onPress={startCustom} hitSlop={8}>
                    <Text style={[styles.customLink, { color: colors.accent }]}>
                      {t('custom')} ›
                    </Text>
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.grid}>
                  {PRESETS.map((p) => (
                    <Pressable
                      key={p.emoji}
                      onPress={() => pickPreset(p)}
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
            ) : (
              <View style={styles.sheet}>
                <View style={[styles.handle, { backgroundColor: colors.glass.border }]} />
                <View style={styles.headerRow}>
                  <Pressable onPress={() => setStep('preset')} hitSlop={8}>
                    <Text style={[styles.backText, { color: colors.text.secondary }]}>
                      ‹ {t('back')}
                    </Text>
                  </Pressable>
                </View>

                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t('categoryName')}
                  placeholderTextColor={colors.text.tertiary}
                  maxLength={20}
                  autoFocus
                  style={[
                    styles.input,
                    {
                      color: colors.text.primary,
                      backgroundColor: colors.glass.base,
                      borderColor: colors.glass.border,
                    },
                  ]}
                />

                <Text style={[styles.sectionLabel, { color: colors.text.tertiary }]}>
                  {t('chooseIcon')}
                </Text>
                <ScrollView
                  style={styles.emojiScroll}
                  contentContainerStyle={styles.emojiGrid}
                  keyboardShouldPersistTaps="handled"
                >
                  {EMOJIS.map((e) => {
                    const selected = e === emoji;
                    return (
                      <Pressable
                        key={e}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setEmoji(e);
                        }}
                        style={[
                          styles.emojiCell,
                          {
                            borderColor: selected ? colors.accent : colors.glass.border,
                            backgroundColor: selected ? colors.glass.borderStrong : colors.glass.base,
                          },
                        ]}
                      >
                        <Text style={styles.emojiCellText}>{e}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  disabled={addDisabled}
                  onPress={confirmAdd}
                  style={({ pressed }) => [
                    styles.addBtn,
                    {
                      backgroundColor: colors.accent,
                      opacity: addDisabled ? 0.35 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={styles.addBtnText}>{t('add')}</Text>
                </Pressable>
              </View>
            )}
          </GlassSurface>
        </KeyboardAvoidingView>
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
    maxHeight: '80%',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
    minHeight: 22,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  customLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
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
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  emojiScroll: {
    maxHeight: 176,
    marginBottom: 16,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiCell: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCellText: {
    fontSize: 24,
  },
  addBtn: {
    borderRadius: 99,
    paddingVertical: 15,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
