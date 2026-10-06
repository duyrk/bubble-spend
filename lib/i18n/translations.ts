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

  // Budgets & spending pace
  budget: 'Budget',
  logExpense: 'Log expense',
  setBudget: 'Set budget',
  rearrange: 'Rearrange',
  deleteCategoryAction: 'Delete category',
  monthlyBudget: 'Monthly budget',
  budgetSubtitle: 'Monthly spending cap for this bubble',
  removeBudget: 'Remove budget',
  projected: 'Projected',
  paceThisMonth: 'this month',
  paceOnTrack: 'on track',
  paceOver: 'over',

  // Recurring expense templates
  setRecurring: 'Set recurring',
  recurringTitle: 'Recurring expense',
  recurringSubtitle: 'Logs itself on a schedule',
  freqDaily: 'Daily',
  freqWeekly: 'Weekly',
  freqMonthly: 'Monthly',
  dayOfMonthLabel: 'Day of month',
  removeRecurring: 'Remove recurring',
  recurringExpenses: 'Recurring expenses',
  none: 'None',
  noRecurring: 'No recurring expenses yet',
  noRecurringHint: 'Hold a bubble and choose "Set recurring"',

  // Auto-capture (Android notification listener)
  autoCapture: 'Auto-capture',
  notificationAccess: 'Notification access',
  notificationAccessDesc: 'Read MoMo & ACB notifications to log spends',
  accessOn: 'On',
  accessOff: 'Off',
  capturedNotifications: 'Captured notifications',
  captureAllApps: 'Capture all apps (debug)',
  captureAllAppsDesc: 'Turn on briefly to discover app names & formats',
  noCaptures: 'Nothing captured yet',
  noCapturesHint: 'Make a MoMo or ACB payment, then come back',
  shareCaptures: 'Share',
  autoLogged: 'Auto-logged',
  uncategorized: 'uncategorized',
  uncategorizedTitle: 'Needs a bubble',
  uncategorizedHint: 'Tap a bubble — similar payments will go there automatically',
  notSpending: 'Not spending',
  myAccounts: 'My accounts',
  myAccountsDesc: 'Transfers to/from these are not spending',
  myAccountsHint: 'One per line: account number or holder name, e.g. VO KHANH DUY',
  captureStatusLogged: 'Logged',
  captureStatusPending: 'Waiting',
  captureStatusIgnored: 'Skipped',
  captureStatusUnparsed: 'Not a transaction',
  queuedCaptures: 'Queued',

  // Onboarding
  onboardingTitle: 'Welcome to Bubble Spend',
  onboardingSubtitle: 'A few gestures to get you going',
  onboardingTapTitle: 'Tap to log',
  onboardingTapDesc: 'Tap any bubble to record a spend on it.',
  onboardingHoldTitle: 'Hold for actions',
  onboardingHoldDesc: 'Press and hold a bubble for log, budget, rearrange, and delete.',
  onboardingDeleteTitle: 'Rearrange anytime',
  onboardingDeleteDesc: 'In that menu, tap Rearrange to drag bubbles around, then Done.',
  onboardingIncomeTitle: 'Log income',
  onboardingIncomeDesc: 'Tap "Earned" at the top to add money in.',
  onboardingCta: 'Got it',

  // Numpad — recent amounts
  recentAmounts: 'Recent',

  // Undo toast
  logged: 'Logged',
  undo: 'Undo',

  // Insights
  breakdownTitle: 'Where it went',

  // Data / backup
  data: 'Data',
  exportData: 'Export backup',
  exportDataDesc: 'Save all your data to a file',
  importData: 'Import backup',
  importDataDesc: 'Replace all data from a backup file',
  importConfirmTitle: 'Replace all data?',
  importConfirmBody:
    'This overwrites your current categories and transactions with the backup. This cannot be undone.',
  importSuccess: 'Data restored',
  autoBackup: 'Auto backup',
  autoBackupOff: 'Off',
  autoBackupDescOff: 'Save a backup every day to a folder you pick',
  autoBackupLast: 'Last backup',
  autoBackupFailedDesc: 'Backup failed — pick the folder again',
  autoBackupPickTitle: 'Pick a backup folder',
  autoBackupPickBody:
    'Choose or create a folder, e.g. Download/BubbleSpend. A backup is saved there every day (the last 14 are kept) and survives uninstalling the app.',
  autoBackupDone: 'Backup saved',
  backupNow: 'Back up now',
  changeFolder: 'Change folder',
  turnOff: 'Turn off',
  continueLabel: 'Continue',
  importError: 'Could not read that backup file',
  exportError: 'Could not export data',
  nothingToExport: 'No data to export yet',
  replace: 'Replace',
  ok: 'OK',

  // Transaction edit
  changeCategory: 'Change category',
  note: 'Note',
  addNote: 'Add note',
  notePlaceholder: 'Add a note…',
  save: 'Save',

  // Insight (year → month → week → day drill-down)
  'insight.title': 'Year overview',
  'insight.avgPerMonth': 'Avg / month',
  'insight.noData': 'No data yet',
  'insight.tapDetail': 'tap for detail',
  'insight.tapTransactions': 'tap for transactions',
  'insight.week': 'Week',
  'insight.byWeek': 'By week',
  'insight.byDay': '7 days',
  'insight.peakDay': 'Peak day',
  'insight.dailyAvg': 'Daily avg',
  'insight.spendingBreakdown': 'Spending breakdown',
  'insight.weeklySpend': 'Weekly spend',
  'insight.noTransactions': 'No transactions',
  'insight.transactions': 'Transactions',
  'insight.vsPrev': 'vs',
  'insight.trend': 'Spending trend',
  'insight.allCategories': 'All',
  'insight.habits': 'Spending habits',
  'insight.peakTime': 'Peak time',
  'insight.largest': 'Biggest expense',
  timeMorning: 'Morning',
  timeAfternoon: 'Afternoon',
  timeEvening: 'Evening',
  timeNight: 'Night',
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

  budget: 'Ngân sách',
  logExpense: 'Ghi chi tiêu',
  setBudget: 'Đặt ngân sách',
  rearrange: 'Sắp xếp lại',
  deleteCategoryAction: 'Xoá danh mục',
  monthlyBudget: 'Ngân sách hàng tháng',
  budgetSubtitle: 'Hạn mức chi tiêu hàng tháng cho bubble này',
  removeBudget: 'Xoá ngân sách',
  projected: 'Dự kiến',
  paceThisMonth: 'tháng này',
  paceOnTrack: 'đúng tiến độ',
  paceOver: 'vượt',

  setRecurring: 'Đặt định kỳ',
  recurringTitle: 'Chi tiêu định kỳ',
  recurringSubtitle: 'Tự động ghi theo lịch',
  freqDaily: 'Hằng ngày',
  freqWeekly: 'Hằng tuần',
  freqMonthly: 'Hằng tháng',
  dayOfMonthLabel: 'Ngày trong tháng',
  removeRecurring: 'Xoá định kỳ',
  recurringExpenses: 'Chi tiêu định kỳ',
  none: 'Không có',
  noRecurring: 'Chưa có chi tiêu định kỳ nào',
  noRecurringHint: 'Giữ một bubble rồi chọn "Đặt định kỳ"',

  // Auto-capture (Android notification listener)
  autoCapture: 'Tự động ghi chi tiêu',
  notificationAccess: 'Quyền đọc thông báo',
  notificationAccessDesc: 'Đọc thông báo MoMo & ACB để ghi chi tiêu',
  accessOn: 'Bật',
  accessOff: 'Tắt',
  capturedNotifications: 'Thông báo đã bắt',
  captureAllApps: 'Bắt mọi ứng dụng (debug)',
  captureAllAppsDesc: 'Chỉ bật tạm để tìm tên gói và định dạng',
  noCaptures: 'Chưa bắt được thông báo nào',
  noCapturesHint: 'Thử thanh toán qua MoMo hoặc ACB rồi quay lại',
  shareCaptures: 'Chia sẻ',
  autoLogged: 'Đã tự ghi',
  uncategorized: 'chưa phân loại',
  uncategorizedTitle: 'Chọn bubble',
  uncategorizedHint: 'Chạm một bubble — lần sau khoản tương tự sẽ tự vào đó',
  notSpending: 'Không phải chi tiêu',
  myAccounts: 'Tài khoản của tôi',
  myAccountsDesc: 'Chuyển qua lại các tài khoản này không tính là chi tiêu',
  myAccountsHint: 'Mỗi dòng một số tài khoản hoặc tên chủ TK, ví dụ VO KHANH DUY',
  captureStatusLogged: 'Đã ghi',
  captureStatusPending: 'Chờ phân loại',
  captureStatusIgnored: 'Bỏ qua',
  captureStatusUnparsed: 'Không phải giao dịch',
  queuedCaptures: 'Đang chờ xử lý',

  onboardingTitle: 'Chào mừng đến Bubble Spend',
  onboardingSubtitle: 'Vài thao tác để bắt đầu',
  onboardingTapTitle: 'Chạm để ghi',
  onboardingTapDesc: 'Chạm vào một bubble để ghi một khoản chi.',
  onboardingHoldTitle: 'Giữ để mở menu',
  onboardingHoldDesc: 'Nhấn giữ một bubble để ghi, đặt ngân sách, sắp xếp và xoá.',
  onboardingDeleteTitle: 'Sắp xếp bất cứ lúc nào',
  onboardingDeleteDesc: 'Trong menu, chạm Sắp xếp lại để kéo bubble, rồi chạm Xong.',
  onboardingIncomeTitle: 'Ghi thu nhập',
  onboardingIncomeDesc: 'Chạm "Thu nhập" ở trên cùng để thêm tiền vào.',
  onboardingCta: 'Đã hiểu',

  recentAmounts: 'Gần đây',

  logged: 'Đã ghi',
  undo: 'Hoàn tác',

  breakdownTitle: 'Tiền đi đâu',

  data: 'Dữ liệu',
  exportData: 'Xuất bản sao lưu',
  exportDataDesc: 'Lưu toàn bộ dữ liệu ra một tệp',
  importData: 'Nhập bản sao lưu',
  importDataDesc: 'Thay thế toàn bộ dữ liệu từ tệp sao lưu',
  importConfirmTitle: 'Thay thế toàn bộ dữ liệu?',
  importConfirmBody:
    'Thao tác này sẽ ghi đè danh mục và giao dịch hiện tại bằng dữ liệu sao lưu. Không thể hoàn tác.',
  importSuccess: 'Đã khôi phục dữ liệu',
  autoBackup: 'Sao lưu tự động',
  autoBackupOff: 'Tắt',
  autoBackupDescOff: 'Mỗi ngày lưu một bản sao lưu vào thư mục bạn chọn',
  autoBackupLast: 'Lần cuối',
  autoBackupFailedDesc: 'Sao lưu lỗi — hãy chọn lại thư mục',
  autoBackupPickTitle: 'Chọn thư mục sao lưu',
  autoBackupPickBody:
    'Chọn hoặc tạo một thư mục, ví dụ Download/BubbleSpend. Mỗi ngày app lưu một bản vào đó (giữ 14 bản gần nhất), vẫn còn kể cả khi gỡ app.',
  autoBackupDone: 'Đã sao lưu',
  backupNow: 'Sao lưu ngay',
  changeFolder: 'Đổi thư mục',
  turnOff: 'Tắt',
  continueLabel: 'Tiếp tục',
  importError: 'Không thể đọc tệp sao lưu này',
  exportError: 'Không thể xuất dữ liệu',
  nothingToExport: 'Chưa có dữ liệu để xuất',
  replace: 'Thay thế',
  ok: 'OK',

  changeCategory: 'Đổi danh mục',
  note: 'Ghi chú',
  addNote: 'Thêm ghi chú',
  notePlaceholder: 'Thêm ghi chú…',
  save: 'Lưu',

  'insight.title': 'Tổng quan năm',
  'insight.avgPerMonth': 'TB / tháng',
  'insight.noData': 'Chưa có dữ liệu',
  'insight.tapDetail': 'tap để xem chi tiết',
  'insight.tapTransactions': 'tap để xem giao dịch',
  'insight.week': 'Tuần',
  'insight.byWeek': 'Theo tuần',
  'insight.byDay': '7 ngày',
  'insight.peakDay': 'Ngày cao nhất',
  'insight.dailyAvg': 'TB / ngày',
  'insight.spendingBreakdown': 'Phân bổ chi tiêu',
  'insight.weeklySpend': 'Chi tiêu theo tuần',
  'insight.noTransactions': 'Không có giao dịch',
  'insight.transactions': 'Giao dịch',
  'insight.vsPrev': 'so với',
  'insight.trend': 'Xu hướng chi tiêu',
  'insight.allCategories': 'Tất cả',
  'insight.habits': 'Thói quen chi tiêu',
  'insight.peakTime': 'Giờ cao điểm',
  'insight.largest': 'Khoản chi lớn nhất',
  timeMorning: 'Sáng',
  timeAfternoon: 'Chiều',
  timeEvening: 'Tối',
  timeNight: 'Đêm',
};

export const TRANSLATIONS: Record<Language, Record<TranslationKey, string>> = { en, vi };
