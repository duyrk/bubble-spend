# Bubble Spend

Expense tracking app with bubble UI. Each spending category = a bubble. Size reflects spending. Inspired by PS Vita launcher.

Full PRD and architecture: @docs/PRD.md

---

## Stack

- **Framework:** React Native + Expo SDK 54, Expo Router 6, TypeScript
- **Animation:** Reanimated 4.1 + react-native-worklets 0.5 — all animations on UI thread
- **Gestures:** Gesture Handler 2.28
- **State:** Zustand 5
- **Local DB:** expo-sqlite 16 (offline-first, sync queue pattern)
- **Settings persistence:** AsyncStorage via Zustand `persist` middleware
- **Sensors:** expo-sensors 15 (Gyroscope for parallax)
- **Notifications:** expo-notifications 0.32
- **Locale:** expo-localization 17
- **Backend:** Golang (separate repo) — Gin, sqlc + pgx, PostgreSQL — not yet integrated

> TanStack Query and Axios are NOT installed or used. Remove them from any future scaffolding.

---

## Project Structure

```
app/
  _layout.tsx             Root layout — DB init, notification handler, theme
  (tabs)/
    _layout.tsx           Tab navigator (Home, History, Settings) + FloatingTabBar
    index.tsx             Home screen entry
    history.tsx           History screen entry
    settings.tsx          Settings screen entry

components/
  ui/
    FloatingTabBar.tsx    Floating pill tab bar — hides when numpad modal is open
    GlassSurface.tsx      Shared frosted-glass surface primitive (expo-blur)

features/
  bubble/
    BubbleField.tsx       Positions all bubbles + gyro tilt wrapper
    BubbleItem.tsx        Single bubble — gestures, float/wobble animations
    AddCategorySheet.tsx  FAB "+" button + preset picker bottom sheet
    FolderBubble.tsx      (scaffolded, not wired)
    useBubblePhysics.ts   Spring animation for bubble size changes
    useDragGesture.ts     Drag gesture helpers
  home/
    HomeScreen.tsx        Home screen — period bar, total, bubble field, numpad, fireworks
    PeriodBar.tsx         Period selector tabs (Today/Yesterday/Week/Month)
    TotalDisplay.tsx      Aggregated spend display
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
  currency.ts             CurrencyMeta + formatCurrency / formatCompact
  notifications.ts        Schedule/cancel daily reminder
  i18n/
    translations.ts       English + Vietnamese string dictionaries
    index.ts              Re-exports

constants/
  theme.ts                DARK_COLORS, LIGHT_COLORS, BUBBLE_COLORS_DARK/LIGHT, SIZES, SPRING, BLUR, RADII, TIMING
  config.ts               GYROSCOPE, GESTURE, DB_NAME

types/index.ts            Category, CategoryWithSize, Transaction, SyncQueueItem, Period, BubbleColorKey

docs/                     Reference docs — load with @docs/filename.md when needed
```

---

## Critical Rules

### Animations — Reanimated 4 only, never React Native's Animated API

```typescript
// ✅
const scale = useSharedValue(1);
const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

// ❌ never use this
const scale = new Animated.Value(1);
```

### Gesture callbacks — always wrap non-worklet calls with runOnJS

Reanimated 4 + Gesture Handler 2 compile all gesture callbacks as UI-thread worklets. Calling regular JS (Zustand actions, Haptics, navigation) directly from a gesture callback crashes with SIGABRT.

```typescript
// ✅
.onEnd(() => {
  runOnJS(openModal)(category.id);
  runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
})

// ❌ crashes at runtime — no runOnJS
.onEnd(() => {
  openModal(category.id);
})
```

### Zustand selectors — never compute derived values inside selectors

Calling a function that returns a new array/object inside a Zustand selector creates a new reference on every evaluation → infinite render loop.

```typescript
// ✅ select raw state, compute in useMemo
const categories = useCategoryStore((state) => state.categories);
const sizes = useCategoryStore((state) => state.sizes);
const categoriesWithSize = useMemo(
  () => getCategoriesWithSize(categories, sizes),
  [categories, sizes],
);

// ❌ infinite re-render loop
const categoriesWithSize = useCategoryStore((state) =>
  state.getCategoriesWithSize(),
);
```

### Colors — always from theme constants, never hardcoded

```typescript
// ✅
import { COLORS } from '@/constants/theme';

// ❌
style={{ backgroundColor: '#7c6af7' }}
```

### Writes — SQLite first, never block UI on network

Every transaction write: SQLite → sync_queue → update in-memory state. No network calls in the write path.

### Types — `type` for data objects, `interface` for component props

---

## Key Design Decisions (non-negotiable)

- **Max 8 bubbles** — hard limit enforced in `useCategoryStore.addCategory()`. `AddCategorySheet` hides at limit.
- **Bubble size:** `BASE = 76px`, `MAX = 118px`, linear scale: `76 + (amt/maxAmt) × 42`. Zero spend = base size always.
- **Gesture threshold:** tap < 500ms → open numpad | long press ≥ 500ms → enter drag mode
- **Drag mode:** pan gesture enabled, tap/longPress disabled, tab swipe disabled
- **Tab bar hides when numpad is open** — `FloatingTabBar` returns `null` when `activeModal !== null`
- **Timestamps:** always `Date.now()` at confirm — never ask user for date/time
- **Position stored as percentage (0–100)** — not absolute px, survives device/rotation changes
- **History screen reads SQLite directly** — does not use `useTransactionStore`
- **Float animation seeded from position** — `floatDuration = 2800 + (positionX * 30) % 800`, `floatAmplitude = 4 + (positionY * 0.03) % 3`
- **Gyroscope:** low-pass filter α = 0.1, then `withSpring` to `BubbleField` translateX/Y
- **Theme default:** Dark — frosted-glass aesthetic reads best on dark backgrounds
- **Accent color:** `#7c6af7` — confirm button, active tab indicator, notification toggle

---

## Bubble color keys

8 named keys stored on `Category` — never raw hex in DB:
`frost` `mist` `dusk` `slate` `ash` `haze` `veil` `smoke`

Actual rgba values (with `glassFill`, `tintColor`, `glow`, `rimLight`) live in `constants/theme.ts`.

---

## Run & Verify

```bash
npx expo start           # dev server
npx expo start --ios     # iOS simulator
npx expo run:android     # Android (native build)
npx tsc --noEmit         # typecheck
npx eslint .             # lint
eas build --platform android --profile preview   # APK build
```

---

## SQLite Schema

```sql
categories  (id, name, emoji, color_key, position_x, position_y, created_at)
transactions (id, category_id, amount, transacted_at, note, synced)
sync_queue  (id, operation, entity, payload, created_at)
```

All SQLite via `expo-sqlite` synchronous API: `execSync`, `runSync`, `getAllSync`.

---

## Reference Docs (load on demand)

- `@docs/PRD.md` — full product requirements, feature list, priorities
- `@docs/architecture.md` — data flow, store design, animation/gesture architecture
- `@docs/decisions.md` — locked design decisions with rationale
