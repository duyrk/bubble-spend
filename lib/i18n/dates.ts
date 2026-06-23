// Locale month/weekday names + small date helpers for the JS-only calendar.
// We avoid Intl/toLocaleDateString here because Hermes' Intl support is partial
// and unreliable across devices for formatted dates.

import type { Language } from './translations';

// Full month names (index 0 = January) — used in the calendar header.
export const MONTHS: Record<Language, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  vi: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
};

// Short month names — used in compact date pills.
export const MONTHS_SHORT: Record<Language, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  vi: ['Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6', 'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12'],
};

// Narrow weekday labels, Monday-first (matches the app's week period boundary).
export const WEEKDAYS_SHORT: Record<Language, string[]> = {
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  vi: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
};

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// "Jun 18" (en) / "18 Thg 6" (vi) — compact and locale-ordered.
export function formatShortDate(date: Date, language: Language): string {
  const day = date.getDate();
  const month = MONTHS_SHORT[language][date.getMonth()];
  return language === 'vi' ? `${day} ${month}` : `${month} ${day}`;
}

export function formatMonthYear(date: Date, language: Language): string {
  return `${MONTHS[language][date.getMonth()]} ${date.getFullYear()}`;
}
