// Liquid Glass design tokens — dark + light palettes, single source of truth.
// Inspired by iOS 26 / visionOS materials: layered translucency with depth via blur.

import type { BubbleColorKey } from '@/types';

export type ColorPalette = {
  bg: { primary: string; elevated: string; overlay: string };
  glass: {
    base: string;
    border: string;
    borderStrong: string;
    highlight: string;
    glow: string;
  };
  text: { primary: string; secondary: string; tertiary: string; accent: string };
  accent: string;
  confirm: string;
  danger: string;
  success: string;
};

export const COLORS_DARK: ColorPalette = {
  bg: {
    primary: '#0A0A12',
    elevated: '#11111C',
    overlay: 'rgba(255,255,255,0.04)',
  },
  glass: {
    base: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.12)',
    borderStrong: 'rgba(255,255,255,0.22)',
    highlight: 'rgba(255,255,255,0.06)',
    glow: 'rgba(124,106,247,0.18)',
  },
  text: {
    primary: 'rgba(255,255,255,0.92)',
    secondary: 'rgba(255,255,255,0.45)',
    tertiary: 'rgba(255,255,255,0.22)',
    accent: '#7C6AF7',
  },
  accent: '#7C6AF7',
  confirm: '#7C6AF7',
  danger: '#FF453A',
  success: '#30D158',
};

export const COLORS_LIGHT: ColorPalette = {
  bg: {
    primary: '#F4F3F8',
    elevated: '#FFFFFF',
    overlay: 'rgba(13,13,20,0.04)',
  },
  glass: {
    base: 'rgba(13,13,20,0.04)',
    border: 'rgba(13,13,20,0.10)',
    borderStrong: 'rgba(13,13,20,0.18)',
    highlight: 'rgba(255,255,255,0.55)', // shimmer reads bright on light glass
    glow: 'rgba(124,106,247,0.16)',
  },
  text: {
    primary: 'rgba(13,13,20,0.92)',
    secondary: 'rgba(13,13,20,0.55)',
    tertiary: 'rgba(13,13,20,0.30)',
    accent: '#7C6AF7',
  },
  accent: '#7C6AF7',
  confirm: '#7C6AF7',
  danger: '#FF453A',
  success: '#30D158',
};

// COLORS = dark default. Files that need theme reactivity use `useColors()`.
// COLORS stays for module-load contexts where a hook can't run.
export const COLORS = COLORS_DARK;

type BubbleSwatch = { bg: string; border: string; glow: string };

export const BUBBLE_COLORS_DARK: Record<BubbleColorKey, BubbleSwatch> = {
  frost: { bg: 'rgba(200,220,255,0.11)', border: 'rgba(200,220,255,0.22)', glow: 'rgba(180,200,255,0.25)' },
  mist:  { bg: 'rgba(180,200,240,0.10)', border: 'rgba(180,200,240,0.20)', glow: 'rgba(160,185,235,0.22)' },
  dusk:  { bg: 'rgba(160,130,255,0.12)', border: 'rgba(160,130,255,0.24)', glow: 'rgba(140,110,245,0.28)' },
  slate: { bg: 'rgba(130,160,200,0.10)', border: 'rgba(130,160,200,0.20)', glow: 'rgba(120,150,190,0.22)' },
  ash:   { bg: 'rgba(200,200,220,0.09)', border: 'rgba(200,200,220,0.18)', glow: 'rgba(190,190,215,0.20)' },
  haze:  { bg: 'rgba(180,160,240,0.11)', border: 'rgba(180,160,240,0.22)', glow: 'rgba(165,145,230,0.25)' },
  veil:  { bg: 'rgba(155,200,230,0.10)', border: 'rgba(155,200,230,0.20)', glow: 'rgba(140,190,225,0.22)' },
  smoke: { bg: 'rgba(170,180,200,0.09)', border: 'rgba(170,180,200,0.18)', glow: 'rgba(160,170,195,0.20)' },
};

export const BUBBLE_COLORS_LIGHT: Record<BubbleColorKey, BubbleSwatch> = {
  frost: { bg: 'rgba(80,130,210,0.16)',  border: 'rgba(80,130,210,0.30)',  glow: 'rgba(80,130,210,0.30)' },
  mist:  { bg: 'rgba(110,135,200,0.15)', border: 'rgba(110,135,200,0.28)', glow: 'rgba(110,135,200,0.28)' },
  dusk:  { bg: 'rgba(120,90,230,0.16)',  border: 'rgba(120,90,230,0.30)',  glow: 'rgba(120,90,230,0.30)' },
  slate: { bg: 'rgba(70,110,160,0.15)',  border: 'rgba(70,110,160,0.28)',  glow: 'rgba(70,110,160,0.28)' },
  ash:   { bg: 'rgba(110,110,140,0.13)', border: 'rgba(110,110,140,0.26)', glow: 'rgba(110,110,140,0.26)' },
  haze:  { bg: 'rgba(140,110,220,0.15)', border: 'rgba(140,110,220,0.28)', glow: 'rgba(140,110,220,0.28)' },
  veil:  { bg: 'rgba(80,150,200,0.15)',  border: 'rgba(80,150,200,0.28)',  glow: 'rgba(80,150,200,0.28)' },
  smoke: { bg: 'rgba(110,120,150,0.13)', border: 'rgba(110,120,150,0.26)', glow: 'rgba(110,120,150,0.26)' },
};

export const BUBBLE_COLORS = BUBBLE_COLORS_DARK;

export const SIZES = {
  BUBBLE_BASE: 76,
  BUBBLE_MAX: 118,
  BUBBLES_LIMIT: 8,
} as const;

export const RADII = {
  bubble: 999,
  sheet: 28,
  modal: 24,
  card: 18,
  pill: 99,
  button: 14,
  input: 12,
} as const;

export const BLUR = {
  bubble: 24,
  sheet: 40,
  modal: 32,
  tabBar: 50,
} as const;

export const SPRING = {
  responsive: { damping: 18, stiffness: 220, mass: 0.8 },
  sheet: { damping: 26, stiffness: 180, mass: 1.0 },
  parallax: { damping: 30, stiffness: 120, mass: 1.2 },
  micro: { damping: 15, stiffness: 380, mass: 0.5 },
} as const;

export const TIMING = {
  fast: 150,
  normal: 280,
  slow: 450,
} as const;
