import { computeBudgetStatus, totalBudget, BUDGET_NEAR_THRESHOLD } from './budget';

describe('computeBudgetStatus', () => {
  it('reports no budget when the cap is missing or non-positive', () => {
    for (const b of [undefined, 0, -100]) {
      const s = computeBudgetStatus(500, b as number | undefined);
      expect(s.hasBudget).toBe(false);
      expect(s.level).toBe('none');
      expect(s.ratio).toBe(0);
    }
  });

  it('is "ok" below the near threshold', () => {
    const s = computeBudgetStatus(50, 100);
    expect(s.level).toBe('ok');
    expect(s.ratio).toBeCloseTo(0.5);
    expect(s.remaining).toBe(50);
  });

  it('is "near" at/above the near threshold but under the cap', () => {
    const s = computeBudgetStatus(BUDGET_NEAR_THRESHOLD * 100, 100);
    expect(s.level).toBe('near');
    expect(s.ratio).toBeCloseTo(BUDGET_NEAR_THRESHOLD);
  });

  it('is "over" at or above the cap and clamps the ring sweep to 1', () => {
    const s = computeBudgetStatus(140, 100);
    expect(s.level).toBe('over');
    expect(s.fraction).toBeCloseTo(1.4);
    expect(s.ratio).toBe(1);
    expect(s.remaining).toBe(-40);
  });
});

describe('totalBudget', () => {
  it('sums positive caps and ignores missing/zero ones', () => {
    expect(totalBudget([100, undefined, 0, 250])).toBe(350);
  });
  it('returns 0 when nothing is set', () => {
    expect(totalBudget([undefined, 0])).toBe(0);
  });
});
