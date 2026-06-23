// i18n entry — exports translation dictionary and helpers

export { TRANSLATIONS, LANGUAGES } from './translations';
export type { Language, TranslationKey } from './translations';
export { getDefaultCategories, SUPPORTED_LOCALES } from './defaultCategories';
export type { LocaleCode } from './defaultCategories';
export {
  MONTHS,
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
  startOfDay,
  isSameDay,
  formatShortDate,
  formatMonthYear,
} from './dates';
