# Bubble Spend — Design Decisions

Locked decisions with rationale. Change these only with a deliberate choice, not by accident.

---

## UI / UX

### Bubble limit: 8 max

Hard-capped at 8 categories. Enforced in `useCategoryStore.addCategory()` — throws if exceeded. `AddCategorySheet` hides itself when at the limit.

**Why:** More than 8 bubbles on a phone screen creates overlap and makes tap targets unreliable. The PS Vita inspiration also used a constrained launcher grid.

---

### Bubble size formula

```
ratio = categoryTotal / maxCategoryTotal
size  = BUBBLE_BASE + ratio × (BUBBLE_MAX − BUBBLE_BASE)
     = 76 + ratio × 42   (px)
```

Base: 76 px. Max: 118 px. A category with zero spend is always at base size.

**Why:** Linear scaling from min to max ensures all bubbles remain tappable regardless of spending distribution. Logarithmic or area-based scaling causes the smallest bubbles to shrink below tap-target thresholds.

---

### Gesture threshold: tap < 500 ms, long press ≥ 500 ms

Single threshold that gates both interactions. Tap opens numpad; long press enters drag mode.

**Why:** Tap and drag mode must never fire simultaneously. A shared 500 ms boundary, enforced by `Gesture.Exclusive(longPress, tap)`, eliminates ambiguity. Haptic feedback on long-press gives clear confirmation.

---

### Drag mode disables tab-bar swipe

While `dragMode === true`, the horizontal pan gesture is owned by bubbles, not the navigator.

**Why:** A swipe that starts on a bubble would conflict with navigator swipe-back. Disabling tab navigation during drag mode eliminates the conflict entirely rather than trying to tune priorities.

---

### Tab bar hides when numpad is open

`FloatingTabBar` subscribes to `useUIStore.activeModal` and returns `null` whenever it is non-null.

**Why:** The tab bar is positioned absolutely in the navigator layer with `zIndex: 50`. The numpad sheet renders inside the screen content with `zIndex: 11`. Because the navigator renders the tab bar *after* the screen content, React Native stacks it on top regardless of z-index values — the only reliable fix is to remove it from the tree. As a bonus this also prevents accidental tab switches during amount entry.

---

### Timestamps default to `Date.now()`; backdating is opt-in

Transaction `transactedAt` defaults to the moment the user presses confirm. The create numpad also has a date pill (📅 Today) that opens a calendar for picking any past day — the pill always resets to **Today** when the sheet opens, so the fast path is unchanged. A backdated entry is stamped at the chosen day + the current wall-clock time (so it sorts naturally within that day); picking today yields exactly `Date.now()`.

**Why:** Logging as-you-spend stays a zero-friction default, but "I forgot to log yesterday" was the most common real gap. The picker is JS-only (`components/ui/Calendar.tsx`, names from `lib/i18n/dates.ts`) to avoid a native date-picker dependency and Hermes `Intl` flakiness. The History **edit** flow remains amount-only for now — changing an existing transaction's date is not yet supported.

---

### Home summary totals are derived with `useMemo`, not store getters

`HomeScreen` computes Spent/Earned/Net with a `useMemo` over the subscribed `transactions` array — it does **not** call `useTransactionStore`'s `getExpenseTotal()/getIncomeTotal()/getNetBalance()` during render.

**Why:** Those getters read `get().transactions` live at call time. On a cold start the first data load (the async `loadByPeriod` effect) updates the store, but a getter invoked during render can read a snapshot inconsistent with the subscribed selector — so the summary rendered `0` on launch until some later re-render. Verified on-device: `transactions.length === 2` while `getExpenseTotal()` returned `0`, even though `recalcSizes` over the same data sized the bubble to 75k. Deriving the totals from the subscribed `transactions` value (the same source the bubbles use) keeps the summary and bubbles consistent on first paint. `HistoryScreen` already follows this pattern.

---

### FAB and empty-hint use safe area insets for bottom offset

`AddCategorySheet` FAB: `bottom: insets.bottom + 84` (clears tab bar pill + gap).
`HomeScreen` empty-hint: `bottom: insets.bottom + 112`.

**Why:** Hardcoded pixel values broke on devices with a home indicator (`insets.bottom ≈ 34 px`). Using `useSafeAreaInsets` makes both elements device-independent and always above the floating tab bar.

---

### Onboarding shown once, gated on storage hydration

The first-launch coach overlay (`OnboardingOverlay`) renders only when `_hasHydrated && !hasCompletedOnboarding`. `_hasHydrated` is a transient settings flag flipped in the persist `onRehydrateStorage` callback; `hasCompletedOnboarding` is persisted and set on dismiss.

**Why:** `hasCompletedOnboarding` defaults to `false` and AsyncStorage rehydrates asynchronously, so a returning user's first frame would briefly read `false` and flash the overlay. Gating on a hydration flag defers the decision until the real value is loaded. `partialize` keeps `_hasHydrated` out of storage so it can never be persisted as `true`.

---

### Recent-amount chips re-query on open, not on every render

`NumpadModal` loads `db.getRecentAmounts(sourceId, type, 3)` in an effect keyed on `isOpen`, the source bucket, and the transaction type — never inline in render.

**Why:** A synchronous SQLite read on every render would be wasteful and could interleave with typing. Re-querying only when the sheet opens (or the user flips expense/income) keeps the chips fresh after new entries without a per-keystroke cost. Amounts are de-duplicated and capped at 3 so the row never wraps; chips are suppressed in edit mode, where the amount is already pre-filled.

---

## Data

### Offline-first: SQLite write before any network

All writes go to SQLite synchronously before anything else happens. Network sync is a background concern.

**Why:** The app must be fully functional with no connectivity. The sync queue pattern decouples the write path from the network path entirely.

---

### Sync queue: enqueue on every write, flush separately

`useTransactionStore.add()` always writes a `sync_queue` row. A separate flush worker (not yet built) will drain the queue.

**Why:** Embedding retry logic in the write path would complicate the hot path and risk blocking the UI. A queue allows batching, exponential backoff, and deduplication independently.

---

### History screen queries SQLite directly, not `useTransactionStore`

The History screen calls `db.getTransactionsByPeriod` on focus and on period change. It does not subscribe to the transaction store.

**Why:** The transaction store holds only the current Home period slice to avoid redundant reloads. Sharing that slice with History would require either merging both periods' state or causing unnecessary Home re-renders when History changes its period. Direct DB reads on focus are cheap and keep each screen independent.

---

### Position stored as percentage (0–100) not absolute px

`Category.positionX` and `positionY` are percentages of the container dimensions.

**Why:** Percentages survive screen size changes and device rotations without requiring migration. Absolute pixel positions would be wrong on any device other than the one where the category was created.

---

## Animation

### Reanimated only — no `Animated` API

All animations use `useSharedValue`, `useAnimatedStyle`, and Reanimated worklet-based drivers. The React Native `Animated` API is never used.

**Why:** Reanimated runs entirely on the UI thread. The `Animated` API drives animations from the JS thread, which causes jank under heavy state updates (e.g. transaction confirm triggering recalcSizes, fireworks, and a store reload simultaneously).

---

### All non-worklet calls in gesture callbacks must use `runOnJS`

Reanimated 4 + Gesture Handler 2 compile gesture callbacks (`onBegin`, `onStart`, `onUpdate`, `onEnd`, `onFinalize`) as UI-thread worklets via the Babel plugin. Calling regular JS functions (Zustand store actions, `Haptics.*`, etc.) directly from these callbacks throws a JS exception inside Hermes's worklet runtime, which propagates as a C++ exception and terminates the process (`SIGABRT`).

**Rule:** Any call that crosses from the UI thread back to JS must use `runOnJS(fn)(args)`.

```ts
// ✅ correct
.onEnd(() => {
  runOnJS(openModal)(category.id);
})

// ❌ crashes at runtime
.onEnd(() => {
  openModal(category.id);
})
```

---

### Float animation: unique per bubble, seeded from position

Each bubble's float duration and amplitude are derived from `positionX` and `positionY`:

```ts
floatDuration  = 2800 + (positionX * 30) % 800    // 2800–3600 ms
floatAmplitude = 4 + (positionY * 0.03) % 3        // 4–7 px
```

**Why:** Identical timing makes the field look mechanical. Position-based seeding is deterministic (no random re-init on re-render) and produces natural variation without storing extra state.

---

### Gyroscope: low-pass filter + spring

Raw gyroscope data is smoothed with a low-pass filter (`α = 0.1`) before being applied to bubble field position via `withSpring`.

**Why:** Raw gyro data is noisy — applying it directly causes visible jitter. Low-pass filtering removes high-frequency noise. `withSpring` adds physical lag that matches the inertia feel of the PS Vita parallax effect.

---

## Settings & Localisation

### Theme default: Dark

**Why:** The frosted-glass bubble aesthetic reads best on dark backgrounds. Light mode is provided for accessibility but dark is the intended experience.

### Currency and language auto-detected, always overridable

Defaults are inferred from `expo-localization` locale/region at first launch. Both can be changed freely in Settings at any time.

**Why:** Most users don't want to configure these manually, but forcing a detected locale can be wrong (e.g. a Vietnamese user abroad). Overridability is non-negotiable.

### Notification re-schedule on language or time change

Whenever `notificationsEnabled`, `reminderHour`, `reminderMinute`, or `language` changes, the daily reminder is cancelled and rescheduled.

**Why:** The notification body is localised. If the user switches language, the queued notification would fire in the old language unless rescheduled. Time changes must also take effect immediately.

---

## Colors

### Bubble palette: 8 named keys, not hex values

Color keys (`frost`, `mist`, `dusk`, `slate`, `ash`, `haze`, `veil`, `smoke`) are stored on `Category`. Actual rgba values live in `constants/theme.ts` with dark and light variants.

**Why:** Storing a key rather than a hex value means we can change the entire color palette (e.g. for a future high-contrast mode) without migrating the database.

### Accent color: `#7c6af7`

Used for the confirm button (expense), active period tab indicator, and the notification toggle. Same in both dark and light themes.

**Why:** A single accent creates visual cohesion. The purple-violet hue sits well against both dark (#0D0D14) and light (#F4F3F8) backgrounds at sufficient contrast.

### Income semantic color: `#3DB882`, deficit: `#F76C6C`

Income amounts, income confirm button, income fireworks, and positive net balance use `#3DB882`. Negative net balance uses `#F76C6C`.

**Why:** Money in versus money out needs to be readable at a glance without reading the prefix. Green for inflow and red for deficit are conventional and survive both light and dark themes without re-tuning.

---

## Income & Expense

### Income transactions use the reserved `categoryId = '__income__'`

Stored as `INCOME_CATEGORY_ID` in `types/index.ts`. The constant is not added to the `categories` table.

**Why:** Income has no bubble — it's global, not per-category. A reserved ID keeps the transaction model uniform (one table, one query path) and avoids a schema split. The string is sentinel-style (`__double_underscore__`) so it cannot collide with a generated category ID.

### `Transaction.type` defaults to `'expense'` in SQLite

`ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'` is run idempotently in `initDb()` for installs that pre-date the column.

**Why:** Existing transactions had no type. Defaulting to `'expense'` preserves backward compatibility without a destructive migration — pre-existing rows continue to behave correctly and show up in the spend total.

### Bubble size reflects expense-only totals

`recalcSizes()` filters transactions to `type === 'expense'` before summing per-category totals.

**Why:** Income inflating bubble size would make the visual meaningless — a large bubble would no longer reliably signal "you're spending a lot here." Income is a global counter shown in the summary row, not a per-bubble property.

### Income entry point lives in the summary row, not on a bubble

Tapping the "Earned" column on the Home screen opens the numpad in income mode.

**Why:** The bubble field is for *spending*. Hanging an income bubble next to a bubble like "Coffee" would conflate inflows and outflows visually. Keeping income on the summary row puts it adjacent to the running total — the place users naturally look to see where the day stands.

---

## i18n

### `LocaleCode` and `TranslationKey` are derived types

`LocaleCode = keyof typeof DEFAULT_CATEGORIES` in `lib/i18n/defaultCategories.ts`.
`TranslationKey = keyof typeof en` in `lib/i18n/translations.ts`.
The Vietnamese dictionary is typed `Record<TranslationKey, string>` so a missing key is a compile error.

**Why:** Manual unions require updating multiple files in sync. Derived types (`keyof typeof`) make the compiler enforce completeness — adding a locale in one place makes TypeScript error on every place that needs to add a label or translation. The same pattern guards `LANGUAGE_META: Record<LocaleCode, ...>`.

### Default categories are locale-keyed, not translation-keyed

Seed categories live in `DEFAULT_CATEGORIES` keyed by `LocaleCode`. A separate `getDefaultCategories(locale)` returns the right list with an `en` fallback.

**Why:** Seed categories are *first-time setup data*, not runtime strings. They're written once into SQLite when the categories table is empty and never re-read. Coupling them to the live `t()` translation would mean the stored category name would silently re-render when the user switches language — confusing, since the user may have personalised it. Locale-keyed seeding keeps the database stable.

---

## Backup

### Backup format: JSON, full-fidelity, `categories` + `transactions`

Export serializes a `{ app, version, exportedAt, categories, transactions }` envelope (`lib/backup.ts`) to a `.json` file in the cache dir, then opens the share sheet (`lib/backupIO.ts`). The sync queue and settings are **not** exported — the queue is transient, and settings are trivially reconfigurable; the irreplaceable data is the categories and transactions.

**Why:** JSON round-trips the exact domain objects (an absent `note` stays `undefined`, not `null`), so a restore reproduces state precisely. CSV was rejected for the backup path because it's lossy (no clean type/sync/sentinel-income representation) and can't be re-imported without ambiguity. The `app`/`version` fields let `parseBackup` reject foreign files and let a future schema migrate older backups.

### Import replaces all data atomically; pure parse is separate from IO

`parseBackup` validates and throws *before* anything is written; the destructive `db.replaceAllData` wipes `sync_queue` → `transactions` → `categories` and bulk-inserts inside a single `withTransactionSync`. The UI confirms the replace between picking the file and committing it, then reloads the stores.

**Why:** A half-applied import would corrupt the ledger. Validating first means a bad file aborts with a clear message and an untouched DB; wrapping the wipe+insert in one transaction means a mid-import failure rolls back entirely. "Replace" (not "merge") keeps semantics predictable — merge would need conflict resolution on ids/amounts that a personal backup doesn't warrant. Keeping `lib/backup.ts` free of native imports is what makes the round-trip unit-testable.

---

## Insights

### Category breakdown is the History list header, scaled to the top category

`CategoryBreakdown` renders inside the `TransactionList` `ScrollView` (via a `header` slot) so it scrolls with the rows instead of stealing fixed height. Bars are scaled relative to the largest category (top bar is full-width) while the number shown is share of *total* spending; income and unknown-category rows are excluded. Aggregation is the pure `computeCategoryBreakdown` (`lib/insights.ts`).

**Why:** A fixed block above a `flex: 1` list would shrink the list on small screens; a scrolling header keeps all vertical space for transactions when you scroll. Scaling bars to the max (rather than to total) makes the ranking legible at a glance — the dominant category visibly dwarfs the rest — while the percentage still answers "what share was this." Excluding income matches the bubble-sizing rule: the breakdown is about *spending*.

---

## Insight drill-down

### Insight entry: chart icon in History header, not a new tab

Why: The 3-tab layout (Home / History / Settings) matches usage frequency. Insight is consulted occasionally, not on every session. Adding a 4th tab would promote it above its actual role. History is the natural context — users reviewing past data are already in "analysis mode."

---

### Insight drill-down managed via internal Reanimated stack, not Expo Router nested navigation

Why: The 3-level slide stack (year → month → week) plus the day-sheet overlay are managed as local state, not nested Expo Router routes. A local `stack: InsightLevel[]` with Reanimated shared values gives full control over the flat directional slide, lets a `frames` render-list keep the outgoing screen mounted through the transition (so it never flashes a loading skeleton on its way out), and coordinates the bottom-sheet overlay — all without spinning up extra routes (or a typed-route entry) per level. The level slide itself is deliberately flat (timing, no spring, no parallax): a springy/parallax transition read as "weird" here. The opening route push (History → Insight) is `animation: 'none'` for the same reason — the year bubbles' own entry animation provides the sense of arrival.

---

### Week definition: 4 groups per month (days 1–7, 8–14, 15–21, 22–end)

Why: Simple, predictable, and maps cleanly to the 4-column visual. ISO week numbers would cross month boundaries, making monthly aggregation ambiguous. The last group absorbs 7–10 days depending on month length — acceptable trade-off for a visual overview that communicates pattern, not accounting precision.

---

## Transaction editing

### The edit sheet re-reads the period after a write; a date change keeps the time-of-day

`updateTransaction` writes the row then re-queries the active period from SQLite (rather than patching the in-memory array) and re-scales bubbles. The numpad edit flow lets you change amount, date, category (expenses only), and note — never the `type` — and a new day is stamped at the transaction's *original* time-of-day.

**Why:** An edit can move a transaction across the period boundary or change its category, so an in-place patch could leave the Home slice or bubble sizes stale; re-reading is simplest and always correct. Type conversion (income↔expense) is excluded because it would change what the row *means* (income has no bubble, doesn't size categories) — better done as delete + re-add. Preserving the original clock time keeps a backdated row sorting naturally within its day, matching the create-flow rule.

---

## Testing

### Unit tests cover the pure logic layer only; helpers are extracted to enable it

`currency`, `period`, `bubbleSize`, `insights`, and `backup` live in `lib/*` importing only types, and each has a sibling `*.test.ts` run by `jest-expo`. `getPeriodRange` and the bubble-size formula were extracted out of the stores specifically so they could be tested without pulling in `expo-sqlite`/RN.

**Why:** Component/native tests on an Expo app are slow and flaky (native shims, gesture/animation worklets), and add little confidence for this app's risk areas. The real correctness risks are arithmetic and (de)serialization — currency formatting, period boundaries, size scaling, and backup round-trips — all pure and cheaply tested. Keeping these modules native-free is the constraint that keeps the suite fast (<1s) and deterministic.
