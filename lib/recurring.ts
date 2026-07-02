// Pure recurring-template due-check — decides which templates should auto-log
// today. No RN/expo imports so Jest runs it without native shims. The firing
// side effects (SQLite insert + sync queue) live in lib/recurringIO.ts.

import type { RecurringTemplate } from '@/types';

// Local-time 'YYYY-MM-DD'. Built by hand rather than toLocaleDateString/Intl —
// Hermes' Intl support is partial and unreliable across devices (see i18n/dates).
export function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return localDateISO(new Date());
}

// A template is due when it's active, hasn't already fired today (lastFiredDate
// is a same-day dedup — firing is at-most-once per day), and today matches its
// schedule. There is no catch-up: a monthly template whose day passed while the
// app stayed closed waits for the next cycle.
export function shouldFireToday(
  template: RecurringTemplate,
  todayISODate: string,
  dayOfWeek: number,
  dayOfMonth: number,
): boolean {
  if (!template.active) return false;
  if (template.lastFiredDate === todayISODate) return false;

  switch (template.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return template.dayOfWeek === dayOfWeek;
    case 'monthly':
      return template.dayOfMonth === dayOfMonth;
  }
}

export function getDueTemplates(
  templates: RecurringTemplate[],
  todayISODate: string,
  dayOfWeek: number,
  dayOfMonth: number,
): RecurringTemplate[] {
  return templates.filter((t) => shouldFireToday(t, todayISODate, dayOfWeek, dayOfMonth));
}
