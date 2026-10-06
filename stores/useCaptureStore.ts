// Zustand store for notification auto-capture: the uncategorized inbox and the
// result of the latest auto-log run (drives Home's "Auto-logged — Undo" toast).
// All persistence lives in SQLite via lib/captureIO.ts; this is in-memory view
// state plus thin action wrappers that refresh the affected stores.

import { create } from 'zustand';
import * as db from '@/lib/db';
import {
  assignCapture,
  dismissCapture,
  runCapturePipeline,
  undoAutoLogged,
} from '@/lib/captureIO';
import { useSettingsStore } from './useSettingsStore';
import { useTransactionStore } from './useTransactionStore';
import type { StoredCapture } from '@/types';

export type AutoLogRun = {
  id: string; // re-arms the toast for every new run
  txIds: string[];
  count: number;
  expenseTotal: number;
};

type CaptureState = {
  pending: StoredCapture[];
  lastRun: AutoLogRun | null;

  loadPending: () => void;
  // Process whatever the native listener has queued. Safe to call often.
  run: () => void;
  assign: (captureId: string, categoryId: string) => void;
  dismiss: (captureId: string) => void;
  undoLastRun: () => void;
  clearLastRun: () => void;
};

function reloadTransactions() {
  const tx = useTransactionStore.getState();
  tx.loadByPeriod(tx.period);
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  pending: [],
  lastRun: null,

  loadPending: () => set({ pending: db.getPendingCaptures() }),

  run: () => {
    const result = runCapturePipeline(useSettingsStore.getState().ownAccounts);
    if (result.logged.length > 0 || result.reverted > 0) reloadTransactions();
    if (result.logged.length > 0) {
      set({
        lastRun: {
          id: `${Date.now()}`,
          txIds: result.logged.map((t) => t.id),
          count: result.logged.length,
          expenseTotal: result.logged.reduce((s, t) => (t.type === 'expense' ? s + t.amount : s), 0),
        },
      });
    }
    get().loadPending();
  },

  assign: (captureId, categoryId) => {
    if (assignCapture(captureId, categoryId)) reloadTransactions();
    get().loadPending();
  },

  dismiss: (captureId) => {
    dismissCapture(captureId);
    get().loadPending();
  },

  undoLastRun: () => {
    const run = get().lastRun;
    if (!run) return;
    undoAutoLogged(run.txIds);
    set({ lastRun: null });
    reloadTransactions();
  },

  clearLastRun: () => set({ lastRun: null }),
}));
