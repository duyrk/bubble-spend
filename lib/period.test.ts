import { getPeriodRange, stepPeriod, PERIOD_ORDER } from './period';

const DAY_MS = 24 * 60 * 60 * 1000;
// A fixed reference moment: 2026-06-24 15:30 local time.
const NOW = new Date(2026, 5, 24, 15, 30, 0);

describe('getPeriodRange', () => {
  it('today spans the current calendar day', () => {
    const { start, end } = getPeriodRange('today', NOW);
    expect(start).toBe(new Date(2026, 5, 24).getTime());
    expect(end).toBe(new Date(2026, 5, 25).getTime());
    expect(end - start).toBe(DAY_MS);
  });

  it('yesterday ends exactly where today starts', () => {
    const yesterday = getPeriodRange('yesterday', NOW);
    const today = getPeriodRange('today', NOW);
    expect(yesterday.start).toBe(new Date(2026, 5, 23).getTime());
    expect(yesterday.end).toBe(today.start);
  });

  it('week is a Monday-first 7-day window containing today', () => {
    const { start, end } = getPeriodRange('week', NOW);
    const today = getPeriodRange('today', NOW);
    expect(new Date(start).getDay()).toBe(1); // Monday
    expect(end - start).toBe(7 * DAY_MS);
    expect(start).toBeLessThanOrEqual(today.start);
    expect(today.start).toBeLessThan(end);
  });

  it('month spans the first of this month to the first of next', () => {
    const { start, end } = getPeriodRange('month', NOW);
    expect(start).toBe(new Date(2026, 5, 1).getTime());
    expect(end).toBe(new Date(2026, 6, 1).getTime());
  });

  it('treats Sunday as the last day of the Monday-first week', () => {
    const sunday = new Date(2026, 5, 28, 9, 0, 0); // 2026-06-28 is a Sunday
    const { start, end } = getPeriodRange('week', sunday);
    expect(new Date(start).getDay()).toBe(1);
    expect(start).toBe(new Date(2026, 5, 22).getTime()); // Mon 2026-06-22
    expect(end).toBe(new Date(2026, 5, 29).getTime());
  });
});

describe('stepPeriod', () => {
  it('steps forward through the canonical order', () => {
    expect(stepPeriod('today', 1)).toBe('yesterday');
    expect(stepPeriod('yesterday', 1)).toBe('week');
    expect(stepPeriod('week', 1)).toBe('month');
  });

  it('steps backward through the canonical order', () => {
    expect(stepPeriod('month', -1)).toBe('week');
    expect(stepPeriod('week', -1)).toBe('yesterday');
    expect(stepPeriod('yesterday', -1)).toBe('today');
  });

  it('clamps at the ends instead of wrapping', () => {
    expect(stepPeriod('today', -1)).toBe('today');
    expect(stepPeriod('month', 1)).toBe('month');
  });

  it('PERIOD_ORDER matches the tab order', () => {
    expect(PERIOD_ORDER).toEqual(['today', 'yesterday', 'week', 'month']);
  });
});
