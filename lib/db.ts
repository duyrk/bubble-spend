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
} from '@/types';

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
      created_at INTEGER NOT NULL
    );
  `);

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
  }>('SELECT * FROM categories ORDER BY created_at ASC');

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    colorKey: r.color_key as Category['colorKey'],
    positionX: r.position_x,
    positionY: r.position_y,
    createdAt: r.created_at,
  }));
}

export function insertCategory(cat: Category): void {
  const db = getDb();
  db.runSync(
    'INSERT OR REPLACE INTO categories (id, name, emoji, color_key, position_x, position_y, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [cat.id, cat.name, cat.emoji, cat.colorKey, cat.positionX, cat.positionY, cat.createdAt],
  );
}

export function updateCategoryPosition(id: string, x: number, y: number): void {
  const db = getDb();
  db.runSync('UPDATE categories SET position_x = ?, position_y = ? WHERE id = ?', [x, y, id]);
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
export function replaceAllData(categories: Category[], transactions: Transaction[]): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM sync_queue');
    db.runSync('DELETE FROM transactions');
    db.runSync('DELETE FROM categories');
    for (const cat of categories) insertCategory(cat);
    for (const tx of transactions) insertTransaction(tx);
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
