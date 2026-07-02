import { computeTrendPoints } from './trend';

describe('computeTrendPoints', () => {
  it('returns null when there is nothing to plot', () => {
    expect(computeTrendPoints([])).toBeNull();
    expect(computeTrendPoints([100])).toBeNull(); // a single point is not a line
    expect(computeTrendPoints([0, 0, 0])).toBeNull(); // no spend
  });

  it('rejects a span smaller than the series', () => {
    expect(computeTrendPoints([1, 2, 3], 2)).toBeNull();
  });

  it('normalizes y to the series max and spaces x evenly', () => {
    const pts = computeTrendPoints([50, 100, 25])!;
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 0, y: 0.5 });
    expect(pts[1]).toEqual({ x: 0.5, y: 1 });
    expect(pts[2]).toEqual({ x: 1, y: 0.25 });
  });

  it('plots a partial series against a wider span without stretching', () => {
    // 7 months of a 12-slot year — the line should end at x = 6/11, not x = 1.
    const values = [10, 20, 30, 40, 50, 60, 70];
    const pts = computeTrendPoints(values, 12)!;
    expect(pts).toHaveLength(7);
    expect(pts[0].x).toBe(0);
    expect(pts[6].x).toBeCloseTo(6 / 11);
    expect(pts[6].y).toBe(1);
  });

  it('clamps negative values to the baseline', () => {
    const pts = computeTrendPoints([-5, 10])!;
    expect(pts[0].y).toBe(0);
    expect(pts[1].y).toBe(1);
  });
});
