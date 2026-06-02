// Zustand store for transactions with offline-first sync queue

import { create } from 'zustand';
import type { Transaction, Period, SyncQueueItem } from '@/types';
import * as db from '@/lib/db';

type TransactionState = {
  transactions: Transaction[];
  period: Period;

  loadByPeriod: (period: Period) => void;
  add: (categoryId: string, amount: number, note?: string) => Transaction;
  getTotal: () => number;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function getPeriodRange(period: Period): { start: number; end: number } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  switch (period) {
    case 'today':
      return { start: startOfDay, end: startOfDay + dayMs };
    case 'yesterday':
      return { start: startOfDay - dayMs, end: startOfDay };
    case 'week': {
      const dayOfWeek = now.getDay(); // 0=Sun
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = startOfDay - mondayOffset * dayMs;
      return { start: weekStart, end: weekStart + 7 * dayMs };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return { start: monthStart, end: monthEnd };
    }
  }
}

export { getPeriodRange };

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  period: 'today',

  loadByPeriod: (period) => {
    const { start, end } = getPeriodRange(period);
    const transactions = db.getTransactionsByPeriod(start, end);
    set({ transactions, period });
  },

  add: (categoryId, amount, note) => {
    const tx: Transaction = {
      id: generateId(),
      categoryId,
      amount,
      transactedAt: Date.now(),
      note,
      synced: false,
    };

    // Write to SQLite first (offline-first)
    db.insertTransaction(tx);

    // Enqueue sync
    const syncItem: SyncQueueItem = {
      id: generateId(),
      operation: 'CREATE',
      entity: 'transaction',
      payload: JSON.stringify(tx),
      createdAt: Date.now(),
    };
    db.insertSyncItem(syncItem);

    // Update in-memory state
    set({ transactions: [tx, ...get().transactions] });
    return tx;
  },

  getTotal: () => {
    return get().transactions.reduce((sum, tx) => sum + tx.amount, 0);
  },
}));
