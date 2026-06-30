// Per-category monthly budget math — pure, no RN/native imports, unit-tested.
// A category's `budget` is an optional monthly cap in the currency's main unit;
// absent or non-positive means "no budget set" (no ring, no warnings).

export type BudgetLevel = 'none' | 'ok' | 'near' | 'over';

// Spent fraction at which the ring shifts from the accent tint to an amber
// "approaching the cap" warning. At/above 1.0 it becomes the red "over" state.
export const BUDGET_NEAR_THRESHOLD = 0.8;

export type BudgetStatus = {
  hasBudget: boolean;
  fraction: number; // spent / budget, unclamped (can exceed 1)
  ratio: number; // fraction clamped to 0..1 — drives the ring sweep
  level: BudgetLevel;
  remaining: number; // budget − spent (negative once over budget)
};

export function computeBudgetStatus(spent: number, budget?: number): BudgetStatus {
  if (!budget || budget <= 0) {
    return { hasBudget: false, fraction: 0, ratio: 0, level: 'none', remaining: 0 };
  }
  const fraction = spent / budget;
  const ratio = Math.max(0, Math.min(1, fraction));
  const level: BudgetLevel =
    fraction >= 1 ? 'over' : fraction >= BUDGET_NEAR_THRESHOLD ? 'near' : 'ok';
  return { hasBudget: true, fraction, ratio, level, remaining: budget - spent };
}

// Sum of all category caps — the household monthly budget. Categories without a
// cap contribute nothing. Returns 0 when none are set.
export function totalBudget(budgets: (number | undefined)[]): number {
  return budgets.reduce<number>((sum, b) => sum + (b && b > 0 ? b : 0), 0);
}
