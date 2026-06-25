// Centered overlay for re-assigning an expense to a different bubble (edit flow).
// Mirrors the numpad's calendar overlay: dim backdrop + a glass card. Each chip
// is a category; the current one is highlighted.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useBubbleColors, useColors, useResolvedTheme } from '@/hooks/useTheme';
import { BLUR, RADII } from '@/constants/theme';
import type { Category } from '@/types';

interface CategoryPickerProps {
  categories: Category[];
  selectedId: string | null;
  title: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function CategoryPicker({
  categories,
  selectedId,
  title,
  onSelect,
  onClose,
}: CategoryPickerProps) {
  const colors = useColors();
  const bubbleColors = useBubbleColors();
  const resolvedTheme = useResolvedTheme();
  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.72)' : 'rgba(17,17,28,0.72)';

  return (
    <View style={styles.overlay}>
      <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
      <GlassSurface
        intensity={BLUR.sheet}
        borderRadius={RADII.sheet}
        surfaceTint={sheetTint}
        shimmer
        style={styles.card}
      >
        <Text style={[styles.title, { color: colors.text.secondary }]}>{title}</Text>
        <View style={styles.grid}>
          {categories.map((cat) => {
            const isSelected = cat.id === selectedId;
            const swatch = bubbleColors[cat.colorKey];
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelect(cat.id);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? swatch.bg : colors.glass.base,
                    borderColor: isSelected ? swatch.border : colors.glass.border,
                  },
                ]}
              >
                <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                <Text
                  style={[styles.chipLabel, { color: colors.text.primary }]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 14,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 99,
    borderWidth: 0.5,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 120,
  },
});
