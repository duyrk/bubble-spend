// Period → [start, end) millisecond range. Pure and side-effect free so it can
// be unit-tested with an injected `now`; the live app and stores call it with
// the default (current time). Week boundary is Monday-first to match the
// calendar and the app's "This week" semantics.

import type { Period } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getPeriodRange(
  period: Period,
  now: Date = new Date(),
): { start: number; end: number } {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  switch (period) {
    case 'today':
      return { start: startOfDay, end: startOfDay + DAY_MS };
    case 'yesterday':
      return { start: startOfDay - DAY_MS, end: startOfDay };
    case 'week': {
      const dayOfWeek = now.getDay(); // 0=Sun
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = startOfDay - mondayOffset * DAY_MS;
      return { start: weekStart, end: weekStart + 7 * DAY_MS };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return { start: monthStart, end: monthEnd };
    }
  }
}
