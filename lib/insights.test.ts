import { computeCategoryBreakdown } from './insights';
import type { Transaction } from '@/types';
import { INCOME_CATEGORY_ID } from '@/types';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    categoryId: 'a',
    amount: 0,
    type: 'expense',
    transactedAt: 0,
    synced: false,
    ...partial,
  };
}

const valid = new Set(['a', 'b', 'c']);

describe('computeCategoryBreakdown', () => {
  it('sums expenses per category, largest first, with share-of-total ratios', () => {
    const slices = computeCategoryBreakdown(
      [
        tx({ categoryId: 'a', amount: 30 }),
        tx({ categoryId: 'b', amount: 60 }),
        tx({ categoryId: 'a', amount: 10 }),
      ],
      valid,
    );
    expect(slices.map((s) => s.categoryId)).toEqual(['b', 'a']);
    expect(slices[0]).toMatchObject({ categoryId: 'b', total: 60, ratio: 0.6 });
    expect(slices[1]).toMatchObject({ categoryId: 'a', total: 40 });
    expect(slices[1].ratio).toBeCloseTo(0.4);
    expect(slices.reduce((s, x) => s + x.ratio, 0)).toBeCloseTo(1);
  });

  it('excludes income and the income sentinel', () => {
    const slices = computeCategoryBreakdown(
      [
        tx({ categoryId: 'a', amount: 50 }),
        tx({ categoryId: INCOME_CATEGORY_ID, amount: 999, type: 'income' }),
        tx({ categoryId: 'b', amount: 100, type: 'income' }),
      ],
      valid,
    );
    expect(slices).toHaveLength(1);
    expect(slices[0]).toMatchObject({ categoryId: 'a', total: 50, ratio: 1 });
  });

  it('ignores transactions filed under unknown categories', () => {
    const slices = computeCategoryBreakdown(
      [tx({ categoryId: 'a', amount: 10 }), tx({ categoryId: 'ghost', amount: 90 })],
      valid,
    );
    expect(slices).toHaveLength(1);
    expect(slices[0]).toMatchObject({ categoryId: 'a', total: 10, ratio: 1 });
  });

  it('returns an empty array when there are no expenses', () => {
    expect(computeCategoryBreakdown([], valid)).toEqual([]);
    expect(
      computeCategoryBreakdown([tx({ amount: 5, type: 'income', categoryId: INCOME_CATEGORY_ID })], valid),
    ).toEqual([]);
  });
});
