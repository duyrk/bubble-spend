import { computePeakSpending, hourToBucket } from './peaks';
import type { PeakCell } from './peaks';

const cell = (weekday: number, hour: number, total: number): PeakCell => ({
  weekday,
  hour,
  total,
});

describe('hourToBucket', () => {
  it('maps hours to the right buckets at the boundaries', () => {
    expect(hourToBucket(4)).toBe('night');
    expect(hourToBucket(5)).toBe('morning');
    expect(hourToBucket(11)).toBe('morning');
    expect(hourToBucket(12)).toBe('afternoon');
    expect(hourToBucket(17)).toBe('afternoon');
    expect(hourToBucket(18)).toBe('evening');
    expect(hourToBucket(22)).toBe('evening');
    expect(hourToBucket(23)).toBe('night');
    expect(hourToBucket(0)).toBe('night');
  });
});

describe('computePeakSpending', () => {
  it('returns nulls when there are no cells or no positive spend', () => {
    expect(computePeakSpending([])).toEqual({
      weekday: null,
      weekdayTotal: 0,
      bucket: null,
      bucketTotal: 0,
    });
    expect(computePeakSpending([cell(1, 9, 0)]).weekday).toBeNull();
  });

  it('finds the peak weekday and bucket from a single cell', () => {
    const p = computePeakSpending([cell(5, 19, 120)]);
    expect(p.weekday).toBe(5);
    expect(p.weekdayTotal).toBe(120);
    expect(p.bucket).toBe('evening');
    expect(p.bucketTotal).toBe(120);
  });

  it('sums cells that share a weekday or bucket before comparing', () => {
    const p = computePeakSpending([
      cell(2, 8, 60), // Tue morning
      cell(2, 20, 60), // Tue evening — Tue total 120
      cell(4, 13, 100), // Thu afternoon
      cell(6, 9, 50), // Sat morning — morning total 110
    ]);
    expect(p.weekday).toBe(2);
    expect(p.weekdayTotal).toBe(120);
    // morning 110 > afternoon 100 > evening 60
    expect(p.bucket).toBe('morning');
    expect(p.bucketTotal).toBe(110);
  });

  it('weekday and bucket peaks are independent', () => {
    // Friday holds the weekday peak, but Friday's spend is at night while the
    // biggest bucket overall is afternoon (spread across other days).
    const p = computePeakSpending([
      cell(5, 23, 200),
      cell(1, 14, 90),
      cell(2, 15, 80),
      cell(3, 16, 70),
    ]);
    expect(p.weekday).toBe(5);
    expect(p.bucket).toBe('afternoon');
    expect(p.bucketTotal).toBe(240);
  });

  it('breaks ties toward the earlier weekday and earlier bucket', () => {
    const p = computePeakSpending([cell(1, 8, 100), cell(3, 14, 100)]);
    expect(p.weekday).toBe(1); // Mon over Wed
    expect(p.bucket).toBe('morning'); // morning over afternoon
  });

  it('ignores non-positive cells', () => {
    const p = computePeakSpending([cell(0, 10, -50), cell(2, 13, 40)]);
    expect(p.weekday).toBe(2);
    expect(p.bucket).toBe('afternoon');
  });
});
