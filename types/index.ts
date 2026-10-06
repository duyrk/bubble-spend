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
  budget?: number; // monthly spending cap in the currency's main unit; absent/0 = no budget
};

export type CategoryWithSize = Category & {
  size: number; // computed bubble diameter in px
  total: number; // total spend for current period
  monthSpent: number; // current calendar-month expense total — drives the budget ring
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

// --- Recurring expense templates ---
// One template per category. On app open (cold start or foreground), any due
// template silently logs a regular expense transaction — see lib/recurring.ts
// (pure due-check) and lib/recurringIO.ts (firing orchestration).

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export type RecurringTemplate = {
  id: string;
  categoryId: string;
  amount: number;
  note?: string;
  frequency: RecurringFrequency;
  dayOfWeek?: number; // 0=Sun … 6=Sat — set when frequency is 'weekly'
  dayOfMonth?: number; // 1–28 — set when frequency is 'monthly'
  lastFiredDate?: string; // local 'YYYY-MM-DD' of the last auto-log; absent = never fired
  active: boolean;
  createdAt: number;
};

// --- Notification auto-capture (Android) ---
// Raw notification as queued by the native listener (modules/notification-capture),
// parsed by lib/notificationParser.ts and classified by lib/captureClassify.ts.

export type RawCapture = {
  id: string; // `${sbn.key}|${postTime}` — stable per posted notification
  packageName: string;
  title: string;
  text: string;
  bigText: string;
  postedAt: number; // unix ms
};

export type CaptureSource = 'acb' | 'momo' | 'other';

export type ParsedCapture = {
  captureId: string; // RawCapture.id
  source: CaptureSource;
  amount: number; // always positive, in VND
  direction: 'debit' | 'credit'; // money out / money in
  description: string; // transaction content ("GD:", "cho …", …), diacritics kept
  text: string; // full original title + body — keyword checks run on this
  occurredAt: number; // time stated in the text, else the notification's post time
  balance?: number; // account balance after the transaction, when stated
  confidence: 'high' | 'low'; // high = source-specific format matched
};

// What the pipeline should do with a parsed capture.
export type CaptureVerdict =
  | { kind: 'expense' }
  | { kind: 'income' }
  | { kind: 'internal'; reason: 'keyword' | 'own-account' }
  | { kind: 'internal'; reason: 'pair'; pairedWith: string } // the opposite leg's captureId
  | { kind: 'duplicate'; of: string; reason: 'same-source' | 'cross-source' | 'manual' };

// Pipeline outcome persisted per capture (lib/captureIO.ts):
//   logged   — became a transaction (transactionId set)
//   pending  — expense with no bubble match; waits in the uncategorized inbox
//   ignored  — internal transfer, duplicate, dismissed, or undone
//   unparsed — not a transaction (promo, OTP, unknown app); kept for debugging
export type CaptureStatus = 'logged' | 'pending' | 'ignored' | 'unparsed';

export type StoredCapture = ParsedCapture & {
  packageName: string;
  verdict?: CaptureVerdict; // absent for unparsed
  status: CaptureStatus;
  transactionId?: string;
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
