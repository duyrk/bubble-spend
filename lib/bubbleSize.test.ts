import { computeBubbleSize } from './bubbleSize';
import { SIZES } from '@/constants/theme';

describe('computeBubbleSize', () => {
  it('returns the base size for zero spend', () => {
    expect(computeBubbleSize(0, 100)).toBe(SIZES.BUBBLE_BASE);
  });

  it('returns the max size for the top-spending category', () => {
    expect(computeBubbleSize(100, 100)).toBe(SIZES.BUBBLE_MAX);
  });

  it('scales linearly between base and max', () => {
    const mid = SIZES.BUBBLE_BASE + (SIZES.BUBBLE_MAX - SIZES.BUBBLE_BASE) / 2;
    expect(computeBubbleSize(50, 100)).toBe(mid);
  });

  it('falls back to base size when there is no spend at all', () => {
    expect(computeBubbleSize(0, 0)).toBe(SIZES.BUBBLE_BASE);
  });
});
