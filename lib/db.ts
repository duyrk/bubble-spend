// SQLite database initialization and helpers

import * as SQLite from 'expo-sqlite';
import { DB_NAME } from '@/constants/config';
import type { Category, Transaction, SyncQueueItem } from '@/types';

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
      transacted_at INTEGER NOT NULL,
      note TEXT,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

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
    transactedAt: r.transacted_at,
    note: r.note ?? undefined,
    synced: r.synced === 1,
  }));
}

export function insertTransaction(tx: Transaction): void {
  const db = getDb();
  db.runSync(
    'INSERT INTO transactions (id, category_id, amount, transacted_at, note, synced) VALUES (?, ?, ?, ?, ?, ?)',
    [tx.id, tx.categoryId, tx.amount, tx.transactedAt, tx.note ?? null, tx.synced ? 1 : 0],
  );
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
