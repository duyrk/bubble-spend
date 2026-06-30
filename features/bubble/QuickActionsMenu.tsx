// iOS-style quick-actions menu — opened by long-pressing a bubble. A blurred
// backdrop dims the field and a menu pops up anchored next to the pressed bubble
// (its window frame is captured via measure() at long-press and carried in the
// UI store). Actions: Log expense, Set budget, Rearrange (→ drag mode for
// repositioning), and Delete (destructive). Set budget / Delete hand off to their
// own sheets; the store actions clear this menu's flag as they open the next one.

import { useCallback, useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useUIStore } from '@/stores/useUIStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { RADII } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';

const MENU_WIDTH = 248;
const GAP = 12; // space between the bubble edge and the menu
const SCREEN_MARGIN = 12;

export function QuickActionsMenu() {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();
  const { format } = useFormatCurrency();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const pendingActionCategoryId = useUIStore((s) => s.pendingActionCategoryId);
  const anchor = useUIStore((s) => s.pendingActionAnchor);
  const cancelBubbleActions = useUIStore((s) => s.cancelBubbleActions);
  const requestEditBudget = useUIStore((s) => s.requestEditBudget);
  const requestDeleteCategory = useUIStore((s) => s.requestDeleteCategory);
  const enterDragMode = useUIStore((s) => s.enterDragMode);
  const openModal = useUIStore((s) => s.openModal);
  const categories = useCategoryStore((s) => s.categories);

  const target = categories.find((c) => c.id === pendingActionCategoryId);
  const visible = pendingActionCategoryId !== null && target != null;

  // Pop/scale entrance.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = visible
      ? withSpring(1, { damping: 18, stiffness: 240, mass: 0.7 })
      : withTiming(0, { duration: 120 });
  }, [visible, progress]);

  // Anchor below the bubble if it's in the top half of the screen, else above.
  const openBelow = anchor ? anchor.bottom < screenH * 0.5 : true;
  const left = anchor
    ? Math.max(
        SCREEN_MARGIN,
        Math.min(anchor.cx - MENU_WIDTH / 2, screenW - MENU_WIDTH - SCREEN_MARGIN),
      )
    : SCREEN_MARGIN;
  const vertical = openBelow
    ? { top: (anchor?.bottom ?? 0) + GAP }
    : { bottom: screenH - (anchor?.top ?? 0) + GAP };

  const menuStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: 0.92 + progress.value * 0.08 },
      { translateY: (openBelow ? -1 : 1) * (1 - progress.value) * 8 },
    ],
  }));

  const close = useCallback(() => cancelBubbleActions(), [cancelBubbleActions]);

  const handleLog = useCallback(() => {
    if (!target) return;
    Haptics.selectionAsync();
    cancelBubbleActions();
    openModal(target.id);
  }, [target, cancelBubbleActions, openModal]);

  const handleBudget = useCallback(() => {
    if (!target) return;
    Haptics.selectionAsync();
    requestEditBudget(target.id);
  }, [target, requestEditBudget]);

  const handleRearrange = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cancelBubbleActions();
    enterDragMode();
  }, [cancelBubbleActions, enterDragMode]);

  const handleDelete = useCallback(() => {
    if (!target) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    requestDeleteCategory(target.id);
  }, [target, requestDeleteCategory]);

  const menuTint =
    resolvedTheme === 'light' ? 'rgba(250,250,252,0.86)' : 'rgba(30,30,42,0.86)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <BlurView
          intensity={resolvedTheme === 'light' ? 16 : 24}
          tint={resolvedTheme}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </Pressable>

      <Animated.View style={[styles.menuWrap, { left, width: MENU_WIDTH }, vertical, menuStyle]}>
        <GlassSurface
          intensity={40}
          borderRadius={RADII.card}
          surfaceTint={menuTint}
          shimmer={false}
          style={styles.menu}
        >
          {target ? (
            <View style={[styles.header, { borderBottomColor: colors.glass.border }]}>
              <Text style={styles.headerEmoji}>{target.emoji}</Text>
              <Text style={[styles.headerName, { color: colors.text.secondary }]} numberOfLines={1}>
                {target.name}
              </Text>
            </View>
          ) : null}

          <ActionRow icon="plus-circle" label={t('logExpense')} color={colors.text.primary} onPress={handleLog} />
          <View style={[styles.sep, { backgroundColor: colors.glass.border }]} />
          <ActionRow
            icon="target"
            label={t('setBudget')}
            color={colors.text.primary}
            onPress={handleBudget}
            right={target?.budget ? format(target.budget) : undefined}
            rightColor={colors.text.tertiary}
          />
          <View style={[styles.sep, { backgroundColor: colors.glass.border }]} />
          <ActionRow icon="move" label={t('rearrange')} color={colors.text.primary} onPress={handleRearrange} />
          <View style={[styles.sep, { backgroundColor: colors.glass.border }]} />
          <ActionRow icon="trash-2" label={t('deleteCategoryAction')} color={colors.danger} onPress={handleDelete} />
        </GlassSurface>
      </Animated.View>
    </Modal>
  );
}

interface ActionRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  right?: string;
  rightColor?: string;
}

function ActionRow({ icon, label, color, onPress, right, rightColor }: ActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Feather name={icon} size={18} color={color} style={styles.rowIcon} />
      <Text style={[styles.rowLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
      {right ? (
        <Text style={[styles.rowRight, { color: rightColor }]} numberOfLines={1}>
          {right}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  menuWrap: {
    position: 'absolute',
  },
  menu: {
    paddingVertical: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerEmoji: {
    fontSize: 18,
  },
  headerName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowPressed: {
    backgroundColor: 'rgba(127,127,140,0.18)',
  },
  rowIcon: {
    width: 20,
    textAlign: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  rowRight: {
    fontSize: 13,
    fontWeight: '600',
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
  },
});
