// Reactive theme hooks — branch between dark/light palettes based on settings + system.

import { useColorScheme } from 'react-native';
import {
  BUBBLE_COLORS_DARK,
  BUBBLE_COLORS_LIGHT,
  COLORS_DARK,
  COLORS_LIGHT,
  type ColorPalette,
} from '@/constants/theme';
import type { BubbleColorKey } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function useResolvedTheme(): 'dark' | 'light' {
  const mode = useSettingsStore((s) => s.theme);
  const system = useColorScheme();
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

export function useColors(): ColorPalette {
  return useResolvedTheme() === 'light' ? COLORS_LIGHT : COLORS_DARK;
}

export function useBubbleColors(): Record<BubbleColorKey, { bg: string; border: string; glow: string }> {
  return useResolvedTheme() === 'light' ? BUBBLE_COLORS_LIGHT : BUBBLE_COLORS_DARK;
}
