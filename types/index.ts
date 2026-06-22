// Core data types for Bubble Spend

export type Period = 'today' | 'yesterday' | 'week' | 'month';

export type BubbleColorKey =
  | 'frost'
  | 'mist'
  | 'dusk'
  | 'slate'
  | 'ash'
  | 'haze'
  | 'veil'
  | 'smoke';

export type TransactionType = 'expense' | 'income';

// Reserved categoryId for income transactions. Income is global (not per-bubble),
// so it never matches a real category row — recalcSizes naturally ignores it.
export const INCOME_CATEGORY_ID = '__income__';

export type Category = {
  id: string;
  name: string;
  emoji: string;
  colorKey: BubbleColorKey;
  positionX: number; // percentage 0-100
  positionY: number; // percentage 0-100
  createdAt: number;
};

export type CategoryWithSize = Category & {
  size: number; // computed bubble diameter in px
  total: number; // total spend for current period
};

export type Transaction = {
  id: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  transactedAt: number; // unix ms — auto set at confirm
  note?: string;
  synced: boolean;
};

export type SyncQueueItem = {
  id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'transaction' | 'category';
  payload: string; // JSON
  createdAt: number;
};

export type { LocaleCode } from '@/lib/i18n/defaultCategories';
