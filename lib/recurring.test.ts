import { getDueTemplates, localDateISO, shouldFireToday } from './recurring';
import type { RecurringTemplate } from '@/types';

// Fixed "now" for every case: Monday 2025-03-10.
const TODAY = '2025-03-10';
const DAY_OF_WEEK = 1; // Monday
const DAY_OF_MONTH = 10;

function template(partial: Partial<RecurringTemplate>): RecurringTemplate {
  return {
    id: 't1',
    categoryId: 'cat1',
    amount: 100,
    frequency: 'daily',
    active: true,
    createdAt: 0,
    ...partial,
  };
}

const isDue = (t: RecurringTemplate) => shouldFireToday(t, TODAY, DAY_OF_WEEK, DAY_OF_MONTH);

describe('localDateISO', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(localDateISO(new Date(2025, 2, 10))).toBe('2025-03-10');
    expect(localDateISO(new Date(2026, 11, 1))).toBe('2026-12-01');
  });
});

describe('shouldFireToday — daily', () => {
  it('fires when it has never fired', () => {
    expect(isDue(template({ frequency: 'daily' }))).toBe(true);
  });

  it('fires when it last fired on an earlier day', () => {
    expect(isDue(template({ frequency: 'daily', lastFiredDate: '2025-03-09' }))).toBe(true);
  });

  it('does not fire twice on the same day', () => {
    expect(isDue(template({ frequency: 'daily', lastFiredDate: TODAY }))).toBe(false);
  });
});

describe('shouldFireToday — weekly', () => {
  it('fires only on the matching weekday', () => {
    expect(isDue(template({ frequency: 'weekly', dayOfWeek: DAY_OF_WEEK }))).toBe(true);
    expect(isDue(template({ frequency: 'weekly', dayOfWeek: 3 }))).toBe(false);
  });

  it('does not fire twice on the same day even when the weekday matches', () => {
    expect(
      isDue(template({ frequency: 'weekly', dayOfWeek: DAY_OF_WEEK, lastFiredDate: TODAY })),
    ).toBe(false);
  });

  it('fires again the following week', () => {
    expect(
      isDue(
        template({ frequency: 'weekly', dayOfWeek: DAY_OF_WEEK, lastFiredDate: '2025-03-03' }),
      ),
    ).toBe(true);
  });
});

describe('shouldFireToday — monthly', () => {
  it('fires only on the matching day of month', () => {
    expect(isDue(template({ frequency: 'monthly', dayOfMonth: DAY_OF_MONTH }))).toBe(true);
    expect(isDue(template({ frequency: 'monthly', dayOfMonth: 11 }))).toBe(false);
  });

  it('does not fire twice on the same day even when the day matches', () => {
    expect(
      isDue(template({ frequency: 'monthly', dayOfMonth: DAY_OF_MONTH, lastFiredDate: TODAY })),
    ).toBe(false);
  });

  it('fires again the following month', () => {
    expect(
      isDue(
        template({ frequency: 'monthly', dayOfMonth: DAY_OF_MONTH, lastFiredDate: '2025-02-10' }),
      ),
    ).toBe(true);
  });
});

describe('shouldFireToday — inactive', () => {
  it('never fires an inactive template', () => {
    expect(isDue(template({ frequency: 'daily', active: false }))).toBe(false);
    expect(
      isDue(template({ frequency: 'weekly', dayOfWeek: DAY_OF_WEEK, active: false })),
    ).toBe(false);
  });
});

describe('getDueTemplates', () => {
  it('keeps only the due templates from a mixed list', () => {
    const due = getDueTemplates(
      [
        template({ id: 'daily-due', frequency: 'daily' }),
        template({ id: 'daily-done', frequency: 'daily', lastFiredDate: TODAY }),
        template({ id: 'weekly-due', frequency: 'weekly', dayOfWeek: DAY_OF_WEEK }),
        template({ id: 'weekly-off', frequency: 'weekly', dayOfWeek: 5 }),
        template({ id: 'monthly-due', frequency: 'monthly', dayOfMonth: DAY_OF_MONTH }),
        template({ id: 'monthly-off', frequency: 'monthly', dayOfMonth: 1 }),
        template({ id: 'inactive', frequency: 'daily', active: false }),
      ],
      TODAY,
      DAY_OF_WEEK,
      DAY_OF_MONTH,
    );
    expect(due.map((t) => t.id)).toEqual(['daily-due', 'weekly-due', 'monthly-due']);
  });

  it('returns an empty list when nothing is due', () => {
    expect(
      getDueTemplates(
        [template({ frequency: 'weekly', dayOfWeek: 2 })],
        TODAY,
        DAY_OF_WEEK,
        DAY_OF_MONTH,
      ),
    ).toEqual([]);
  });
});
