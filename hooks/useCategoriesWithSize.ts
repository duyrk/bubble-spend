// Derives CategoryWithSize[] from the category store.
// Rule A: never compute inside Zustand selectors — select slices + useMemo.

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { SIZES } from '@/constants/theme';
import type { CategoryWithSize } from '@/types';

export function useCategoriesWithSize(): CategoryWithSize[] {
  const categories = useCategoryStore(useShallow((s) => s.categories));
  const sizes = useCategoryStore(useShallow((s) => s.sizes));

  return useMemo(
    () =>
      categories.map((c) => ({
        ...c,
        size: sizes[c.id]?.size ?? SIZES.BUBBLE_BASE,
        total: sizes[c.id]?.total ?? 0,
      })),
    [categories, sizes],
  );
}
