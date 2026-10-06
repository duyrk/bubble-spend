// Backup (de)serialization — pure, no native/IO imports, so it can be unit
// tested and reused. The IO orchestration (file write, share, document pick,
// DB replace) lives in lib/backupIO.ts.

import type { MerchantRule } from './autoCategorize';
import type { BubbleColorKey, Category, RecurringFrequency, RecurringTemplate, Transaction } from '@/types';

export const BACKUP_APP_ID = 'bubble-spend';
// v2 adds the optional extras below. v1 files (no extras) still import.
export const BACKUP_VERSION = 2;

// Everything beyond categories + transactions. Each field is optional on read:
// absent means "the file predates it", and the importer keeps today's behavior
// for that data instead of wiping it to empty.
export type BackupExtras = {
  recurringTemplates?: RecurringTemplate[];
  merchantRules?: MerchantRule[];
  ownAccounts?: string[];
};

export type BackupPayload = BackupExtras & {
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
  extras: BackupExtras = {},
): string {
  const payload: BackupPayload = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt,
    categories,
    transactions,
    ...extras,
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
    recurringTemplates: Array.isArray(obj.recurringTemplates)
      ? obj.recurringTemplates.map(parseRecurringTemplate)
      : undefined,
    merchantRules: Array.isArray(obj.merchantRules) ? obj.merchantRules.map(parseMerchantRule) : undefined,
    ownAccounts: Array.isArray(obj.ownAccounts)
      ? obj.ownAccounts.map((a, i) => asString(a, `ownAccounts[${i}]`))
      : undefined,
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
    // budget is optional — backups predating the feature simply omit it.
    budget: typeof o.budget === 'number' ? o.budget : undefined,
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

const FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly'];

function parseRecurringTemplate(v: unknown): RecurringTemplate {
  const o = asObject(v, 'recurring template');
  const frequency = asString(o.frequency, 'recurring.frequency') as RecurringFrequency;
  if (!FREQUENCIES.includes(frequency)) throw new Error('Invalid backup: recurring.frequency is unknown');
  return {
    id: asString(o.id, 'recurring.id'),
    categoryId: asString(o.categoryId, 'recurring.categoryId'),
    amount: asNumber(o.amount, 'recurring.amount'),
    note: typeof o.note === 'string' ? o.note : undefined,
    frequency,
    dayOfWeek: typeof o.dayOfWeek === 'number' ? o.dayOfWeek : undefined,
    dayOfMonth: typeof o.dayOfMonth === 'number' ? o.dayOfMonth : undefined,
    lastFiredDate: typeof o.lastFiredDate === 'string' ? o.lastFiredDate : undefined,
    active: o.active !== false,
    createdAt: asNumber(o.createdAt, 'recurring.createdAt'),
  };
}

function parseMerchantRule(v: unknown): MerchantRule {
  const o = asObject(v, 'merchant rule');
  return {
    key: asString(o.key, 'rule.key'),
    categoryId: asString(o.categoryId, 'rule.categoryId'),
    hits: typeof o.hits === 'number' ? o.hits : 1,
  };
}
