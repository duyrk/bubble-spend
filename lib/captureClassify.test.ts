import { classifyCaptures, type ClassifyContext } from './captureClassify';
import type { ParsedCapture } from '@/types';

const T0 = new Date(2026, 9, 6, 12, 0).getTime();
const MIN = 60 * 1000;

function cap(partial: Partial<ParsedCapture> & Pick<ParsedCapture, 'captureId'>): ParsedCapture {
  return {
    source: 'acb',
    amount: 100000,
    direction: 'debit',
    description: '',
    text: '',
    occurredAt: T0,
    confidence: 'high',
    ...partial,
  };
}

const emptyCtx: ClassifyContext = { ownAccounts: [], previous: [], manual: [] };

describe('classifyCaptures — plain', () => {
  it('debit → expense, credit → income', () => {
    const v = classifyCaptures(
      [cap({ captureId: 'a' }), cap({ captureId: 'b', direction: 'credit', occurredAt: T0 + 60 * MIN })],
      emptyCtx,
    );
    expect(v.get('a')).toEqual({ kind: 'expense' });
    expect(v.get('b')).toEqual({ kind: 'income' });
  });
});

describe('classifyCaptures — internal transfers', () => {
  it('detects the ACB cash-out keyword', () => {
    const v = classifyCaptures(
      [
        cap({
          captureId: 'a',
          direction: 'credit',
          text: 'ACB: TK 1(VND) + 10,000 … GD: CONG TY … CK, RUT TIEN TU VI MOMO 0900000000 CASHOUT',
        }),
      ],
      emptyCtx,
    );
    expect(v.get('a')).toEqual({ kind: 'internal', reason: 'keyword' });
  });

  it('detects a MoMo top-up from the bank', () => {
    const v = classifyCaptures(
      [cap({ captureId: 'm', source: 'momo', direction: 'credit', text: 'Nạp tiền từ ngân hàng ACB thành công 500.000đ' })],
      emptyCtx,
    );
    expect(v.get('m')).toEqual({ kind: 'internal', reason: 'keyword' });
  });

  it('treats money moved into MoMo\'s Túi Thần Tài as internal', () => {
    const v = classifyCaptures(
      [
        cap({
          captureId: 'm',
          source: 'momo',
          direction: 'credit',
          text: 'Nhận chuyển khoản từ NGUYEN VAN A\nSố tiền 10.000 ₫ về Túi Thần Tài.',
        }),
      ],
      emptyCtx,
    );
    expect(v.get('m')).toEqual({ kind: 'internal', reason: 'keyword' });
  });

  it('does not treat a merchant payment mentioning MoMo as internal', () => {
    const v = classifyCaptures(
      [cap({ captureId: 'a', text: 'GD: THANH TOAN QUA MOMO CHO SHOPEE' })],
      emptyCtx,
    );
    expect(v.get('a')).toEqual({ kind: 'expense' });
  });

  it('pairs opposite legs from the two apps within the window', () => {
    const v = classifyCaptures(
      [
        cap({ captureId: 'acb', source: 'acb', direction: 'debit', amount: 500000 }),
        cap({ captureId: 'momo', source: 'momo', direction: 'credit', amount: 500000, occurredAt: T0 + 30 * 1000 }),
      ],
      emptyCtx,
    );
    expect(v.get('acb')).toEqual({ kind: 'internal', reason: 'pair', pairedWith: 'momo' });
    expect(v.get('momo')).toEqual({ kind: 'internal', reason: 'pair', pairedWith: 'acb' });
  });

  it('does not pair outside the window or across different amounts', () => {
    const v = classifyCaptures(
      [
        cap({ captureId: 'acb', direction: 'debit', amount: 500000 }),
        cap({ captureId: 'late', source: 'momo', direction: 'credit', amount: 500000, occurredAt: T0 + 10 * MIN }),
        cap({ captureId: 'diff', source: 'momo', direction: 'credit', amount: 499000, occurredAt: T0 + MIN }),
      ],
      emptyCtx,
    );
    expect(v.get('acb')).toEqual({ kind: 'expense' });
    expect(v.get('late')).toEqual({ kind: 'income' });
    expect(v.get('diff')).toEqual({ kind: 'income' });
  });

  it('pairs with a leg handled in an earlier run and only returns the new verdict', () => {
    const previous = [{ capture: cap({ captureId: 'old-acb', amount: 300000 }), verdict: { kind: 'expense' as const } }];
    const v = classifyCaptures(
      [cap({ captureId: 'new-momo', source: 'momo', direction: 'credit', amount: 300000, occurredAt: T0 + MIN })],
      { ...emptyCtx, previous },
    );
    expect(v.get('new-momo')).toEqual({ kind: 'internal', reason: 'pair', pairedWith: 'old-acb' });
    expect(v.has('old-acb')).toBe(false);
  });

  it('uses each leg in at most one pair', () => {
    const v = classifyCaptures(
      [
        cap({ captureId: 'acb', direction: 'debit', amount: 100000 }),
        cap({ captureId: 'm1', source: 'momo', direction: 'credit', amount: 100000, occurredAt: T0 + 30 * 1000 }),
        cap({ captureId: 'm2', source: 'momo', direction: 'credit', amount: 100000, occurredAt: T0 + 3 * MIN }),
      ],
      emptyCtx,
    );
    expect(v.get('m1')).toMatchObject({ kind: 'internal', reason: 'pair' });
    expect(v.get('m2')).toEqual({ kind: 'income' });
  });

  it('treats a mention of the user\'s own account as internal', () => {
    const v = classifyCaptures(
      [cap({ captureId: 'a', text: 'GD: CK DEN TK 99887766 NGUYEN KHANH DUY' })],
      { ...emptyCtx, ownAccounts: ['99887766', 'ab'] },
    );
    expect(v.get('a')).toEqual({ kind: 'internal', reason: 'own-account' });
  });
});

describe('classifyCaptures — duplicates', () => {
  it('drops a same-source re-post', () => {
    const v = classifyCaptures(
      [cap({ captureId: 'a' }), cap({ captureId: 'b', occurredAt: T0 + MIN })],
      emptyCtx,
    );
    expect(v.get('a')).toEqual({ kind: 'expense' });
    expect(v.get('b')).toEqual({ kind: 'duplicate', of: 'a', reason: 'same-source' });
  });

  it('drops the second report of one payment from the other app', () => {
    const v = classifyCaptures(
      [
        cap({ captureId: 'momo', source: 'momo', amount: 35000 }),
        cap({ captureId: 'acb', source: 'acb', amount: 35000, occurredAt: T0 + 20 * 1000 }),
      ],
      emptyCtx,
    );
    expect(v.get('momo')).toEqual({ kind: 'expense' });
    expect(v.get('acb')).toEqual({ kind: 'duplicate', of: 'momo', reason: 'cross-source' });
  });

  it('matches a hand-entered transaction of the same amount and type nearby', () => {
    const v = classifyCaptures([cap({ captureId: 'a', amount: 45000 })], {
      ...emptyCtx,
      manual: [{ id: 'tx1', amount: 45000, type: 'expense', transactedAt: T0 - 10 * MIN }],
    });
    expect(v.get('a')).toEqual({ kind: 'duplicate', of: 'tx1', reason: 'manual' });
  });

  it('ignores a manual transaction of the other type or too far away', () => {
    const v = classifyCaptures([cap({ captureId: 'a', amount: 45000 })], {
      ...emptyCtx,
      manual: [
        { id: 'inc', amount: 45000, type: 'income', transactedAt: T0 },
        { id: 'old', amount: 45000, type: 'expense', transactedAt: T0 - 60 * MIN },
      ],
    });
    expect(v.get('a')).toEqual({ kind: 'expense' });
  });
});
