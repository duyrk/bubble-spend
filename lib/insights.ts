// Spending insights — pure aggregation over a period's transactions. Kept free
// of React/native imports so it can be unit-tested and reused anywhere.

import type { Transaction } from '@/types';

export type CategorySlice = {
  categoryId: string;
  total: number;
  ratio: number; // share of total expense for the period, 0..1
};

// Aggregate expenses into per-category slices, largest first. Income is excluded
// (it has no bubble and must not appear as spending); transactions whose
// categoryId is not in `validCategoryIds` are ignored so a deleted/orphaned
// category can't distort the breakdown.
export function computeCategoryBreakdown(
  transactions: Transaction[],
  validCategoryIds: Set<string>,
): CategorySlice[] {
  const totals = new Map<string, number>();
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (!validCategoryIds.has(tx.categoryId)) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount);
    grandTotal += tx.amount;
  }

  const slices: CategorySlice[] = [];
  for (const [categoryId, total] of totals) {
    slices.push({
      categoryId,
      total,
      ratio: grandTotal > 0 ? total / grandTotal : 0,
    });
  }

  // Largest first; tie-break on id for a stable order across renders.
  slices.sort((a, b) => b.total - a.total || a.categoryId.localeCompare(b.categoryId));
  return slices;
}
