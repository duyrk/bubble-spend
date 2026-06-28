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
  // Category id pending delete confirmation (long-press in drag mode). null = no sheet.
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
  requestDeleteCategory: (categoryId: string) => void;
  cancelDeleteCategory: () => void;
  setSheetVisible: (visible: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeModal: null,
  dragMode: false,
  activePeriod: 'today',
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
  requestDeleteCategory: (categoryId) => set({ pendingDeleteCategoryId: categoryId }),
  cancelDeleteCategory: () => set({ pendingDeleteCategoryId: null }),
  setSheetVisible: (visible) => set({ sheetVisible: visible }),
}));
