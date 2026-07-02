// Recurring-template firing — reads due templates and silently logs them as
// regular expense transactions. Pure due-check logic lives in lib/recurring.ts;
// this module owns the side effects (SQLite writes + sync queue), mirroring the
// backup.ts / backupIO.ts split. Called on app open (cold start and foreground
// resume) from the root layout.

import * as db from './db';
import { getDueTemplates, todayISO } from './recurring';
import type { SyncQueueItem, Transaction } from '@/types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// Logs every due template as an expense stamped "now", enqueues each for sync,
// and marks the template as fired today. The whole batch is one SQLite
// transaction so a failure can't log an expense without its dedup stamp (which
// would double-log on the next open). Returns how many were logged so the
// caller knows whether to refresh the stores.
export function fireDueRecurringTemplates(): number {
  const now = new Date();
  const due = getDueTemplates(
    db.getAllRecurringTemplates(),
    todayISO(),
    now.getDay(),
    now.getDate(),
  );
  if (due.length === 0) return 0;

  db.getDb().withTransactionSync(() => {
    for (const template of due) {
      const tx: Transaction = {
        id: generateId(),
        categoryId: template.categoryId,
        amount: template.amount,
        type: 'expense',
        transactedAt: Date.now(),
        note: template.note,
        synced: false,
      };
      db.insertTransaction(tx);

      const syncItem: SyncQueueItem = {
        id: generateId(),
        operation: 'CREATE',
        entity: 'transaction',
        payload: JSON.stringify(tx),
        createdAt: Date.now(),
      };
      db.insertSyncItem(syncItem);

      db.updateRecurringLastFired(template.id, todayISO());
    }
  });

  return due.length;
}
