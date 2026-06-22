// Locale-aware seed categories. Add a new locale here and TypeScript will
// enforce that translations and locale-label maps include it too.

import type { Category } from '@/types';

type DefaultCategory = Omit<Category, 'id' | 'createdAt'>;

const DEFAULT_CATEGORIES = {
  vi: [
    { name: 'Ăn uống', emoji: '🍜', colorKey: 'frost', positionX: 28, positionY: 32 },
    { name: 'Grab', emoji: '🛵', colorKey: 'dusk', positionX: 68, positionY: 25 },
    { name: 'Cà phê', emoji: '☕', colorKey: 'mist', positionX: 48, positionY: 52 },
    { name: 'Mua sắm', emoji: '🛍️', colorKey: 'veil', positionX: 22, positionY: 68 },
    { name: 'Nhà ở', emoji: '🏠', colorKey: 'slate', positionX: 73, positionY: 63 },
  ],
  en: [
    { name: 'Food', emoji: '🍔', colorKey: 'frost', positionX: 28, positionY: 32 },
    { name: 'Transport', emoji: '🚗', colorKey: 'dusk', positionX: 68, positionY: 25 },
    { name: 'Coffee', emoji: '☕', colorKey: 'mist', positionX: 48, positionY: 52 },
    { name: 'Shopping', emoji: '🛍️', colorKey: 'veil', positionX: 22, positionY: 68 },
    { name: 'Housing', emoji: '🏠', colorKey: 'slate', positionX: 73, positionY: 63 },
  ],
} as const satisfies Record<string, readonly DefaultCategory[]>;

export type LocaleCode = keyof typeof DEFAULT_CATEGORIES;

const FALLBACK: LocaleCode = 'en';

export function getDefaultCategories(locale: string): readonly DefaultCategory[] {
  return DEFAULT_CATEGORIES[locale as LocaleCode] ?? DEFAULT_CATEGORIES[FALLBACK];
}

export const SUPPORTED_LOCALES = Object.keys(DEFAULT_CATEGORIES) as readonly LocaleCode[];
