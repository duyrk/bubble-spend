import { projectMonthlySpend, computeMonthDelta } from './forecast';

describe('projectMonthlySpend', () => {
  it('extrapolates month-to-date by the daily rate', () => {
    // 10 days into a 30-day month, 1000 spent → 3000 projected.
    const now = new Date(2026, 5, 10); // June 2026 (30 days)
    const p = projectMonthlySpend(1000, now);
    expect(p.dayOfMonth).toBe(10);
    expect(p.daysInMonth).toBe(30);
    expect(p.projected).toBeCloseTo(3000);
    expect(p.fractionElapsed).toBeCloseTo(1 / 3);
  });

  it('equals the spend so far on the last day of the month', () => {
    const now = new Date(2026, 1, 28); // Feb 28 2026 (28 days, non-leap)
    const p = projectMonthlySpend(5000, now);
    expect(p.daysInMonth).toBe(28);
    expect(p.projected).toBeCloseTo(5000);
  });
});

describe('computeMonthDelta', () => {
  it('reports an increase with a ratio', () => {
    const d = computeMonthDelta(120, 100);
    expect(d.delta).toBe(20);
    expect(d.ratio).toBeCloseTo(0.2);
    expect(d.direction).toBe('up');
  });

  it('reports a decrease', () => {
    const d = computeMonthDelta(80, 100);
    expect(d.direction).toBe('down');
    expect(d.ratio).toBeCloseTo(-0.2);
  });

  it('has no ratio when there is no baseline', () => {
    const d = computeMonthDelta(50, 0);
    expect(d.ratio).toBeNull();
    expect(d.direction).toBe('up');
  });
});
