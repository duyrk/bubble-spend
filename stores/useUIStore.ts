// Zustand store for UI state (modals, drag mode, active period)

import { create } from 'zustand';
import type { Period, TransactionType } from '@/types';

// activeModal is non-null whenever the numpad sheet is showing — regardless of
// whether the entry point was a category bubble (expense) or the income pill.
// Consumers that just need to know "is the sheet open?" check `activeModal !== null`.
export type ActiveModal = {
  // null when the modal was opened from the income entry point — no source bubble.
  categoryId: string | null;
  defaultType: TransactionType;
};

type UIState = {
  activeModal: ActiveModal | null;
  dragMode: boolean;
  activePeriod: Period;
  // Category id whose quick-actions menu is open (long-press a bubble). null = closed.
  pendingActionCategoryId: string | null;
  // Where to anchor that menu — the pressed bubble's window-space frame (center x,
  // top edge, bottom edge), captured via measure() at long-press. null = closed.
  pendingActionAnchor: { cx: number; top: number; bottom: number } | null;
  // Category id whose monthly-budget editor sheet is open. null = no sheet.
  budgetEditCategoryId: string | null;
  // Category id pending delete confirmation. null = no sheet.
  pendingDeleteCategoryId: string | null;
  // True while the numpad sheet is anywhere on screen — from the instant it opens
  // until its slide-out animation finishes. Drives the tab bar hide. Tracked
  // separately from `activeModal` so the bar stays hidden through the ~400ms
  // close animation instead of popping back over the still-descending sheet.
  // The NumpadModal owns this flag (covers both the create and edit flows).
  sheetVisible: boolean;

  openModal: (categoryId: string) => void;
  openIncomeModal: () => void;
  closeModal: () => void;
  enterDragMode: () => void;
  exitDragMode: () => void;
  setPeriod: (period: Period) => void;
  requestBubbleActions: (categoryId: string, cx: number, top: number, bottom: number) => void;
  cancelBubbleActions: () => void;
  requestEditBudget: (categoryId: string) => void;
  cancelEditBudget: () => void;
  requestDeleteCategory: (categoryId: string) => void;
  cancelDeleteCategory: () => void;
  setSheetVisible: (visible: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeModal: null,
  dragMode: false,
  activePeriod: 'today',
  pendingActionCategoryId: null,
  pendingActionAnchor: null,
  budgetEditCategoryId: null,
  pendingDeleteCategoryId: null,
  sheetVisible: false,

  openModal: (categoryId) =>
    set({ activeModal: { categoryId, defaultType: 'expense' } }),
  openIncomeModal: () =>
    set({ activeModal: { categoryId: null, defaultType: 'income' } }),
  closeModal: () => set({ activeModal: null }),
  enterDragMode: () => set({ dragMode: true }),
  exitDragMode: () => set({ dragMode: false }),
  setPeriod: (period) => set({ activePeriod: period }),
  requestBubbleActions: (categoryId, cx, top, bottom) =>
    set({ pendingActionCategoryId: categoryId, pendingActionAnchor: { cx, top, bottom } }),
  cancelBubbleActions: () => set({ pendingActionCategoryId: null, pendingActionAnchor: null }),
  // Open the budget editor for a category, closing the quick-actions menu that led here.
  requestEditBudget: (categoryId) =>
    set({ budgetEditCategoryId: categoryId, pendingActionCategoryId: null, pendingActionAnchor: null }),
  cancelEditBudget: () => set({ budgetEditCategoryId: null }),
  // Open the delete confirm, closing the quick-actions menu that led here.
  requestDeleteCategory: (categoryId) =>
    set({ pendingDeleteCategoryId: categoryId, pendingActionCategoryId: null, pendingActionAnchor: null }),
  cancelDeleteCategory: () => set({ pendingDeleteCategoryId: null }),
  setSheetVisible: (visible) => set({ sheetVisible: visible }),
}));
