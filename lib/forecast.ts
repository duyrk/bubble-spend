// Spending-pace math — pure, no RN/native imports, unit-tested. Projects a full
// calendar-month spend from month-to-date, and compares two months. `now` is
// injected so tests stay deterministic; callers use the default (current time).

export type MonthProjection = {
  projected: number; // extrapolated full-month spend at the current daily rate
  dayOfMonth: number; // 1-31 — days elapsed including today
  daysInMonth: number; // length of the current month
  fractionElapsed: number; // dayOfMonth / daysInMonth, 0..1
};

export function projectMonthlySpend(
  spentSoFar: number,
  now: Date = new Date(),
): MonthProjection {
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = dayOfMonth > 0 ? (spentSoFar / dayOfMonth) * daysInMonth : spentSoFar;
  return {
    projected,
    dayOfMonth,
    daysInMonth,
    fractionElapsed: daysInMonth > 0 ? dayOfMonth / daysInMonth : 0,
  };
}

export type MonthDelta = {
  delta: number; // current − previous
  ratio: number | null; // delta / previous; null when there's no baseline to compare
  direction: 'up' | 'down' | 'flat';
};

export function computeMonthDelta(current: number, previous: number): MonthDelta {
  const delta = current - previous;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const ratio = previous > 0 ? delta / previous : null;
  return { delta, ratio, direction };
}
