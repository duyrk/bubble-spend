// Liquid Glass single-select picker — slides up from bottom, adapts to theme.

import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { BLUR, RADII } from '@/constants/theme';

export interface OptionItem<T extends string> {
  value: T;
  label: string;
  detail?: string;
}

interface OptionPickerModalProps<T extends string> {
  visible: boolean;
  title: string;
  options: OptionItem<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

export function OptionPickerModal<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: OptionPickerModalProps<T>) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();

  const iosBg = resolvedTheme === 'light' ? 'rgba(255,255,255,0.78)' : 'rgba(17,17,28,0.78)';
  const sheetBg = Platform.OS === 'android' ? colors.bg.elevated : iosBg;
  const divider = resolvedTheme === 'light' ? 'rgba(13,13,20,0.07)' : 'rgba(255,255,255,0.06)';
  const pressedBg = resolvedTheme === 'light' ? 'rgba(13,13,20,0.04)' : 'rgba(255,255,255,0.05)';

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
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>

          <ScrollView style={styles.list}>
            {options.map((opt, idx) => {
              const isSelected = opt.value === selected;
              const isLast = idx === options.length - 1;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    !isLast && { borderBottomWidth: 0.5, borderBottomColor: divider },
                    pressed && { backgroundColor: pressedBg },
                  ]}
                >
                  <View style={styles.rowLeft}>
                    <Text style={[styles.optionLabel, { color: colors.text.primary }]}>
                      {opt.label}
                    </Text>
                    {opt.detail ? (
                      <Text style={[styles.optionDetail, { color: colors.text.secondary }]}>
                        {opt.detail}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Text style={[styles.check, { color: colors.accent }]}>✓</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
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
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  rowLeft: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  optionDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  check: {
    fontSize: 18,
    fontWeight: '700',
  },
});
