// Zustand store for UI state (modals, drag mode, active period)

import { create } from 'zustand';
import type { Period } from '@/types';

type UIState = {
  activeModal: string | null; // categoryId or null
  dragMode: boolean;
  activePeriod: Period;

  openModal: (categoryId: string) => void;
  closeModal: () => void;
  enterDragMode: () => void;
  exitDragMode: () => void;
  setPeriod: (period: Period) => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeModal: null,
  dragMode: false,
  activePeriod: 'today',

  openModal: (categoryId) => set({ activeModal: categoryId }),
  closeModal: () => set({ activeModal: null }),
  enterDragMode: () => set({ dragMode: true }),
  exitDragMode: () => set({ dragMode: false }),
  setPeriod: (period) => set({ activePeriod: period }),
}));
