// Zustand store for transactions with offline-first sync queue

import { create } from 'zustand';
import type { Transaction, Period, SyncQueueItem, TransactionType, TransactionEdit } from '@/types';
import * as db from '@/lib/db';
import { getPeriodRange } from '@/lib/period';
import { useCategoryStore } from './useCategoryStore';

// Re-exported for screens that query SQLite directly (e.g. History).
export { getPeriodRange };

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
  updateTransaction: (id: string, fields: TransactionEdit) => void;
  deleteTransaction: (id: string) => void;
  getExpenseTotal: () => number;
  getIncomeTotal: () => number;
  getNetBalance: () => number;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

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

  updateTransaction: (id, fields) => {
    db.updateTransaction(id, fields);
    // The edit can move the row across the active period boundary or change its
    // category, so re-read the period slice from SQLite rather than patching in
    // place, then re-scale bubbles (amount/category both affect sizing).
    const { start, end } = getPeriodRange(get().period);
    const transactions = db.getTransactionsByPeriod(start, end);
    set({ transactions });
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
