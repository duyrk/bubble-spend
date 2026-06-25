// Zustand store for spending categories (bubbles)

import * as Localization from 'expo-localization';
import { SIZES } from '@/constants/theme';
import { computeBubbleSize } from '@/lib/bubbleSize';
import * as db from '@/lib/db';
import { getDefaultCategories } from '@/lib/i18n/defaultCategories';
import { INCOME_CATEGORY_ID } from '@/types';
import type { BubbleColorKey, Category, Transaction } from '@/types';
import { create } from 'zustand';

type CategoryState = {
  categories: Category[];
  sizes: Record<string, { size: number; total: number }>; // categoryId → computed
  loaded: boolean;

  load: () => void;
  addCategory: (cat: Omit<Category, 'id' | 'createdAt'>) => Category;
  updatePosition: (id: string, x: number, y: number) => void;
  deleteCategory: (id: string) => void;
  recalcSizes: (transactions: Transaction[]) => void;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  sizes: {},
  loaded: false,

  load: () => {
    db.initDb();
    let categories = db.getAllCategories();

    if (categories.length === 0) {
      const locale = Localization.getLocales()[0]?.languageCode ?? 'en';
      const defaults = getDefaultCategories(locale);
      const now = Date.now();
      categories = defaults.map((c, i) => {
        const cat: Category = {
          name: c.name,
          emoji: c.emoji,
          colorKey: c.colorKey as BubbleColorKey,
          positionX: c.positionX,
          positionY: c.positionY,
          id: generateId() + i,
          createdAt: now + i,
        };
        db.insertCategory(cat);
        return cat;
      });
    }

    set({ categories, loaded: true });

    // Seed sizes so bubbles render at BUBBLE_BASE immediately. Without this,
    // sizes is {} on first frame and BubbleItem reads 0 until transactions load.
    get().recalcSizes([]);
  },

  addCategory: (partial) => {
    const { categories } = get();
    if (categories.length >= SIZES.BUBBLES_LIMIT) {
      throw new Error(`Cannot exceed ${SIZES.BUBBLES_LIMIT} categories`);
    }

    const cat: Category = {
      ...partial,
      id: generateId(),
      createdAt: Date.now(),
    };

    db.insertCategory(cat);
    set({ categories: [...categories, cat] });
    return cat;
  },

  updatePosition: (id, x, y) => {
    db.updateCategoryPosition(id, x, y);
    set({
      categories: get().categories.map((c) =>
        c.id === id ? { ...c, positionX: x, positionY: y } : c,
      ),
    });
  },

  deleteCategory: (id) => {
    // Cascade: drop the category row AND every transaction filed under it.
    db.deleteCategory(id);
    db.deleteTransactionsByCategory(id);
    set((state) => {
      const sizes = { ...state.sizes };
      delete sizes[id];
      return {
        categories: state.categories.filter((c) => c.id !== id),
        sizes,
      };
    });
    // Remaining bubbles are re-scaled against the new max by the caller, which
    // reloads transactions → Home's recalcSizes effect fires.
  },

  recalcSizes: (transactions) => {
    // Bubble size reflects spending only — income is global and must not inflate
    // a per-category total. We also skip the reserved income categoryId defensively.
    const totals: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      if (tx.categoryId === INCOME_CATEGORY_ID) continue;
      totals[tx.categoryId] = (totals[tx.categoryId] ?? 0) + tx.amount;
    }

    const maxAmount = Math.max(...Object.values(totals), 1);
    const sizes: Record<string, { size: number; total: number }> = {};

    for (const cat of get().categories) {
      const total = totals[cat.id] ?? 0;
      sizes[cat.id] = { size: computeBubbleSize(total, maxAmount), total };
    }

    set({ sizes });
  },
}));
