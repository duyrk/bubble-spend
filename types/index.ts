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

// Editable fields of an existing transaction (History edit flow). `type` is not
// editable — income/expense conversion is intentionally out of scope.
export type TransactionEdit = {
  amount: number;
  categoryId: string;
  transactedAt: number;
  note?: string;
};

export type SyncQueueItem = {
  id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'transaction' | 'category';
  payload: string; // JSON
  createdAt: number;
};

// --- Insight (year → month → week → day drill-down) aggregates ---
// Each level's totals come straight from a GROUP BY query in lib/db.ts. Buckets
// with no activity are absent from the rows (the data hook fills the gaps).

export type MonthlyTotal = {
  month: number; // 1-12
  expense: number;
  income: number;
};

export type WeeklyTotal = {
  weekIdx: number; // 0-3 (days 1–7, 8–14, 15–21, 22–end)
  expense: number;
  income: number;
};

export type DailyTotal = {
  day: number; // day of month (1-31)
  weekday: number; // 0=Sun, 1=Mon … 6=Sat
  expense: number;
  income: number;
};

export type CategoryTotal = {
  categoryId: string;
  name: string;
  emoji: string;
  colorKey: BubbleColorKey;
  expense: number;
};

export type TransactionWithCategory = Transaction & {
  categoryName: string;
  emoji: string;
  colorKey: BubbleColorKey;
};

export type { LocaleCode } from '@/lib/i18n/defaultCategories';
