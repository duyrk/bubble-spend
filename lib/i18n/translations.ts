// Translation strings for all supported languages.
// `TranslationKey` is derived from the `en` dictionary, and `vi` is typed as
// the same shape — TypeScript surfaces missing keys at compile time.

import type { LocaleCode } from './defaultCategories';

export type Language = LocaleCode;

// LANGUAGE_META is keyed by LocaleCode — TS errors if a supported locale lacks
// a label entry, so settings UI can iterate over Object.keys safely.
const LANGUAGE_META: Record<LocaleCode, { label: string; nativeLabel: string }> = {
  en: { label: 'English', nativeLabel: 'English' },
  vi: { label: 'Vietnamese', nativeLabel: 'Tiếng Việt' },
};

export const LANGUAGES: { code: Language; label: string; nativeLabel: string }[] = (
  Object.keys(LANGUAGE_META) as LocaleCode[]
).map((code) => ({ code, ...LANGUAGE_META[code] }));

const en = {
  // Periods
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  thisMonth: 'This month',

  // Home
  spent: 'Spent',
  earned: 'Earned',
  net: 'Net',
  tap: 'tap',
  doneCheck: 'Done ✓',
  dragHint: 'Hold a bubble to move · Swipe to History',
  logIncome: '+ Income',

  // Numpad
  enterAmount: 'Enter amount',
  cancel: 'Cancel',
  done: 'Done',
  expense: '− Expense',
  income: '+ Income',
  incomeLabel: 'Income',

  // History
  history: 'History',
  noTransactions: 'No transactions yet',
  noTransactionsHint: 'Tap a bubble on Home to record one',

  // Categories defaults
  catFood: 'Food',
  catTransport: 'Transport',
  catCoffee: 'Coffee',
  catShopping: 'Shopping',
  catBills: 'Bills',

  // Settings
  settings: 'Settings',
  appearance: 'Appearance',
  theme: 'Theme',
  themeDark: 'Dark',
  themeLight: 'Light',
  themeSystem: 'System',
  language: 'Language',
  currency: 'Currency',
  notifications: 'Notifications',
  dailyReminder: 'Daily reminder',
  dailyReminderDesc: 'Remind me to record my spending',
  reminderTime: 'Reminder time',
  about: 'About',
  appVersion: 'Version',
  general: 'General',

  // Empty state
  emptyHomeTitle: 'Tap a bubble to log your first spend',
  emptyHomeHint: 'Hold to rearrange',

  // Add category
  addCategory: 'Add category',
  custom: 'Custom',
  chooseIcon: 'Choose an icon',
  categoryName: 'Category name',
  add: 'Add',
  back: 'Back',

  // Edit / delete
  delete: 'Delete',
  deleteCategoryTitle: 'Delete this category?',
  deleteCategoryBody: 'All of its transactions will be permanently deleted too.',
} as const;

export type TranslationKey = keyof typeof en;

const vi: Record<TranslationKey, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  thisWeek: 'Tuần này',
  thisMonth: 'Tháng này',

  spent: 'Chi tiêu',
  earned: 'Thu nhập',
  net: 'Còn lại',
  tap: 'tap',
  doneCheck: 'Xong ✓',
  dragHint: 'Giữ bubble để di chuyển · Vuốt sang Lịch sử',
  logIncome: '+ Thu nhập',

  enterAmount: 'Nhập số tiền',
  cancel: 'Huỷ',
  done: 'Xong',
  expense: '− Chi tiêu',
  income: '+ Thu nhập',
  incomeLabel: 'Thu nhập',

  history: 'Lịch sử',
  noTransactions: 'Chưa có giao dịch nào',
  noTransactionsHint: 'Tap vào một bubble ở Home để ghi nhận',

  catFood: 'Ăn uống',
  catTransport: 'Đi lại',
  catCoffee: 'Cà phê',
  catShopping: 'Mua sắm',
  catBills: 'Hóa đơn',

  settings: 'Cài đặt',
  appearance: 'Giao diện',
  theme: 'Chế độ',
  themeDark: 'Tối',
  themeLight: 'Sáng',
  themeSystem: 'Theo hệ thống',
  language: 'Ngôn ngữ',
  currency: 'Tiền tệ',
  notifications: 'Thông báo',
  dailyReminder: 'Nhắc nhở hàng ngày',
  dailyReminderDesc: 'Nhắc tôi ghi lại chi tiêu',
  reminderTime: 'Thời gian nhắc',
  about: 'Về ứng dụng',
  appVersion: 'Phiên bản',
  general: 'Chung',

  emptyHomeTitle: 'Tap vào bubble để ghi giao dịch đầu tiên',
  emptyHomeHint: 'Giữ để sắp xếp lại',

  addCategory: 'Thêm danh mục',
  custom: 'Tuỳ chỉnh',
  chooseIcon: 'Chọn biểu tượng',
  categoryName: 'Tên danh mục',
  add: 'Thêm',
  back: 'Quay lại',

  delete: 'Xoá',
  deleteCategoryTitle: 'Xoá danh mục này?',
  deleteCategoryBody: 'Tất cả giao dịch của danh mục cũng sẽ bị xoá vĩnh viễn.',
};

export const TRANSLATIONS: Record<Language, Record<TranslationKey, string>> = { en, vi };
