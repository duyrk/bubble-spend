// Notification auto-capture pipeline — side effects only. Pulls raw captures
// from the native inbox, parses + classifies them (pure: notificationParser,
// captureClassify, autoCategorize), and writes the outcome: an expense in the
// matched bubble, income, or an "uncategorized" inbox entry. Mirrors the
// recurring.ts / recurringIO.ts split. Runs on app open, on foreground, and
// live while the app is open (app/_layout.tsx).

import * as db from './db';
import { parseNotification, sourceOf } from './notificationParser';
import { classifyCaptures, type ProcessedCapture } from './captureClassify';
import { merchantKey, suggestCategory } from './autoCategorize';
import * as NotificationCapture from '@/modules/notification-capture';
import { INCOME_CATEGORY_ID } from '@/types';
import type { ParsedCapture, RawCapture, StoredCapture, SyncQueueItem, Transaction, TransactionType } from '@/types';

// How far back the classifier looks for the other leg of a transfer / a
// duplicate. Comfortably wider than its 15-minute manual window.
const HISTORY_WINDOW_MS = 60 * 60 * 1000;
const PRUNE_AFTER_MS = 60 * 24 * 60 * 60 * 1000;
const NOTE_MAX = 80;

export type CaptureRunResult = {
  logged: Transaction[]; // auto-logged this run (expenses in a bubble + income)
  pending: number; // new uncategorized expenses waiting in the inbox
  reverted: number; // earlier auto-logs undone because they turned out internal
};

const EMPTY_RESULT: CaptureRunResult = { logged: [], pending: 0, reverted: 0 };

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function noteFor(c: ParsedCapture): string | undefined {
  const s = c.description.replace(/\s+/g, ' ').trim();
  if (!s) return undefined;
  return s.length > NOTE_MAX ? `${s.slice(0, NOTE_MAX - 1)}…` : s;
}

// Insert a transaction + its sync CREATE — the same write path as a manual log.
function logTransaction(c: ParsedCapture, categoryId: string, type: TransactionType): Transaction {
  const tx: Transaction = {
    id: generateId(),
    categoryId,
    amount: c.amount,
    type,
    transactedAt: c.occurredAt, // the bank's time, not when the app was opened
    note: noteFor(c),
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
  return tx;
}

function unlogTransaction(txId: string): void {
  db.deleteTransaction(txId);
  db.deleteSyncItemsForTransaction(txId);
}

// Core of the pipeline, separated from the native inbox so it can be driven
// with any batch. Everything is written in one SQLite transaction: a crash
// can't leave a logged expense without its capture row (which would double-log
// on the next run).
export function processCaptures(raws: RawCapture[], ownAccounts: string[]): CaptureRunResult {
  if (raws.length === 0) return EMPTY_RESULT;
  const known = db.getExistingCaptureIds(raws.map((r) => r.id));
  const fresh = raws.filter((r) => !known.has(r.id));
  if (fresh.length === 0) return EMPTY_RESULT;

  const now = Date.now();
  const parsed: { raw: RawCapture; capture: ParsedCapture }[] = [];
  const unparsed: RawCapture[] = [];
  for (const raw of fresh) {
    // Only allowlisted apps ever become transactions — "capture all" debug mode
    // must not turn some random app's notification into an expense.
    const capture = sourceOf(raw.packageName) === 'other' ? null : parseNotification(raw);
    if (capture) parsed.push({ raw, capture });
    else unparsed.push(raw);
  }

  const result: CaptureRunResult = { logged: [], pending: 0, reverted: 0 };

  db.getDb().withTransactionSync(() => {
    for (const raw of unparsed) {
      const body = raw.bigText || raw.text;
      db.insertCapture({
        captureId: raw.id,
        packageName: raw.packageName,
        source: sourceOf(raw.packageName),
        amount: 0,
        direction: 'debit',
        description: '',
        text: raw.title ? `${raw.title}\n${body}` : body,
        occurredAt: raw.postedAt,
        confidence: 'low',
        status: 'unparsed',
        createdAt: now,
      });
    }
    if (parsed.length === 0) return;

    const times = parsed.map((p) => p.capture.occurredAt);
    const from = Math.min(...times) - HISTORY_WINDOW_MS;
    const to = Math.max(...times) + HISTORY_WINDOW_MS;
    const history = db.getCapturesBetween(from, to);
    const previous: ProcessedCapture[] = history
      .filter((h) => h.verdict)
      .map((h) => ({ capture: h, verdict: h.verdict! }));

    const verdicts = classifyCaptures(
      parsed.map((p) => p.capture),
      { ownAccounts, previous, manual: db.getUncapturedTransactionsBetween(from, to) },
    );

    const categories = db.getAllCategories();
    const rules = db.getMerchantRules();

    for (const { raw, capture } of parsed) {
      const verdict = verdicts.get(capture.captureId)!;
      let status: StoredCapture['status'] = 'ignored';
      let transactionId: string | undefined;

      if (verdict.kind === 'income') {
        const tx = logTransaction(capture, INCOME_CATEGORY_ID, 'income');
        result.logged.push(tx);
        status = 'logged';
        transactionId = tx.id;
      } else if (verdict.kind === 'expense') {
        const suggestion = suggestCategory(capture, categories, rules);
        if (suggestion) {
          const tx = logTransaction(capture, suggestion.categoryId, 'expense');
          if (suggestion.ruleKey) db.bumpMerchantRule(suggestion.ruleKey);
          result.logged.push(tx);
          status = 'logged';
          transactionId = tx.id;
        } else {
          status = 'pending';
          result.pending += 1;
        }
      } else if (verdict.kind === 'internal' && verdict.reason === 'pair') {
        // The other leg may have been auto-logged in an earlier run (e.g. MoMo
        // income arrived first, ACB debit later) — it was never real money in
        // or out, so take it back.
        const partner = history.find((h) => h.captureId === verdict.pairedWith);
        if (partner && partner.status !== 'ignored') {
          if (partner.transactionId) {
            unlogTransaction(partner.transactionId);
            result.reverted += 1;
          }
          db.updateCaptureStatus(partner.captureId, 'ignored', null);
        }
      }

      db.insertCapture({
        ...capture,
        packageName: raw.packageName,
        verdict,
        status,
        transactionId,
        createdAt: now,
      });
    }
  });

  return result;
}

// Dev builds only: `adb shell cmd notification post -t "MoMo" …` posts as
// com.android.shell — treat those as MoMo (or ACB when the title starts with
// "ACB") so the whole pipeline can be exercised on an emulator.
const SHELL_PACKAGE = 'com.android.shell';
function devAlias(raw: RawCapture): RawCapture {
  if (!__DEV__ || raw.packageName !== SHELL_PACKAGE) return raw;
  const pkg = /^ACB/i.test(raw.title) ? 'mobile.acb.com.vn' : 'com.mservice.momotransfer';
  return { ...raw, packageName: pkg };
}

// Drain the native inbox through the pipeline, then ack exactly what was
// stored (a capture that lands mid-run stays queued for the next pass).
export function runCapturePipeline(ownAccounts: string[]): CaptureRunResult {
  if (!NotificationCapture.isSupported) return EMPTY_RESULT;
  const raws = NotificationCapture.peekPending().map(devAlias);
  if (raws.length === 0) return EMPTY_RESULT;
  const result = processCaptures(raws, ownAccounts);
  NotificationCapture.removePending(raws.map((r) => r.id));
  db.pruneCaptures(Date.now() - PRUNE_AFTER_MS);
  return result;
}

// Inbox: file an uncategorized capture into a bubble, and remember the choice
// for that merchant.
export function assignCapture(captureId: string, categoryId: string): Transaction | null {
  const capture = db.getCapture(captureId);
  if (!capture || capture.status !== 'pending') return null;
  let tx: Transaction | null = null;
  db.getDb().withTransactionSync(() => {
    tx = logTransaction(capture, categoryId, 'expense');
    db.updateCaptureStatus(captureId, 'logged', tx.id);
    learnRule(capture, categoryId);
  });
  return tx;
}

// Inbox: not an expense (internal transfer the classifier missed, a refund, …).
export function dismissCapture(captureId: string): void {
  db.updateCaptureStatus(captureId, 'ignored', null);
}

// Toast "Undo": take back a batch of auto-logged transactions.
export function undoAutoLogged(txIds: string[]): void {
  db.getDb().withTransactionSync(() => {
    for (const txId of txIds) {
      const capture = db.getCaptureByTransaction(txId);
      unlogTransaction(txId);
      if (capture) db.updateCaptureStatus(capture.captureId, 'ignored', null);
    }
  });
}

// History edit: moving an auto-logged expense to another bubble teaches the
// rule for next time. No-op for hand-entered transactions.
export function learnFromEdit(txId: string, categoryId: string): void {
  const capture = db.getCaptureByTransaction(txId);
  if (!capture || capture.direction !== 'debit' || categoryId === INCOME_CATEGORY_ID) return;
  learnRule(capture, categoryId);
}

function learnRule(capture: ParsedCapture, categoryId: string): void {
  const key = merchantKey(capture.description);
  if (key.length >= 4) db.upsertMerchantRule(key, categoryId);
}
