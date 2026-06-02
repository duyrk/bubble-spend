# Bubble Spend — Architecture

## Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | React Native + Expo SDK | 54.0 |
| Navigation | Expo Router | 6.0 |
| Animation | Reanimated | 4.1 |
| Worklets | react-native-worklets | 0.5 |
| Gestures | Gesture Handler | 2.28 |
| State | Zustand | 5.0 |
| Local DB | expo-sqlite | 16.0 |
| Settings persistence | AsyncStorage (via Zustand persist) | 2.2 |
| Sensors | expo-sensors (Gyroscope) | 15.0 |
| Notifications | expo-notifications | 0.32 |
| Locale detection | expo-localization | 17.0 |
| Language / Region | Runtime detection (no backend) | — |

TanStack Query and Axios are listed as intended in CLAUDE.md but are **not installed or used** in the current build.

---

## App Structure

```
app/
  _layout.tsx             Root layout — DB init, notification handler, theme
  (tabs)/
    _layout.tsx           Tab navigator (Home, History, Settings) + FloatingTabBar
    index.tsx             Home screen entry (re-exports HomeScreen)
    history.tsx           History screen entry
    settings.tsx          Settings screen entry

components/
  ui/
    FloatingTabBar.tsx    Floating pill tab bar — hides when numpad modal is open
    GlassSurface.tsx      Shared Liquid Glass surface primitive

features/
  bubble/
    BubbleField.tsx       Positions all bubbles + gyro tilt wrapper
    BubbleItem.tsx        Single bubble — gestures, float/wobble animations
    AddCategorySheet.tsx  FAB "+" button + preset picker bottom sheet
    FolderBubble.tsx      (scaffolded, not wired)
    useBubblePhysics.ts   Spring animation for bubble size changes
    useDragGesture.ts     Drag gesture helpers (used internally)
  home/
    HomeScreen.tsx        Home screen — period bar, total, bubble field, numpad, fireworks
    PeriodBar.tsx         Period selector tabs (Today/Yesterday/Week/Month)
    TotalDisplay.tsx      Aggregated spend display for active period
  numpad/
    NumpadModal.tsx       Bottom-sheet numpad for entering amounts
    AmountDisplay.tsx     Amount display sub-component
  effects/
    Fireworks.tsx         Particle burst overlay
    useFireworks.ts       Fireworks particle state controller
  timeline/
    HistoryScreen.tsx     History screen
    TransactionList.tsx   Scrollable list with date grouping
    TransactionItem.tsx   Single row — emoji, name, amount, time
  settings/
    SettingsScreen.tsx    Settings screen
    SettingsGroup.tsx     Grouped section container
    SettingsRow.tsx       Label + value row with optional right element
    OptionPickerModal.tsx Full-screen picker for single-select options

stores/
  useCategoryStore.ts
  useTransactionStore.ts
  useUIStore.ts
  useSettingsStore.ts

hooks/
  useGyroscopeTilt.ts     Low-pass filtered gyro → shared values
  useCategoriesWithSize.ts Selector: categories + computed sizes
  useFormatCurrency.ts    format() and compact() per settings currency
  useTheme.ts             useColors(), useBubbleColors(), useResolvedTheme()
  useTranslation.ts       t() keyed on settings language

lib/
  db.ts                   SQLite open/init + all query helpers
  currency.ts             CurrencyMeta definitions + formatCurrency / formatCompact
  notifications.ts        Schedule/cancel daily reminder
  i18n/
    translations.ts       English + Vietnamese string dictionaries
    index.ts              Re-exports

constants/
  theme.ts                DARK_COLORS, LIGHT_COLORS, BUBBLE_COLORS_DARK/LIGHT, SIZES, SPRING, BLUR, RADII, TIMING
  config.ts               GYROSCOPE, GESTURE, DB_NAME

types/index.ts            Category, CategoryWithSize, Transaction, SyncQueueItem, Period, BubbleColorKey
```

---

## State Stores

### `useCategoryStore`

Owns category data and the computed size map. Initialised at root layout mount.

```
State:  categories[], sizes{id → {size, total}}, loaded
Load:   initDb() → getAllCategories() → seed defaults if empty
Write:  insertCategory / updateCategoryPosition / deleteCategory (SQLite + memory)
Derive: recalcSizes(transactions) — recomputes sizes map from transaction totals
        getCategoriesWithSize() — merges categories + sizes → CategoryWithSize[]
Limit:  8 categories max (SIZES.BUBBLES_LIMIT), enforced in addCategory()
```

Default categories seeded on first launch: Food, Transport, Coffee, Shopping, Bills.

### `useTransactionStore`

Owns the in-memory transaction slice for the active period on Home.

```
State:  transactions[], period
Load:   loadByPeriod(period) → getTransactionsByPeriod(start, end) from SQLite
Write:  add(categoryId, amount, note?) → insertTransaction() + insertSyncItem() → update memory
Derive: getTotal() → sum of transactions[].amount
```

History screen **does not use this store** — it queries SQLite directly via `db.getTransactionsByPeriod` on focus/period change to avoid cross-screen state coupling.

### `useUIStore`

Ephemeral UI state only. Not persisted.

```
activeModal: string | null   — categoryId of open numpad, null when closed
dragMode: boolean            — bubble drag mode active
activePeriod: Period         — selected period on Home screen
```

### `useSettingsStore`

Persisted via Zustand `persist` middleware → AsyncStorage key `bubble-spend-settings`.

```
theme: ThemeMode ('dark' | 'light' | 'system')   default: 'dark'
language: Language ('en' | 'vi')                   default: device locale
currency: CurrencyCode                              default: device region
notificationsEnabled: boolean                       default: false
reminderHour: number (0–23)                         default: 21
reminderMinute: number (0–59)                       default: 0
hasCompletedOnboarding: boolean                     default: false
```

---

## SQLite Schema (`bubble-spend.db`)

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  color_key TEXT NOT NULL,
  position_x REAL DEFAULT 50,
  position_y REAL DEFAULT 50,
  created_at INTEGER NOT NULL
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  amount REAL NOT NULL,
  transacted_at INTEGER NOT NULL,  -- unix ms, set at confirm
  note TEXT,
  synced INTEGER DEFAULT 0         -- 0 = pending, 1 = synced
);

CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,         -- 'CREATE' | 'UPDATE' | 'DELETE'
  entity TEXT NOT NULL,            -- 'transaction' | 'category'
  payload TEXT NOT NULL,           -- JSON stringified entity
  created_at INTEGER NOT NULL
);
```

All SQLite operations use `expo-sqlite` synchronous API (`execSync`, `runSync`, `getAllSync`).

---

## Offline-First Write Path

```
User confirms amount in NumpadModal
  → useTransactionStore.add(categoryId, amount)
    → db.insertTransaction(tx)           // write to SQLite immediately
    → db.insertSyncItem(syncItem)        // enqueue for future backend sync
    → set({ transactions: [tx, ...] })   // update in-memory state
  → onTransactionConfirmed callback
    → loadByPeriod(activePeriod)         // reload from SQLite (source of truth)
    → triggerFireworks(x, y)            // visual feedback
```

Sync flush is **not yet implemented** — `getPendingSyncItems()` and `deleteSyncItem()` exist in `lib/db.ts` but nothing calls them.

---

## Animation Architecture

All animations run on the UI thread via Reanimated shared values. No JS-thread `Animated.Value` is used anywhere.

| Animation | Mechanism |
|---|---|
| Bubble size change | `withSpring` via `useBubblePhysics` |
| Bubble float (bob) | `withRepeat(withSequence(withTiming, withTiming))` per bubble, unique duration/amplitude seeded from position |
| Drag mode wobble | `withRepeat(withSequence(withTiming(-4°), withTiming(4°)))` |
| Gyroscope parallax | `withSpring` from filtered gyro readings → `translateX/Y` on the entire `BubbleField` |
| Numpad slide-up | `withSpring` on `translateY` |
| Numpad backdrop | `withTiming` on `opacity` |

---

## Gesture Architecture

```
BubbleItem gesture = Race(pan, Exclusive(longPress, tap))

tap (< 500 ms, disabled in dragMode)       → runOnJS(openModal)(categoryId)
longPress (≥ 500 ms, disabled in dragMode) → runOnJS(Haptics.impactAsync)() + runOnJS(enterDragMode)()
pan (enabled only in dragMode)             → translate bubble → on end: runOnJS(updatePosition)(id, x, y)
```

**Important:** Reanimated 4 + Gesture Handler 2 compile all gesture callbacks as UI-thread worklets. Any call to a non-worklet function (Zustand actions, Haptics, etc.) **must** be wrapped with `runOnJS`. Calling them bare causes a Hermes C++ exception → `SIGABRT`. See `decisions.md` for rationale.

Drag mode disables `tap` and `longPress` gestures. The `FloatingTabBar` hides entirely when `activeModal !== null` (numpad open), which also prevents tab-switch conflicts during amount entry.

---

## Tab Bar Behaviour

`FloatingTabBar` subscribes to `useUIStore.activeModal`. When a numpad modal is open it returns `null`, fully removing the tab bar from the render tree. This prevents:
- The tab bar pill from visually overlapping the numpad sheet (z-index conflict)
- Accidental tab switches while entering an amount

---

## Layout & Safe Area

`FloatingTabBar` is positioned at `bottom: insets.bottom + 16` using `useSafeAreaInsets`.

`AddCategorySheet` FAB is positioned at `bottom: insets.bottom + 84` — above the tab bar pill (pill bottom ~`insets.bottom + 16`, pill height ~56 px, 12 px gap = 84).

`HomeScreen` empty-state hint is at `bottom: insets.bottom + 112` so it always clears the tab bar.

---

## Currency & i18n

**Currency** — defined in `lib/currency.ts`. 8 supported codes: VND, USD, EUR, GBP, JPY, KRW, SGD, THB. Each has a `CurrencyMeta` with symbol, decimal places, and symbol position. Two formatters:
- `formatCurrency(amount, code)` — full form, e.g. `$1,234.56`
- `formatCompact(amount, code)` — compact for bubble labels: `$1.2k`, `380`, returns `null` if zero

**i18n** — `lib/i18n/translations.ts` holds `en` and `vi` dictionaries typed by `TranslationKey`. `useTranslation()` reads `language` from `useSettingsStore` and returns `t(key)`.

Language and currency default to device locale/region via `expo-localization` in `useSettingsStore` initialiser. Both can be overridden in Settings.

---

## Theme

`constants/theme.ts` exports:
- `DARK_COLORS` / `LIGHT_COLORS` — `ColorPalette` objects
- `BUBBLE_COLORS_DARK` / `BUBBLE_COLORS_LIGHT` — per `BubbleColorKey` (`{bg, glow, border}`)
- `SPRING`, `BLUR`, `RADII`, `TIMING`, `SIZES` — shared animation/layout constants

`hooks/useTheme.ts`:
- `useResolvedTheme()` — resolves `'system'` using `useColorScheme()`
- `useColors()` — returns the correct `ColorPalette` for resolved theme
- `useBubbleColors()` — returns the correct bubble color map

---

## Notification System

`lib/notifications.ts`:
- `configureNotificationHandler()` — called once at app start (module level in `_layout.tsx`), sets foreground banner/sound behaviour
- `ensureNotificationPermission()` — requests permission if not already granted
- `scheduleDailyReminder(hour, minute, language)` — cancels existing, schedules daily trigger
- `cancelDailyReminder()` — cancels by fixed identifier `bubble-spend-daily-reminder`

Notification content is localised (EN/VI) in `REMINDER_BODY`. The Settings screen re-schedules automatically when language or reminder time changes while notifications are enabled.

---

## Backend (not yet integrated)

The intended backend is a Golang service (separate repo) using Gin, sqlc + pgx, and PostgreSQL. The frontend sync queue is designed for this but no HTTP calls exist yet. When implemented, a flush worker will drain `sync_queue` rows via the backend API and mark transactions as `synced = 1`.
