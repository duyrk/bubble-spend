// SQLite database initialization and helpers

import * as SQLite from 'expo-sqlite';
import { DB_NAME } from '@/constants/config';
import type {
  Category,
  Transaction,
  SyncQueueItem,
  TransactionType,
  TransactionEdit,
  MonthlyTotal,
  WeeklyTotal,
  DailyTotal,
  CategoryTotal,
  TransactionWithCategory,
  BubbleColorKey,
  RecurringFrequency,
  RecurringTemplate,
  CaptureStatus,
  CaptureVerdict,
  StoredCapture,
} from '@/types';
import type { MerchantRule } from './autoCategorize';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(DB_NAME);
  }
  return _db;
}

export function initDb(): void {
  const db = getDb();

  db.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      color_key TEXT NOT NULL,
      position_x REAL DEFAULT 50,
      position_y REAL DEFAULT 50,
      created_at INTEGER NOT NULL,
      budget REAL
    );
  `);

  // Idempotent column migration for installs that pre-date per-category budgets.
  // PRAGMA probe first, same as the transactions.type migration below — a failed
  // ALTER logs a noisy native exception even when caught.
  const catColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(categories)');
  if (!catColumns.some((c) => c.name === 'budget')) {
    db.execSync('ALTER TABLE categories ADD COLUMN budget REAL;');
  }

  db.execSync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      transacted_at INTEGER NOT NULL,
      note TEXT,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  // Idempotent column migration for installs that pre-date the `type` column.
  // Probe with PRAGMA first rather than catching a thrown ALTER — a failed
  // ALTER still surfaces a noisy native exception log even when swallowed.
  const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(transactions)');
  if (!columns.some((c) => c.name === 'type')) {
    db.execSync(`ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense';`);
  }

  db.execSync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      entity TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS recurring_templates (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      frequency TEXT NOT NULL,
      day_of_week INTEGER,
      day_of_month INTEGER,
      last_fired_date TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `);

  // Notification auto-capture — one row per processed notification (the dedup
  // memory + audit trail), and the learned merchant → bubble rules.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      package_name TEXT NOT NULL,
      source TEXT NOT NULL,
      amount REAL NOT NULL,
      direction TEXT NOT NULL,
      description TEXT NOT NULL,
      text TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      balance REAL,
      confidence TEXT NOT NULL,
      verdict TEXT,
      status TEXT NOT NULL,
      transaction_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_captures_occurred ON captures (occurred_at);
    CREATE INDEX IF NOT EXISTS idx_captures_tx ON captures (transaction_id);
    CREATE TABLE IF NOT EXISTS merchant_rules (
      key TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `);
}

// --- Category queries ---

export function getAllCategories(): Category[] {
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    name: string;
    emoji: string;
    color_key: string;
    position_x: number;
    position_y: number;
    created_at: number;
    budget: number | null;
  }>('SELECT * FROM categories ORDER BY created_at ASC');

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    colorKey: r.color_key as Category['colorKey'],
    positionX: r.position_x,
    positionY: r.position_y,
    createdAt: r.created_at,
    // NULL (no cap) → undefined so the rest of the app treats it as "no budget".
    budget: r.budget == null ? undefined : r.budget,
  }));
}

export function insertCategory(cat: Category): void {
  const db = getDb();
  db.runSync(
    'INSERT OR REPLACE INTO categories (id, name, emoji, color_key, position_x, position_y, created_at, budget) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [cat.id, cat.name, cat.emoji, cat.colorKey, cat.positionX, cat.positionY, cat.createdAt, cat.budget ?? null],
  );
}

export function updateCategoryPosition(id: string, x: number, y: number): void {
  const db = getDb();
  db.runSync('UPDATE categories SET position_x = ?, position_y = ? WHERE id = ?', [x, y, id]);
}

// Set (or clear, when budget is undefined) a category's monthly cap.
export function updateCategoryBudget(id: string, budget: number | undefined): void {
  const db = getDb();
  db.runSync('UPDATE categories SET budget = ? WHERE id = ?', [budget ?? null, id]);
}

export function deleteCategory(id: string): void {
  const db = getDb();
  db.runSync('DELETE FROM categories WHERE id = ?', [id]);
}

// --- Transaction queries ---

export function getTransactionsByPeriod(startMs: number, endMs: number): Transaction[] {
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    category_id: string;
    amount: number;
    type: string | null;
    transacted_at: number;
    note: string | null;
    synced: number;
  }>('SELECT * FROM transactions WHERE transacted_at >= ? AND transacted_at < ? ORDER BY transacted_at DESC', [
    startMs,
    endMs,
  ]);

  return rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    amount: r.amount,
    type: (r.type === 'income' ? 'income' : 'expense') as TransactionType,
    transactedAt: r.transacted_at,
    note: r.note ?? undefined,
    synced: r.synced === 1,
  }));
}

// Per-category expense totals within a time range, as a categoryId → amount map.
// Powers the budget ring: callers pass the current calendar month's range so the
// ring reflects month-to-date spend regardless of the active period tab. Income
// rows are excluded (they have no bubble and never count against a budget).
export function getCategorySpend(startMs: number, endMs: number): Record<string, number> {
  const db = getDb();
  const rows = db.getAllSync<{ category_id: string; total: number }>(
    `SELECT category_id, SUM(amount) AS total
       FROM transactions
      WHERE type = 'expense'
        AND category_id != '__income__'
        AND transacted_at >= ? AND transacted_at < ?
      GROUP BY category_id`,
    [startMs, endMs],
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.category_id] = r.total;
  return out;
}

// Full transaction history, newest first — used by the backup export.
export function getAllTransactions(): Transaction[] {
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    category_id: string;
    amount: number;
    type: string | null;
    transacted_at: number;
    note: string | null;
    synced: number;
  }>('SELECT * FROM transactions ORDER BY transacted_at DESC');

  return rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    amount: r.amount,
    type: (r.type === 'income' ? 'income' : 'expense') as TransactionType,
    transactedAt: r.transacted_at,
    note: r.note ?? undefined,
    synced: r.synced === 1,
  }));
}

// Most-recent distinct amounts logged for a category (expense) or the income
// bucket — powers the one-tap "recent amount" chips in the numpad. We over-fetch
// a small window and de-duplicate in JS so the chips stay distinct.
export function getRecentAmounts(
  categoryId: string,
  type: TransactionType,
  limit = 3,
): number[] {
  const db = getDb();
  const rows = db.getAllSync<{ amount: number }>(
    'SELECT amount FROM transactions WHERE category_id = ? AND type = ? ORDER BY transacted_at DESC LIMIT 50',
    [categoryId, type],
  );

  const seen = new Set<number>();
  const out: number[] = [];
  for (const r of rows) {
    const amount = Math.round(r.amount);
    if (amount <= 0 || seen.has(amount)) continue;
    seen.add(amount);
    out.push(amount);
    if (out.length >= limit) break;
  }
  return out;
}

export function insertTransaction(tx: Transaction): void {
  const db = getDb();
  db.runSync(
    'INSERT INTO transactions (id, category_id, amount, type, transacted_at, note, synced) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [tx.id, tx.categoryId, tx.amount, tx.type, tx.transactedAt, tx.note ?? null, tx.synced ? 1 : 0],
  );
}

export function updateTransaction(id: string, fields: TransactionEdit): void {
  const db = getDb();
  // synced → 0 marks the row dirty so a future sync flush re-sends it.
  db.runSync(
    'UPDATE transactions SET amount = ?, category_id = ?, transacted_at = ?, note = ?, synced = 0 WHERE id = ?',
    [fields.amount, fields.categoryId, fields.transactedAt, fields.note ?? null, id],
  );
}

export function deleteTransaction(id: string): void {
  const db = getDb();
  db.runSync('DELETE FROM transactions WHERE id = ?', [id]);
}

export function deleteTransactionsByCategory(categoryId: string): void {
  const db = getDb();
  db.runSync('DELETE FROM transactions WHERE category_id = ?', [categoryId]);
}

// Atomically replace ALL local data with a restored backup. Wraps the wipe +
// bulk insert in a single transaction so a failure can't leave a half-imported
// database. The sync queue is cleared too — a restore is a fresh local baseline,
// not a set of pending edits to flush.
export function replaceAllData(
  categories: Category[],
  transactions: Transaction[],
  extras: { recurringTemplates?: RecurringTemplate[]; merchantRules?: MerchantRule[] } = {},
): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM sync_queue');
    db.runSync('DELETE FROM transactions');
    db.runSync('DELETE FROM categories');
    // Templates always go: v2 backups restore their own, and v1 backups predate
    // them — surviving templates could point at categories that no longer exist.
    db.runSync('DELETE FROM recurring_templates');
    for (const cat of categories) insertCategory(cat);
    for (const tx of transactions) insertTransaction(tx);
    for (const t of extras.recurringTemplates ?? []) insertRecurringTemplate(t);
    // Rules are only replaced when the backup carries them; a v1 restore keeps
    // the learned rules (ones for missing bubbles are ignored at lookup time).
    if (extras.merchantRules) {
      db.runSync('DELETE FROM merchant_rules');
      for (const r of extras.merchantRules) insertMerchantRule(r);
    }
  });
}

// --- Insight queries (year → month → week → day drill-down) ---
// All grouping/aggregation happens in SQL; the data hook fills the empty buckets
// and derives peaks/averages. Dates are bucketed in the device's local timezone
// (datetime(..., 'localtime')) so a transaction lands in the day the user saw.

export function getMonthlyTotals(year: number): MonthlyTotal[] {
  const db = getDb();
  const rows = db.getAllSync<{ month: number; expense: number | null; income: number | null }>(
    `SELECT
       CAST(strftime('%m', datetime(transacted_at/1000, 'unixepoch', 'localtime')) AS INTEGER) AS month,
       SUM(CASE WHEN category_id != '__income__' THEN amount ELSE 0 END) AS expense,
       SUM(CASE WHEN category_id  = '__income__' THEN amount ELSE 0 END) AS income
     FROM transactions
     WHERE strftime('%Y', datetime(transacted_at/1000, 'unixepoch', 'localtime')) = ?
     GROUP BY month
     ORDER BY month`,
    [String(year)],
  );
  return rows.map((r) => ({ month: r.month, expense: r.expense ?? 0, income: r.income ?? 0 }));
}

export function getWeeklyTotals(year: number, month: number): WeeklyTotal[] {
  const db = getDb();
  const rows = db.getAllSync<{ week_idx: number; expense: number | null; income: number | null }>(
    `SELECT
       MIN(
         CAST((CAST(strftime('%d', datetime(transacted_at/1000,'unixepoch','localtime')) AS INTEGER) - 1) / 7 AS INTEGER),
         3
       ) AS week_idx,
       SUM(CASE WHEN category_id != '__income__' THEN amount ELSE 0 END) AS expense,
       SUM(CASE WHEN category_id  = '__income__' THEN amount ELSE 0 END) AS income
     FROM transactions
     WHERE strftime('%Y-%m', datetime(transacted_at/1000,'unixepoch','localtime'))
           = printf('%04d-%02d', ?, ?)
     GROUP BY week_idx
     ORDER BY week_idx`,
    [year, month],
  );
  return rows.map((r) => ({ weekIdx: r.week_idx, expense: r.expense ?? 0, income: r.income ?? 0 }));
}

export function getDailyTotals(year: number, month: number, weekIdx: number): DailyTotal[] {
  const db = getDb();
  const startDay = weekIdx * 7 + 1;
  const endDay = weekIdx === 3 ? 31 : (weekIdx + 1) * 7;
  const rows = db.getAllSync<{
    day: number;
    weekday: number;
    expense: number | null;
    income: number | null;
  }>(
    `SELECT
       CAST(strftime('%d', datetime(transacted_at/1000,'unixepoch','localtime')) AS INTEGER) AS day,
       CAST(strftime('%w', datetime(transacted_at/1000,'unixepoch','localtime')) AS INTEGER) AS weekday,
       SUM(CASE WHEN category_id != '__income__' THEN amount ELSE 0 END) AS expense,
       SUM(CASE WHEN category_id  = '__income__' THEN amount ELSE 0 END) AS income
     FROM transactions
     WHERE strftime('%Y-%m', datetime(transacted_at/1000,'unixepoch','localtime'))
             = printf('%04d-%02d', ?, ?)
       AND CAST(strftime('%d', datetime(transacted_at/1000,'unixepoch','localtime')) AS INTEGER)
             BETWEEN ? AND ?
     GROUP BY day
     ORDER BY day`,
    [year, month, startDay, endDay],
  );
  return rows.map((r) => ({
    day: r.day,
    weekday: r.weekday,
    expense: r.expense ?? 0,
    income: r.income ?? 0,
  }));
}

export function getTransactionsByDate(
  year: number,
  month: number,
  day: number,
): TransactionWithCategory[] {
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    category_id: string;
    amount: number;
    type: string | null;
    transacted_at: number;
    note: string | null;
    synced: number;
    category_name: string;
    emoji: string;
    color_key: string;
  }>(
    `SELECT
       t.id, t.amount, t.transacted_at, t.note, t.category_id, t.synced, t.type,
       c.name AS category_name, c.emoji, c.color_key
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE strftime('%Y-%m-%d', datetime(t.transacted_at/1000,'unixepoch','localtime'))
           = printf('%04d-%02d-%02d', ?, ?, ?)
     ORDER BY t.transacted_at DESC`,
    [year, month, day],
  );
  return rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    amount: r.amount,
    type: (r.type === 'income' ? 'income' : 'expense') as TransactionType,
    transactedAt: r.transacted_at,
    note: r.note ?? undefined,
    synced: r.synced === 1,
    categoryName: r.category_name,
    emoji: r.emoji,
    colorKey: r.color_key as BubbleColorKey,
  }));
}

// Single month's total expense (excluding income), bucketed in local time to
// match the rest of the insight queries. Powers the month-over-month comparison.
export function getMonthExpenseTotal(year: number, month: number): number {
  const db = getDb();
  const rows = db.getAllSync<{ total: number | null }>(
    `SELECT SUM(amount) AS total
       FROM transactions
      WHERE category_id != '__income__'
        AND strftime('%Y-%m', datetime(transacted_at/1000,'unixepoch','localtime'))
            = printf('%04d-%02d', ?, ?)`,
    [year, month],
  );
  return rows[0]?.total ?? 0;
}

export function getCategoryTotalsByMonth(year: number, month: number): CategoryTotal[] {
  const db = getDb();
  const rows = db.getAllSync<{
    category_id: string;
    name: string;
    emoji: string;
    color_key: string;
    expense: number | null;
  }>(
    `SELECT
       t.category_id, c.name, c.emoji, c.color_key,
       SUM(t.amount) AS expense
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE strftime('%Y-%m', datetime(t.transacted_at/1000,'unixepoch','localtime'))
           = printf('%04d-%02d', ?, ?)
       AND t.category_id != '__income__'
     GROUP BY t.category_id
     ORDER BY expense DESC`,
    [year, month],
  );
  return rows.map((r) => ({
    categoryId: r.category_id,
    name: r.name,
    emoji: r.emoji,
    colorKey: r.color_key as BubbleColorKey,
    expense: r.expense ?? 0,
  }));
}

export function getCategoryTotalsByWeek(
  year: number,
  month: number,
  startDay: number,
  endDay: number,
): CategoryTotal[] {
  const db = getDb();
  const rows = db.getAllSync<{
    category_id: string;
    name: string;
    emoji: string;
    color_key: string;
    expense: number | null;
  }>(
    `SELECT
       t.category_id, c.name, c.emoji, c.color_key,
       SUM(t.amount) AS expense
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE strftime('%Y-%m', datetime(t.transacted_at/1000,'unixepoch','localtime'))
           = printf('%04d-%02d', ?, ?)
       AND t.category_id != '__income__'
       AND CAST(strftime('%d', datetime(t.transacted_at/1000,'unixepoch','localtime')) AS INTEGER)
           BETWEEN ? AND ?
     GROUP BY t.category_id
     ORDER BY expense DESC`,
    [year, month, startDay, endDay],
  );
  return rows.map((r) => ({
    categoryId: r.category_id,
    name: r.name,
    emoji: r.emoji,
    colorKey: r.color_key as BubbleColorKey,
    expense: r.expense ?? 0,
  }));
}

// The month's single biggest expense, with its category — the "biggest expense"
// highlight on the Insight month level. Ties go to the most recent transaction.
export function getLargestExpenseByMonth(
  year: number,
  month: number,
): TransactionWithCategory | null {
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    category_id: string;
    amount: number;
    type: string | null;
    transacted_at: number;
    note: string | null;
    synced: number;
    category_name: string;
    emoji: string;
    color_key: string;
  }>(
    `SELECT
       t.id, t.amount, t.transacted_at, t.note, t.category_id, t.synced, t.type,
       c.name AS category_name, c.emoji, c.color_key
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE strftime('%Y-%m', datetime(t.transacted_at/1000,'unixepoch','localtime'))
           = printf('%04d-%02d', ?, ?)
       AND t.category_id != '__income__'
     ORDER BY t.amount DESC, t.transacted_at DESC
     LIMIT 1`,
    [year, month],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    categoryId: r.category_id,
    amount: r.amount,
    type: (r.type === 'income' ? 'income' : 'expense') as TransactionType,
    transactedAt: r.transacted_at,
    note: r.note ?? undefined,
    synced: r.synced === 1,
    categoryName: r.category_name,
    emoji: r.emoji,
    colorKey: r.color_key as BubbleColorKey,
  };
}

// Expense totals grouped by (weekday, hour-of-day) for a month — the raw cells
// for computePeakSpending (lib/peaks.ts), which reduces them to peak day/time.
export function getWeekdayHourSpend(
  year: number,
  month: number,
): { weekday: number; hour: number; total: number }[] {
  const db = getDb();
  const rows = db.getAllSync<{ weekday: number; hour: number; total: number | null }>(
    `SELECT
       CAST(strftime('%w', datetime(transacted_at/1000,'unixepoch','localtime')) AS INTEGER) AS weekday,
       CAST(strftime('%H', datetime(transacted_at/1000,'unixepoch','localtime')) AS INTEGER) AS hour,
       SUM(amount) AS total
     FROM transactions
     WHERE category_id != '__income__'
       AND strftime('%Y-%m', datetime(transacted_at/1000,'unixepoch','localtime'))
           = printf('%04d-%02d', ?, ?)
     GROUP BY weekday, hour`,
    [year, month],
  );
  return rows.map((r) => ({ weekday: r.weekday, hour: r.hour, total: r.total ?? 0 }));
}

// One category's expense total per month of a year — the per-category series
// behind the year-level trend chart. Months without spend are absent (the
// chart component fills the gaps with zeros).
export function getMonthlyCategoryExpense(
  year: number,
  categoryId: string,
): { month: number; expense: number }[] {
  const db = getDb();
  const rows = db.getAllSync<{ month: number; expense: number | null }>(
    `SELECT
       CAST(strftime('%m', datetime(transacted_at/1000, 'unixepoch', 'localtime')) AS INTEGER) AS month,
       SUM(amount) AS expense
     FROM transactions
     WHERE category_id = ?
       AND strftime('%Y', datetime(transacted_at/1000, 'unixepoch', 'localtime')) = ?
     GROUP BY month
     ORDER BY month`,
    [categoryId, String(year)],
  );
  return rows.map((r) => ({ month: r.month, expense: r.expense ?? 0 }));
}

// --- Recurring expense templates ---

export function getAllRecurringTemplates(): RecurringTemplate[] {
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    category_id: string;
    amount: number;
    note: string | null;
    frequency: string;
    day_of_week: number | null;
    day_of_month: number | null;
    last_fired_date: string | null;
    active: number;
    created_at: number;
  }>('SELECT * FROM recurring_templates ORDER BY created_at ASC');

  return rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    amount: r.amount,
    note: r.note ?? undefined,
    frequency: r.frequency as RecurringFrequency,
    dayOfWeek: r.day_of_week ?? undefined,
    dayOfMonth: r.day_of_month ?? undefined,
    lastFiredDate: r.last_fired_date ?? undefined,
    active: r.active === 1,
    createdAt: r.created_at,
  }));
}

export function insertRecurringTemplate(t: RecurringTemplate): void {
  const db = getDb();
  db.runSync(
    `INSERT OR REPLACE INTO recurring_templates
       (id, category_id, amount, note, frequency, day_of_week, day_of_month, last_fired_date, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.id,
      t.categoryId,
      t.amount,
      t.note ?? null,
      t.frequency,
      t.dayOfWeek ?? null,
      t.dayOfMonth ?? null,
      t.lastFiredDate ?? null,
      t.active ? 1 : 0,
      t.createdAt,
    ],
  );
}

export function deleteRecurringTemplate(id: string): void {
  const db = getDb();
  db.runSync('DELETE FROM recurring_templates WHERE id = ?', [id]);
}

// Cascade partner of deleteCategory — a template pointing at a deleted category
// would silently auto-log orphaned transactions.
export function deleteRecurringTemplatesByCategory(categoryId: string): void {
  const db = getDb();
  db.runSync('DELETE FROM recurring_templates WHERE category_id = ?', [categoryId]);
}

// Stamp the local day a template last auto-logged — the same-day dedup marker.
export function updateRecurringLastFired(id: string, date: string): void {
  const db = getDb();
  db.runSync('UPDATE recurring_templates SET last_fired_date = ? WHERE id = ?', [date, id]);
}

// --- Sync queue ---

export function insertSyncItem(item: SyncQueueItem): void {
  const db = getDb();
  db.runSync(
    'INSERT INTO sync_queue (id, operation, entity, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    [item.id, item.operation, item.entity, item.payload, item.createdAt],
  );
}

export function getPendingSyncItems(): SyncQueueItem[] {
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    operation: string;
    entity: string;
    payload: string;
    created_at: number;
  }>('SELECT * FROM sync_queue ORDER BY created_at ASC');

  return rows.map((r) => ({
    id: r.id,
    operation: r.operation as SyncQueueItem['operation'],
    entity: r.entity as SyncQueueItem['entity'],
    payload: r.payload,
    createdAt: r.created_at,
  }));
}

export function deleteSyncItem(id: string): void {
  const db = getDb();
  db.runSync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

// Best-effort removal of any pending sync entries that reference a transaction —
// e.g. its original CREATE row — when that transaction is deleted locally before
// it was ever flushed. The sync_queue id differs from the entity id, so we match
// on the payload's embedded id.
export function deleteSyncItemsForTransaction(txId: string): void {
  const db = getDb();
  const rows = db.getAllSync<{ id: string; payload: string }>(
    "SELECT id, payload FROM sync_queue WHERE entity = 'transaction'",
  );
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.payload) as { id?: string };
      if (parsed.id === txId) {
        db.runSync('DELETE FROM sync_queue WHERE id = ?', [r.id]);
      }
    } catch {
      // malformed payload — leave it for the sync layer to deal with
    }
  }
}

// --- Notification auto-capture ---

type CaptureRow = {
  id: string;
  package_name: string;
  source: string;
  amount: number;
  direction: string;
  description: string;
  text: string;
  occurred_at: number;
  balance: number | null;
  confidence: string;
  verdict: string | null;
  status: string;
  transaction_id: string | null;
  created_at: number;
};

function toStoredCapture(r: CaptureRow): StoredCapture {
  let verdict: CaptureVerdict | undefined;
  try {
    verdict = r.verdict ? (JSON.parse(r.verdict) as CaptureVerdict) : undefined;
  } catch {
    verdict = undefined;
  }
  return {
    captureId: r.id,
    packageName: r.package_name,
    source: r.source as StoredCapture['source'],
    amount: r.amount,
    direction: r.direction as StoredCapture['direction'],
    description: r.description,
    text: r.text,
    occurredAt: r.occurred_at,
    balance: r.balance ?? undefined,
    confidence: r.confidence as StoredCapture['confidence'],
    verdict,
    status: r.status as CaptureStatus,
    transactionId: r.transaction_id ?? undefined,
    createdAt: r.created_at,
  };
}

export function insertCapture(c: StoredCapture): void {
  const db = getDb();
  db.runSync(
    `INSERT OR IGNORE INTO captures
       (id, package_name, source, amount, direction, description, text, occurred_at,
        balance, confidence, verdict, status, transaction_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.captureId,
      c.packageName,
      c.source,
      c.amount,
      c.direction,
      c.description,
      c.text,
      c.occurredAt,
      c.balance ?? null,
      c.confidence,
      c.verdict ? JSON.stringify(c.verdict) : null,
      c.status,
      c.transactionId ?? null,
      c.createdAt,
    ],
  );
}

export function updateCaptureStatus(id: string, status: CaptureStatus, transactionId?: string | null): void {
  const db = getDb();
  db.runSync('UPDATE captures SET status = ?, transaction_id = ? WHERE id = ?', [
    status,
    transactionId ?? null,
    id,
  ]);
}

// Which of `ids` are already stored — the native inbox may hand the same
// notification over twice (e.g. a crash between processing and clearing).
export function getExistingCaptureIds(ids: string[]): Set<string> {
  if (ids.length === 0) return new Set();
  const db = getDb();
  const rows = db.getAllSync<{ id: string }>(
    `SELECT id FROM captures WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  return new Set(rows.map((r) => r.id));
}

export function getCapture(id: string): StoredCapture | null {
  const db = getDb();
  const row = db.getFirstSync<CaptureRow>('SELECT * FROM captures WHERE id = ?', [id]);
  return row ? toStoredCapture(row) : null;
}

export function getCaptureByTransaction(txId: string): StoredCapture | null {
  const db = getDb();
  const row = db.getFirstSync<CaptureRow>('SELECT * FROM captures WHERE transaction_id = ?', [txId]);
  return row ? toStoredCapture(row) : null;
}

// Parsed captures in [startMs, endMs) — the classifier's pairing/dedup history.
export function getCapturesBetween(startMs: number, endMs: number): StoredCapture[] {
  const db = getDb();
  const rows = db.getAllSync<CaptureRow>(
    "SELECT * FROM captures WHERE status != 'unparsed' AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at ASC",
    [startMs, endMs],
  );
  return rows.map(toStoredCapture);
}

export function getPendingCaptures(): StoredCapture[] {
  const db = getDb();
  const rows = db.getAllSync<CaptureRow>(
    "SELECT * FROM captures WHERE status = 'pending' ORDER BY occurred_at DESC",
  );
  return rows.map(toStoredCapture);
}

// Newest first, for the debug inspector.
export function getRecentCaptures(limit = 100): StoredCapture[] {
  const db = getDb();
  const rows = db.getAllSync<CaptureRow>('SELECT * FROM captures ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows.map(toStoredCapture);
}

// Drop old non-transaction rows so debug mode can't grow the table forever.
// Logged/pending rows are kept (they back undo, learning, and the inbox).
export function pruneCaptures(olderThanMs: number): void {
  const db = getDb();
  db.runSync("DELETE FROM captures WHERE status IN ('ignored', 'unparsed') AND created_at < ?", [olderThanMs]);
}

// Hand-entered (and recurring) transactions in a window — every transaction not
// produced by a capture. The classifier matches these to avoid double-logging
// a spend the user already typed in.
export function getUncapturedTransactionsBetween(
  startMs: number,
  endMs: number,
): { id: string; amount: number; type: TransactionType; transactedAt: number }[] {
  const db = getDb();
  const rows = db.getAllSync<{ id: string; amount: number; type: string | null; transacted_at: number }>(
    `SELECT t.id, t.amount, t.type, t.transacted_at
       FROM transactions t
      WHERE t.transacted_at >= ? AND t.transacted_at < ?
        AND NOT EXISTS (SELECT 1 FROM captures c WHERE c.transaction_id = t.id)`,
    [startMs, endMs],
  );
  return rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    type: (r.type === 'income' ? 'income' : 'expense') as TransactionType,
    transactedAt: r.transacted_at,
  }));
}

export function getMerchantRules(): MerchantRule[] {
  const db = getDb();
  const rows = db.getAllSync<{ key: string; category_id: string; hits: number }>(
    'SELECT key, category_id, hits FROM merchant_rules ORDER BY hits DESC',
  );
  return rows.map((r) => ({ key: r.key, categoryId: r.category_id, hits: r.hits }));
}

// Learn (or re-point) a rule. Re-filing a merchant to another bubble moves the
// rule and resets its hit count.
export function upsertMerchantRule(key: string, categoryId: string): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO merchant_rules (key, category_id, hits, updated_at) VALUES (?, ?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       hits = CASE WHEN category_id = excluded.category_id THEN hits + 1 ELSE 1 END,
       category_id = excluded.category_id,
       updated_at = excluded.updated_at`,
    [key, categoryId, Date.now()],
  );
}

export function insertMerchantRule(r: MerchantRule): void {
  const db = getDb();
  db.runSync(
    'INSERT OR REPLACE INTO merchant_rules (key, category_id, hits, updated_at) VALUES (?, ?, ?, ?)',
    [r.key, r.categoryId, r.hits, Date.now()],
  );
}

export function bumpMerchantRule(key: string): void {
  const db = getDb();
  db.runSync('UPDATE merchant_rules SET hits = hits + 1, updated_at = ? WHERE key = ?', [Date.now(), key]);
}

export function deleteMerchantRule(key: string): void {
  const db = getDb();
  db.runSync('DELETE FROM merchant_rules WHERE key = ?', [key]);
}
