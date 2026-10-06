// Notification parser — turns a raw bank / e-wallet notification (as queued by
// modules/notification-capture) into a structured transaction: amount, money
// in/out, description, and time. Pure: imports only types, unit-tested in
// notificationParser.test.ts.
//
// Matching runs on a "folded" copy of the text (diacritics stripped,
// uppercased) whose character indices line up 1:1 with the original, so the
// description can be sliced from the original with its accents intact.

import type { CaptureSource, ParsedCapture, RawCapture } from '@/types';

export const SOURCE_PACKAGES: Record<string, CaptureSource> = {
  'mobile.acb.com.vn': 'acb',
  'com.mservice.momotransfer': 'momo',
};

// A stated transaction time further than this from the post time is treated as
// a misparse and the post time wins.
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_PAST_SKEW_MS = 3 * 24 * 60 * 60 * 1000;

// Length-preserving diacritic fold + uppercase ("Số dư" → "SO DU").
export function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    if (ch === 'đ' || ch === 'Đ') {
      out += 'D';
      continue;
    }
    const stripped = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const base = stripped.length === ch.length ? stripped : ch;
    const upper = base.toUpperCase();
    out += upper.length === base.length ? upper : base;
  }
  return out;
}

// "10,000" / "10.000" / "1.234.567" / "1,000.00" → integer VND; null if not a
// positive number. VND has no minor unit, so a trailing 1–2 digit fraction is
// dropped rather than read as thousands.
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/[.,]\d{1,2}$/, '');
  const digits = s.replace(/[.,\s]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const n = parseInt(digits, 10);
  return n > 0 ? n : null;
}

function localTime(day: string, month: string, year: string, hour: string, minute: string): number | null {
  const d = new Date(+year, +month - 1, +day, +hour, +minute);
  // Reject rollovers like 31/02.
  if (d.getMonth() !== +month - 1 || d.getDate() !== +day) return null;
  return d.getTime();
}

function plausibleTime(stated: number | null, postedAt: number): number {
  if (stated == null) return postedAt;
  if (stated > postedAt + MAX_FUTURE_SKEW_MS || stated < postedAt - MAX_PAST_SKEW_MS) return postedAt;
  return stated;
}

// "12:30 06/10/2026" or "06/10/2026 12:30" anywhere in the text.
function findStatedTime(folded: string): number | null {
  const timeFirst = folded.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:NGAY\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (timeFirst) {
    const [, hh, mm, dd, mo, yyyy] = timeFirst;
    return localTime(dd, mo, yyyy, hh, mm);
  }
  const dateFirst = folded.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:LUC\s*)?(\d{1,2}):(\d{2})/);
  if (dateFirst) {
    const [, dd, mo, yyyy, hh, mm] = dateFirst;
    return localTime(dd, mo, yyyy, hh, mm);
  }
  return null;
}

function bodyOf(raw: RawCapture): string {
  // bigText carries the untruncated message when the app sets one.
  return (raw.bigText || raw.text || '').trim();
}

// --- ACB ---------------------------------------------------------------------
// "ACB: TK 12345678(VND) + 10,000 luc 19:00 06/10/2026. So du 852,941. GD: …"
const ACB_PATTERN =
  /TK\s*\S*?\s*\(([A-Z]{3})\)\s*([+-])\s*([\d.,]+)\s*LUC\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/;

function parseAcb(raw: RawCapture): ParsedCapture | null {
  const body = bodyOf(raw);
  const folded = fold(body);
  const m = folded.match(ACB_PATTERN);
  if (!m) return null;
  const [, currency, sign, amountStr, hh, mm, dd, mo, yyyy] = m;
  if (currency !== 'VND') return null;
  const amount = parseAmount(amountStr);
  if (amount == null) return null;

  const balanceMatch = folded.match(/SO DU\s*:?\s*(-?[\d.,]+)/);
  const balance = balanceMatch ? parseAmount(balanceMatch[1].replace(/^-/, '')) ?? undefined : undefined;

  const gd = folded.match(/GD\s*:\s*/);
  const description = gd ? body.slice((gd.index ?? 0) + gd[0].length).trim() : '';

  return {
    captureId: raw.id,
    source: 'acb',
    amount,
    direction: sign === '-' ? 'debit' : 'credit',
    description,
    text: raw.title ? `${raw.title}\n${body}` : body,
    occurredAt: plausibleTime(localTime(dd, mo, yyyy, hh, mm), raw.postedAt),
    balance,
    confidence: 'high',
  };
}

// --- Generic (MoMo + fallback) ----------------------------------------------
// Heuristic: needs a transaction hint, no promo/OTP noise, an amount that is
// signed or carries a currency marker (and isn't the balance), and a clear
// direction. Anything ambiguous returns null — a missed capture is better than
// a wrong expense.

const NOISE = /\b(OTP|MA XAC (THUC|NHAN)|KHUYEN MAI|UU DAI|VOUCHER|GIAM GIA|QUA TANG|MA GIAM|TRUNG THUONG)\b/;
const TXN_HINT =
  /(THANH CONG|GIAO DICH|THANH TOAN|NHAN DUOC|DA NHAN|NHAN TIEN|CHUYEN TIEN|CHUYEN KHOAN|SO TIEN|BIEN DONG|SO DU|\bGD\b|\bTK\b|NAP TIEN|RUT TIEN|HOAN TIEN)/;
// Credit is checked first: "nạp tiền vào ví" / "nạp tiền từ ACB" credit the
// wallet, while a bare "nạp tiền" (e.g. phone top-up) falls through to debit.
// No bare "CONG" — it would match "THANH CONG" (success) on every message.
// MoMo: "Nhận chuyển khoản từ X" / "Số tiền 10.000 ₫ về Túi Thần Tài".
const CREDIT_HINT =
  /(NHAN DUOC|DA NHAN|NHAN TIEN|NHAN CHUYEN KHOAN|HOAN TIEN|CONG TIEN|TIEN VAO|NAP TIEN (VAO|TU)|\bVE (VI|TUI)\b)/;
const DEBIT_HINT = /(THANH TOAN|CHUYEN TIEN|CHUYEN KHOAN|DA CHUYEN|TRU TIEN|\bTRU\b|RUT TIEN|DA RUT|NAP TIEN|TIEN RA|MUA)/;

const AMOUNT_RE = /([+-]\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{4,})(?:[.,]\d{1,2})?(\s*(?:VND|DONG|D|₫)(?![A-Z0-9]))?/g;
const BALANCE_BEFORE = /(SO DU|\bSD)\s*(VI|TK|MOI|KHA DUNG|CUOI)?\s*:?\s*$/;
// Where the counterparty / content usually starts.
const DESCRIPTION_MARKERS = /(ND|NOI DUNG|GD)\s*:\s*|\s(CHO|TAI|DEN|TU)\s/;

type AmountHit = { amount: number; sign?: '+' | '-'; index: number; end: number };

function findAmount(folded: string): AmountHit | null {
  AMOUNT_RE.lastIndex = 0;
  for (let m = AMOUNT_RE.exec(folded); m; m = AMOUNT_RE.exec(folded)) {
    const [whole, signPart, integerPart, currency] = m;
    if (!signPart && !currency) continue;
    if (BALANCE_BEFORE.test(folded.slice(Math.max(0, m.index - 20), m.index))) continue;
    const amount = parseAmount(integerPart);
    if (amount == null) continue;
    const sign = signPart ? (signPart.trim() as '+' | '-') : undefined;
    return { amount, sign, index: m.index, end: m.index + whole.length };
  }
  return null;
}

function parseGeneric(raw: RawCapture, source: CaptureSource): ParsedCapture | null {
  const body = bodyOf(raw);
  const full = raw.title ? `${raw.title}\n${body}` : body;
  const folded = fold(full);
  if (NOISE.test(folded) || !TXN_HINT.test(folded)) return null;

  const hit = findAmount(folded);
  if (!hit) return null;

  let direction: ParsedCapture['direction'] | null = null;
  if (hit.sign) direction = hit.sign === '-' ? 'debit' : 'credit';
  else if (CREDIT_HINT.test(folded)) direction = 'credit';
  else if (DEBIT_HINT.test(folded)) direction = 'debit';
  if (!direction) return null;

  // Prefer an explicit marker after the amount, then anywhere; else the body.
  const after = folded.slice(hit.end).match(DESCRIPTION_MARKERS);
  const anywhere = after ? null : folded.match(DESCRIPTION_MARKERS);
  const start = after
    ? hit.end + (after.index ?? 0) + after[0].length
    : anywhere
      ? (anywhere.index ?? 0) + anywhere[0].length
      : -1;
  // Stop at the end of the sentence or line (the title ends at the first \n).
  const description = start >= 0 ? full.slice(start).split(/\.\s|\n/)[0].trim() : body;

  return {
    captureId: raw.id,
    source,
    amount: hit.amount,
    direction,
    description,
    text: full,
    occurredAt: plausibleTime(findStatedTime(folded), raw.postedAt),
    confidence: 'low',
  };
}

export function sourceOf(packageName: string): CaptureSource {
  return SOURCE_PACKAGES[packageName] ?? 'other';
}

export function parseNotification(raw: RawCapture): ParsedCapture | null {
  const source = sourceOf(raw.packageName);
  if (source === 'acb') return parseAcb(raw) ?? parseGeneric(raw, source);
  return parseGeneric(raw, source);
}
