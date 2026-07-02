// Zustand store for recurring expense templates (one per category)

import { create } from 'zustand';
import * as db from '@/lib/db';
import type { RecurringTemplate } from '@/types';

// What the editor sheet saves — the store owns id/createdAt/active and carries
// lastFiredDate over from any template it replaces.
export type RecurringDraft = Omit<
  RecurringTemplate,
  'id' | 'createdAt' | 'active' | 'lastFiredDate'
>;

type RecurringState = {
  templates: RecurringTemplate[];

  load: () => void;
  // Create or replace the category's template (max one per category).
  setForCategory: (draft: RecurringDraft) => void;
  removeForCategory: (categoryId: string) => void;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export const useRecurringStore = create<RecurringState>((set, get) => ({
  templates: [],

  load: () => {
    set({ templates: db.getAllRecurringTemplates() });
  },

  setForCategory: (draft) => {
    const existing = get().templates.find((t) => t.categoryId === draft.categoryId);
    const template: RecurringTemplate = {
      ...draft,
      id: generateId(),
      // Carry the same-day dedup stamp forward — editing a template that already
      // fired today must not make it fire again on the next app open.
      lastFiredDate: existing?.lastFiredDate,
      active: true,
      createdAt: Date.now(),
    };

    // Write to SQLite first (offline-first)
    if (existing) db.deleteRecurringTemplate(existing.id);
    db.insertRecurringTemplate(template);

    set({
      templates: [...get().templates.filter((t) => t.categoryId !== draft.categoryId), template],
    });
  },

  removeForCategory: (categoryId) => {
    db.deleteRecurringTemplatesByCategory(categoryId);
    set({ templates: get().templates.filter((t) => t.categoryId !== categoryId) });
  },
}));
