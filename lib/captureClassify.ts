// Capture classification — decides what each parsed notification means before
// anything is logged: an expense, income, a transfer between the user's own
// MoMo wallet and ACB account (not spending), or a duplicate of something
// already seen. Pure: imports only types (+ the pure fold helper), unit-tested
// in captureClassify.test.ts. Bubble assignment is a separate step.

import { fold } from './notificationParser';
import type { CaptureVerdict, ParsedCapture, TransactionType } from '@/types';

// Same notification re-posted by the same app (new key, same content).
const SAME_SOURCE_WINDOW_MS = 2 * 60 * 1000;
// ACB ↔ MoMo legs of one movement arrive within seconds; 5 min is generous.
const CROSS_SOURCE_WINDOW_MS = 5 * 60 * 1000;
// User typed the spend in by hand around the time the bank notified.
const MANUAL_WINDOW_MS = 15 * 60 * 1000;

// Money moving between the user's own ACB account and MoMo wallet. Every
// pattern names a top-up / withdrawal action, so a merchant payment that merely
// mentions MoMo ("thanh toan qua MoMo") is not caught here.
const INTERNAL_PATTERNS: RegExp[] = [
  // ACB side — "GD: … RUT TIEN TU VI MOMO 09xxxxxxxx CASHOUT"
  /RUT TIEN TU VI MOMO/,
  /NAP TIEN (VAO )?VI MOMO/,
  /\bMOMO\b.*\b(CASHOUT|CASHIN|TOPUP)\b/,
  /\b(CASHOUT|CASHIN|TOPUP)\b.*\bMOMO\b/,
  // MoMo side — wallet top-up from / withdrawal to the linked bank
  /NAP TIEN (VAO VI|TU (NGAN HANG|ACB|TAI KHOAN|TK))/,
  /RUT TIEN (VE|DEN|SANG) (NGAN HANG|ACB|TAI KHOAN|TK)/,
  // MoMo's savings pot — money parked there is still the user's.
  /TUI THAN TAI/,
];

export type ManualTransaction = {
  id: string;
  amount: number;
  type: TransactionType;
  transactedAt: number;
};

export type ProcessedCapture = {
  capture: ParsedCapture;
  verdict: CaptureVerdict;
};

export type ClassifyContext = {
  // Account numbers / holder names the user owns; a capture mentioning one is
  // a transfer to self. Entries shorter than 4 chars are ignored.
  ownAccounts: string[];
  // Captures already processed in earlier runs (for pairing / dedup across
  // app opens). Only their recent tail matters.
  previous: ProcessedCapture[];
  // Hand-entered transactions near the batch's time span.
  manual: ManualTransaction[];
};

export function isInternalByKeyword(capture: ParsedCapture): boolean {
  const folded = fold(capture.text);
  return INTERNAL_PATTERNS.some((re) => re.test(folded));
}

export function mentionsOwnAccount(capture: ParsedCapture, ownAccounts: string[]): boolean {
  const folded = fold(capture.text);
  return ownAccounts.some((acc) => {
    const needle = fold(acc.trim());
    return needle.length >= 4 && folded.includes(needle);
  });
}

const within = (a: number, b: number, windowMs: number) => Math.abs(a - b) <= windowMs;

// Classifies `batch` (new captures) against each other and the context.
// Returns a verdict per captureId. A pair verdict is always symmetric within
// the batch; when the opposite leg is in `previous` (already handled in an
// earlier run) only the new leg gets the verdict — the caller reverts the old
// one via `pairedWith`.
export function classifyCaptures(
  batch: ParsedCapture[],
  ctx: ClassifyContext,
): Map<string, CaptureVerdict> {
  // Seeded with earlier verdicts so pairing / dedup see what's already taken.
  const verdicts = new Map<string, CaptureVerdict>(
    ctx.previous.map((p) => [p.capture.captureId, p.verdict]),
  );
  const ordered = [...batch].sort((a, b) => a.occurredAt - b.occurredAt);
  // Captures a new one may be matched against: everything before it.
  const seen: ParsedCapture[] = ctx.previous.map((p) => p.capture);
  const batchIds = new Set(batch.map((c) => c.captureId));

  for (const cap of ordered) {
    // Already decided as the second leg of a pair found earlier in this batch.
    if (!verdicts.has(cap.captureId)) {
      verdicts.set(cap.captureId, classifyOne(cap, seen, ctx, verdicts));
    }
    seen.push(cap);
  }

  return new Map([...verdicts].filter(([id]) => batchIds.has(id)));
}

function classifyOne(
  cap: ParsedCapture,
  seen: ParsedCapture[],
  ctx: ClassifyContext,
  verdicts: Map<string, CaptureVerdict>,
): CaptureVerdict {
  if (isInternalByKeyword(cap)) return { kind: 'internal', reason: 'keyword' };
  if (mentionsOwnAccount(cap, ctx.ownAccounts)) return { kind: 'internal', reason: 'own-account' };

  const sameSource = seen.find(
    (o) =>
      o.source === cap.source &&
      o.direction === cap.direction &&
      o.amount === cap.amount &&
      within(o.occurredAt, cap.occurredAt, SAME_SOURCE_WINDOW_MS),
  );
  if (sameSource) return { kind: 'duplicate', of: sameSource.captureId, reason: 'same-source' };

  // Opposite legs from different apps — money left one of the user's accounts
  // and landed in the other. A leg already consumed by another pair is skipped.
  const partner = seen.find(
    (o) =>
      o.source !== cap.source &&
      o.direction !== cap.direction &&
      o.amount === cap.amount &&
      within(o.occurredAt, cap.occurredAt, CROSS_SOURCE_WINDOW_MS) &&
      !isPairedAlready(o.captureId, verdicts),
  );
  if (partner) {
    // Marked in the working map either way so it can't pair twice; only a
    // batch partner's verdict is returned — an earlier-run partner is reverted
    // by the caller via `pairedWith`.
    verdicts.set(partner.captureId, { kind: 'internal', reason: 'pair', pairedWith: cap.captureId });
    return { kind: 'internal', reason: 'pair', pairedWith: partner.captureId };
  }

  // Same movement reported by both apps (e.g. a MoMo payment funded from the
  // linked ACB account) — keep the first.
  const crossDup = seen.find(
    (o) =>
      o.source !== cap.source &&
      o.direction === cap.direction &&
      o.amount === cap.amount &&
      within(o.occurredAt, cap.occurredAt, CROSS_SOURCE_WINDOW_MS) &&
      verdicts.get(o.captureId)?.kind !== 'internal',
  );
  if (crossDup) return { kind: 'duplicate', of: crossDup.captureId, reason: 'cross-source' };

  const type: TransactionType = cap.direction === 'debit' ? 'expense' : 'income';
  const manual = ctx.manual.find(
    (t) => t.type === type && t.amount === cap.amount && within(t.transactedAt, cap.occurredAt, MANUAL_WINDOW_MS),
  );
  if (manual) return { kind: 'duplicate', of: manual.id, reason: 'manual' };

  return type === 'expense' ? { kind: 'expense' } : { kind: 'income' };
}

function isPairedAlready(captureId: string, verdicts: Map<string, CaptureVerdict>): boolean {
  const v = verdicts.get(captureId);
  return v?.kind === 'internal' && v.reason === 'pair';
}
