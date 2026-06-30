// Per-level data loading for the Insight drill-down. Each hook owns one level's
// SQLite read(s) and returns `null` while loading so the screen can show a
// skeleton. The reads are synchronous (expo-sqlite), so the skeleton is shown
// for the first paint only; later param changes swap data without a flash.
//
// All aggregation lives in the SQL helpers (lib/db.ts). What's left here is the
// small amount of derivation that isn't a GROUP BY: the empty-bucket gaps are
// filled by the presentational components, and the day-of-month → calendar range
// mapping for the week level lives in `weekDayRange`.

import { useEffect, useState } from 'react';
import * as db from '@/lib/db';
import type {
  CategoryTotal,
  DailyTotal,
  MonthlyTotal,
  TransactionWithCategory,
  WeeklyTotal,
} from '@/types';

// Week buckets are fixed day-of-month groups: 0 → 1–7, 1 → 8–14, 2 → 15–21,
// 3 → 22–end (the last group absorbs the tail of the month). Capped at 3.
export function weekDayRange(weekIdx: number): { startDay: number; endDay: number } {
  const startDay = weekIdx * 7 + 1;
  const endDay = weekIdx === 3 ? 31 : (weekIdx + 1) * 7;
  return { startDay, endDay };
}

// Year level — 12 months of expense/income totals.
export function useMonthlyTotals(year: number): MonthlyTotal[] | null {
  const [data, setData] = useState<MonthlyTotal[] | null>(null);
  useEffect(() => {
    setData(db.getMonthlyTotals(year));
  }, [year]);
  return data;
}

export type MonthDetail = {
  weekly: WeeklyTotal[];
  categories: CategoryTotal[];
  prevExpense: number; // previous month's total expense, for the MoM comparison
};

// Month level — 4 weekly totals + the month's category breakdown + the previous
// month's expense total (for the month-over-month delta). January's previous
// month rolls back to the prior December.
export function useMonthDetail(year: number, month: number): MonthDetail | null {
  const [data, setData] = useState<MonthDetail | null>(null);
  useEffect(() => {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    setData({
      weekly: db.getWeeklyTotals(year, month),
      categories: db.getCategoryTotalsByMonth(year, month),
      prevExpense: db.getMonthExpenseTotal(prevYear, prevMonth),
    });
  }, [year, month]);
  return data;
}

export type WeekDetail = { daily: DailyTotal[]; categories: CategoryTotal[] };

// Week level — daily totals for the week's day range + that week's breakdown.
export function useWeekDetail(year: number, month: number, weekIdx: number): WeekDetail | null {
  const [data, setData] = useState<WeekDetail | null>(null);
  useEffect(() => {
    const { startDay, endDay } = weekDayRange(weekIdx);
    setData({
      daily: db.getDailyTotals(year, month, weekIdx),
      categories: db.getCategoryTotalsByWeek(year, month, startDay, endDay),
    });
  }, [year, month, weekIdx]);
  return data;
}

// Day sheet — the day's transactions (expenses; income rows have no category to
// join). `sel` is null while the sheet is closed; the last result is kept during
// the close animation so the list doesn't flash empty on the way out. We depend
// on the primitive month/day (not the `sel` object) so an inline-created arg
// doesn't re-run the effect every render — that would loop, since each query
// returns a fresh array.
export function useDayTransactions(
  year: number,
  sel: { month: number; day: number } | null,
): TransactionWithCategory[] | null {
  const [data, setData] = useState<TransactionWithCategory[] | null>(null);
  const month = sel?.month ?? null;
  const day = sel?.day ?? null;
  useEffect(() => {
    if (month === null || day === null) return;
    setData(db.getTransactionsByDate(year, month, day));
  }, [year, month, day]);
  return data;
}
