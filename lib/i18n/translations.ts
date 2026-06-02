// Translation strings for all supported languages

export type Language = 'en' | 'vi';

export const LANGUAGES: { code: Language; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt' },
];

type Dict = {
  // Periods
  today: string;
  yesterday: string;
  thisWeek: string;
  thisMonth: string;

  // Home
  spent: string;
  tap: string;
  doneCheck: string;
  dragHint: string;

  // Numpad
  enterAmount: string;
  cancel: string;
  done: string;

  // History
  history: string;
  noTransactions: string;
  noTransactionsHint: string;

  // Categories defaults
  catFood: string;
  catTransport: string;
  catCoffee: string;
  catShopping: string;
  catBills: string;

  // Settings
  settings: string;
  appearance: string;
  theme: string;
  themeDark: string;
  themeLight: string;
  themeSystem: string;
  language: string;
  currency: string;
  notifications: string;
  dailyReminder: string;
  dailyReminderDesc: string;
  reminderTime: string;
  about: string;
  appVersion: string;
  general: string;

  // Empty state
  emptyHomeTitle: string;
  emptyHomeHint: string;

  // Add category
  addCategory: string;
};

const en: Dict = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  thisMonth: 'This month',

  spent: 'Spent',
  tap: 'tap',
  doneCheck: 'Done ✓',
  dragHint: 'Hold a bubble to move · Swipe to History',

  enterAmount: 'Enter amount',
  cancel: 'Cancel',
  done: 'Done',

  history: 'History',
  noTransactions: 'No transactions yet',
  noTransactionsHint: 'Tap a bubble on Home to record one',

  catFood: 'Food',
  catTransport: 'Transport',
  catCoffee: 'Coffee',
  catShopping: 'Shopping',
  catBills: 'Bills',

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

  emptyHomeTitle: 'Tap a bubble to log your first spend',
  emptyHomeHint: 'Hold to rearrange',

  addCategory: 'Add category',
};

const vi: Dict = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  thisWeek: 'Tuần này',
  thisMonth: 'Tháng này',

  spent: 'Chi tiêu',
  tap: 'tap',
  doneCheck: 'Xong ✓',
  dragHint: 'Giữ bubble để di chuyển · Vuốt sang Lịch sử',

  enterAmount: 'Nhập số tiền',
  cancel: 'Huỷ',
  done: 'Xong',

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
};

export const TRANSLATIONS: Record<Language, Dict> = { en, vi };
export type TranslationKey = keyof Dict;
