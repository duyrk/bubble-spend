// Uncategorized inbox — auto-captured expenses whose merchant matched no
// learned rule or dictionary entry. One tap on a bubble chip logs the expense
// there and teaches the rule, so the next payment to the same merchant files
// itself. "Not spending" drops it (a transfer the classifier missed, a refund…).

import { useEffect } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useBubbleColors, useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { BLUR, RADII } from '@/constants/theme';
import type { StoredCapture } from '@/types';

interface CaptureInboxSheetProps {
  visible: boolean;
  onClose: () => void;
}

const SOURCE_LABEL: Record<StoredCapture['source'], string> = {
  momo: 'MoMo',
  acb: 'ACB',
  other: '',
};

const formatWhen = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// What the user recognises the payment by: the parsed counterparty, else the
// first line of the notification body.
const titleOf = (c: StoredCapture) =>
  c.description || c.text.split('\n').slice(-1)[0] || SOURCE_LABEL[c.source];

export function CaptureInboxSheet({ visible, onClose }: CaptureInboxSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const bubbleColors = useBubbleColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();
  const { format } = useFormatCurrency();

  const pending = useCaptureStore((s) => s.pending);
  const assign = useCaptureStore((s) => s.assign);
  const dismiss = useCaptureStore((s) => s.dismiss);
  const categories = useCategoryStore((s) => s.categories);

  // Nothing left to file — close by itself.
  useEffect(() => {
    if (visible && pending.length === 0) onClose();
  }, [visible, pending.length, onClose]);

  const handleAssign = (captureId: string, categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    assign(captureId, categoryId);
  };

  const handleDismiss = (captureId: string) => {
    Haptics.selectionAsync();
    dismiss(captureId);
  };

  const iosBg = resolvedTheme === 'light' ? 'rgba(255,255,255,0.78)' : 'rgba(17,17,28,0.78)';
  const sheetBg = Platform.OS === 'android' ? colors.bg.elevated : iosBg;
  const divider = resolvedTheme === 'light' ? 'rgba(13,13,20,0.07)' : 'rgba(255,255,255,0.06)';
  const chipBg = resolvedTheme === 'light' ? 'rgba(13,13,20,0.05)' : 'rgba(255,255,255,0.07)';

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
          <View style={[styles.handle, { backgroundColor: colors.glass.borderStrong }]} />
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {t('uncategorizedTitle')} ({pending.length})
          </Text>
          <Text style={[styles.hint, { color: colors.text.tertiary }]}>{t('uncategorizedHint')}</Text>

          <ScrollView style={styles.list}>
            {pending.map((c, idx) => (
              <View
                key={c.captureId}
                style={[
                  styles.row,
                  idx !== pending.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: divider },
                ]}
              >
                <View style={styles.rowHead}>
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowTitle, { color: colors.text.primary }]} numberOfLines={1}>
                      {titleOf(c)}
                    </Text>
                    <Text style={[styles.rowMeta, { color: colors.text.secondary }]}>
                      {[SOURCE_LABEL[c.source], formatWhen(c.occurredAt)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: colors.text.primary }]}>{format(c.amount)}</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => handleAssign(c.captureId, cat.id)}
                      style={({ pressed }) => [
                        styles.chip,
                        { backgroundColor: bubbleColors[cat.colorKey].glassFill, borderColor: colors.glass.border },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                      <Text style={[styles.chipLabel, { color: colors.text.primary }]} numberOfLines={1}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => handleDismiss(c.captureId)}
                    style={({ pressed }) => [
                      styles.chip,
                      { backgroundColor: chipBg, borderColor: colors.glass.border },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={[styles.chipLabel, { color: colors.text.secondary }]}>{t('notSpending')}</Text>
                  </Pressable>
                </ScrollView>
              </View>
            ))}
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
    maxHeight: '80%',
    borderWidth: 1,
    overflow: 'hidden',
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
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    paddingVertical: 12,
    gap: 10,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  rowLeft: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  chips: {
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADII.pill,
    borderWidth: 0.5,
    maxWidth: 160,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
});
