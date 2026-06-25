// Backup (de)serialization — pure, no native/IO imports, so it can be unit
// tested and reused. The IO orchestration (file write, share, document pick,
// DB replace) lives in lib/backupIO.ts.

import type { BubbleColorKey, Category, Transaction } from '@/types';

export const BACKUP_APP_ID = 'bubble-spend';
export const BACKUP_VERSION = 1;

export type BackupPayload = {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: number; // unix ms
  categories: Category[];
  transactions: Transaction[];
};

export function serializeBackup(
  categories: Category[],
  transactions: Transaction[],
  exportedAt: number = Date.now(),
): string {
  const payload: BackupPayload = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt,
    categories,
    transactions,
  };
  return JSON.stringify(payload, null, 2);
}

// Parse + validate a backup file's contents. Throws a user-presentable Error on
// anything that isn't a well-formed Bubble Spend backup so the import flow can
// surface a clear message and abort without touching the database.
export function parseBackup(json: string): BackupPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Backup file is not valid JSON');
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Backup file is empty or malformed');
  }

  const obj = raw as Record<string, unknown>;
  if (obj.app !== BACKUP_APP_ID) {
    throw new Error('This file is not a Bubble Spend backup');
  }
  if (!Array.isArray(obj.categories) || !Array.isArray(obj.transactions)) {
    throw new Error('Backup is missing its categories or transactions');
  }

  return {
    app: BACKUP_APP_ID,
    version: typeof obj.version === 'number' ? obj.version : BACKUP_VERSION,
    exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : Date.now(),
    categories: obj.categories.map(parseCategory),
    transactions: obj.transactions.map(parseTransaction),
  };
}

function asObject(v: unknown, label: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null) {
    throw new Error(`Invalid backup: ${label} is not an object`);
  }
  return v as Record<string, unknown>;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string') throw new Error(`Invalid backup: ${field} must be text`);
  return v;
}

function asNumber(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Invalid backup: ${field} must be a number`);
  }
  return v;
}

function parseCategory(v: unknown): Category {
  const o = asObject(v, 'category');
  return {
    id: asString(o.id, 'category.id'),
    name: asString(o.name, 'category.name'),
    emoji: asString(o.emoji, 'category.emoji'),
    colorKey: asString(o.colorKey, 'category.colorKey') as BubbleColorKey,
    positionX: asNumber(o.positionX, 'category.positionX'),
    positionY: asNumber(o.positionY, 'category.positionY'),
    createdAt: asNumber(o.createdAt, 'category.createdAt'),
  };
}

function parseTransaction(v: unknown): Transaction {
  const o = asObject(v, 'transaction');
  return {
    id: asString(o.id, 'transaction.id'),
    categoryId: asString(o.categoryId, 'transaction.categoryId'),
    amount: asNumber(o.amount, 'transaction.amount'),
    type: o.type === 'income' ? 'income' : 'expense',
    transactedAt: asNumber(o.transactedAt, 'transaction.transactedAt'),
    note: typeof o.note === 'string' ? o.note : undefined,
    synced: o.synced === true,
  };
}
