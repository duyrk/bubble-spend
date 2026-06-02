# Bubble Spend — Design Decisions

Locked decisions with rationale. Change these only with a deliberate choice, not by accident.

---

## UI / UX

### Bubble limit: 8 max

Hard-capped at 8 categories. Enforced in `useCategoryStore.addCategory()` — throws if exceeded. The `AddCategoryButton` hides itself when at the limit.

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

### No date/time input — always `Date.now()` at confirm

Transaction `transactedAt` is set at the moment the user presses confirm on the numpad.

**Why:** Asking for date/time adds friction to every entry. The primary use case is logging expenses as they happen. Backdating can be addressed later if demand exists.

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

Used for the confirm button, active period tab indicator, and the notification toggle. Same in both dark and light themes.

**Why:** A single accent creates visual cohesion. The purple-violet hue sits well against both dark (#0D0D14) and light (#F4F3F8) backgrounds at sufficient contrast.
