import { serializeBackup, parseBackup, BACKUP_APP_ID, BACKUP_VERSION } from './backup';
import type { Category, Transaction } from '@/types';

const categories: Category[] = [
  { id: 'c1', name: 'Food', emoji: '🍔', colorKey: 'frost', positionX: 28, positionY: 32, createdAt: 1000 },
  { id: 'c2', name: 'Coffee', emoji: '☕', colorKey: 'mist', positionX: 48, positionY: 52, createdAt: 1001 },
];

const transactions: Transaction[] = [
  { id: 't1', categoryId: 'c1', amount: 50000, type: 'expense', transactedAt: 2000, synced: false },
  { id: 't2', categoryId: 'c1', amount: 12000, type: 'expense', transactedAt: 2100, note: 'lunch', synced: true },
  { id: 't3', categoryId: '__income__', amount: 999, type: 'income', transactedAt: 2200, synced: false },
];

describe('serializeBackup / parseBackup', () => {
  it('round-trips categories and transactions losslessly', () => {
    const json = serializeBackup(categories, transactions, 12345);
    const parsed = parseBackup(json);
    expect(parsed.app).toBe(BACKUP_APP_ID);
    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(parsed.exportedAt).toBe(12345);
    expect(parsed.categories).toEqual(categories);
    expect(parsed.transactions).toEqual(transactions);
  });

  it('preserves an absent note as undefined (not null)', () => {
    const parsed = parseBackup(serializeBackup(categories, transactions));
    expect(parsed.transactions[0].note).toBeUndefined();
    expect(parsed.transactions[1].note).toBe('lunch');
  });
});

describe('parseBackup validation', () => {
  it('rejects non-JSON input', () => {
    expect(() => parseBackup('not json{')).toThrow(/valid JSON/);
  });

  it('rejects a file from a different app', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'something-else', categories: [], transactions: [] }))).toThrow(
      /not a Bubble Spend backup/,
    );
  });

  it('rejects a payload missing its arrays', () => {
    expect(() => parseBackup(JSON.stringify({ app: BACKUP_APP_ID, categories: [] }))).toThrow(/missing/);
  });

  it('rejects a malformed category row', () => {
    const bad = JSON.stringify({
      app: BACKUP_APP_ID,
      version: 1,
      categories: [{ id: 'c1', name: 'Food' }], // missing emoji/color/positions
      transactions: [],
    });
    expect(() => parseBackup(bad)).toThrow(/Invalid backup/);
  });
});
