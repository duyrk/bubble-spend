// Pure trend-line math — normalizes a series of monthly totals to 0..1
// coordinates for the year-level spending trend chart. No RN/expo imports so
// Jest runs it without native shims; the component scales to pixels.

export type TrendPoint = {
  x: number; // 0..1 across the chart width
  y: number; // 0..1 of the series max (0 = no spend, 1 = peak month)
};

// `span` is the number of slots the x-axis represents. Passing the values for
// January–July with span=12 plots a partial-year line that ends at July's slot
// instead of stretching seven points across the full width.
export function computeTrendPoints(values: number[], span = values.length): TrendPoint[] | null {
  if (values.length < 2 || span < 2 || values.length > span) return null;
  const max = Math.max(...values);
  if (max <= 0) return null;
  return values.map((v, i) => ({
    x: i / (span - 1),
    y: Math.max(0, v) / max,
  }));
}
