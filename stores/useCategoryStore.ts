// Zustand store for spending categories (bubbles)

import { SIZES } from "@/constants/theme";
import * as db from "@/lib/db";
import type { Category, Transaction } from "@/types";
import { create } from "zustand";

type CategoryState = {
  categories: Category[];
  sizes: Record<string, { size: number; total: number }>; // categoryId → computed
  loaded: boolean;

  load: () => void;
  addCategory: (cat: Omit<Category, "id" | "createdAt">) => Category;
  updatePosition: (id: string, x: number, y: number) => void;
  deleteCategory: (id: string) => void;
  recalcSizes: (transactions: Transaction[]) => void;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt">[] = [
  {
    name: "Food",
    emoji: "🍙",
    colorKey: "frost",
    positionX: 30,
    positionY: 35,
  },
  {
    name: "Transport",
    emoji: "🚃",
    colorKey: "dusk",
    positionX: 65,
    positionY: 30,
  },
  {
    name: "Coffee",
    emoji: "☕",
    colorKey: "mist",
    positionX: 50,
    positionY: 55,
  },
  {
    name: "Shopping",
    emoji: "🛍️",
    colorKey: "veil",
    positionX: 25,
    positionY: 65,
  },
  {
    name: "Bills",
    emoji: "📄",
    colorKey: "slate",
    positionX: 72,
    positionY: 60,
  },
];

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  sizes: {},
  loaded: false,

  load: () => {
    db.initDb();
    let categories = db.getAllCategories();

    if (categories.length === 0) {
      const now = Date.now();
      categories = DEFAULT_CATEGORIES.map((c, i) => {
        const cat: Category = {
          ...c,
          id: generateId() + i,
          createdAt: now + i,
        };
        db.insertCategory(cat);
        return cat;
      });
    }

    set({ categories, loaded: true });
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
    db.deleteCategory(id);
    set({ categories: get().categories.filter((c) => c.id !== id) });
  },

  recalcSizes: (transactions) => {
    const totals: Record<string, number> = {};
    for (const tx of transactions) {
      totals[tx.categoryId] = (totals[tx.categoryId] ?? 0) + tx.amount;
    }

    const maxAmount = Math.max(...Object.values(totals), 1);
    const sizes: Record<string, { size: number; total: number }> = {};

    for (const cat of get().categories) {
      const total = totals[cat.id] ?? 0;
      const ratio = total / maxAmount;
      const size =
        SIZES.BUBBLE_BASE + ratio * (SIZES.BUBBLE_MAX - SIZES.BUBBLE_BASE);
      sizes[cat.id] = { size, total };
    }

    set({ sizes });
  },
}));
