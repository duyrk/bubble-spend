// Pure peak-spending math — reduces weekday×hour expense cells (from SQL) to
// "you spend most on <weekday>, mostly in the <time bucket>". No RN/expo
// imports so Jest runs it without native shims.

export type PeakCell = {
  weekday: number; // 0=Sun … 6=Sat
  hour: number; // 0–23, local time
  total: number;
};

export type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'night';

// Fixed evaluation order — also the tie-break order (earlier bucket wins).
export const TIME_BUCKETS: TimeBucket[] = ['morning', 'afternoon', 'evening', 'night'];

export type PeakSpending = {
  weekday: number | null; // 0=Sun … 6=Sat; null when there's no spend
  weekdayTotal: number;
  bucket: TimeBucket | null;
  bucketTotal: number;
};

export function hourToBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night'; // 23:00–04:59
}

// Argmax over weekday sums and time-bucket sums. Ties resolve to the earlier
// weekday (Sun-first, matching JS getDay) / earlier bucket, so the result is
// deterministic. Both peaks are null when the cells carry no positive spend.
export function computePeakSpending(cells: PeakCell[]): PeakSpending {
  const weekdaySums = new Array<number>(7).fill(0);
  const bucketSums: Record<TimeBucket, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };

  for (const cell of cells) {
    if (cell.total <= 0) continue;
    if (cell.weekday >= 0 && cell.weekday <= 6) weekdaySums[cell.weekday] += cell.total;
    bucketSums[hourToBucket(cell.hour)] += cell.total;
  }

  let weekday: number | null = null;
  let weekdayTotal = 0;
  for (let d = 0; d < 7; d++) {
    if (weekdaySums[d] > weekdayTotal) {
      weekday = d;
      weekdayTotal = weekdaySums[d];
    }
  }

  let bucket: TimeBucket | null = null;
  let bucketTotal = 0;
  for (const b of TIME_BUCKETS) {
    if (bucketSums[b] > bucketTotal) {
      bucket = b;
      bucketTotal = bucketSums[b];
    }
  }

  return { weekday, weekdayTotal, bucket, bucketTotal };
}
