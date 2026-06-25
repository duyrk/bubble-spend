// Bubble diameter from a category's spend. Linear scale from BUBBLE_BASE (zero
// spend) to BUBBLE_MAX (the highest-spending category), per docs/decisions.md.
// Pure so it can be unit-tested; `recalcSizes` in the category store uses it.

import { SIZES } from '@/constants/theme';

export function computeBubbleSize(total: number, maxAmount: number): number {
  const ratio = maxAmount > 0 ? total / maxAmount : 0;
  return SIZES.BUBBLE_BASE + ratio * (SIZES.BUBBLE_MAX - SIZES.BUBBLE_BASE);
}
