// Zustand store for transactions with offline-first sync queue

import { create } from 'zustand';
import type { Transaction, Period, SyncQueueItem, TransactionType } from '@/types';
import * as db from '@/lib/db';
import { useCategoryStore } from './useCategoryStore';

type TransactionState = {
  transactions: Transaction[];
  period: Period;

  loadByPeriod: (period: Period) => void;
  add: (
    categoryId: string,
    amount: number,
    type: TransactionType,
    note?: string,
    transactedAt?: number,
  ) => Transaction;
  updateTransactionAmount: (id: string, amount: number) => void;
  deleteTransaction: (id: string) => void;
  getExpenseTotal: () => number;
  getIncomeTotal: () => number;
  getNetBalance: () => number;
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

  add: (categoryId, amount, type, note, transactedAt) => {
    const tx: Transaction = {
      id: generateId(),
      categoryId,
      amount,
      type,
      transactedAt: transactedAt ?? Date.now(),
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

  updateTransactionAmount: (id, amount) => {
    db.updateTransactionAmount(id, amount);
    const transactions = get().transactions.map((tx) =>
      tx.id === id ? { ...tx, amount, synced: false } : tx,
    );
    set({ transactions });
    // Editing an expense amount changes that bubble's size — re-scale all bubbles.
    useCategoryStore.getState().recalcSizes(transactions);
  },

  deleteTransaction: (id) => {
    db.deleteTransaction(id);
    db.deleteSyncItemsForTransaction(id);
    const transactions = get().transactions.filter((tx) => tx.id !== id);
    set({ transactions });
    useCategoryStore.getState().recalcSizes(transactions);
  },

  getExpenseTotal: () =>
    get().transactions.reduce(
      (sum, tx) => (tx.type === 'expense' ? sum + tx.amount : sum),
      0,
    ),
  getIncomeTotal: () =>
    get().transactions.reduce(
      (sum, tx) => (tx.type === 'income' ? sum + tx.amount : sum),
      0,
    ),
  getNetBalance: () => {
    const { transactions } = get();
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
    return income - expense;
  },
}));
