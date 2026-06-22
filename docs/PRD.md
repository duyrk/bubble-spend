# Bubble Spend — Product Requirements Document

> Expense tracking app with a bubble-launcher UI. Each spending category is a floating bubble; size reflects how much you've spent. Inspired by the PS Vita home screen.

---

## Screens

### Home (bubble field)

**Period selector** — four tabs across the top: Today / Yesterday / This Week / This Month. Switching reloads transactions and recalculates bubble sizes.

**Summary row** — three columns directly under the period tabs:
- **Spent** (`↓`) — total expenses for the active period (default white text)
- **Earned** (`↑`) — total income (`#3DB882` green). Also acts as the **income entry point** — tapping the column opens the numpad in income mode.
- **Net** — `income − expense`. Green prefix `+` when positive, red prefix `−` (`#F76C6C`) when negative.

**Bubble field** — all categories rendered as frosted-glass circles floating inside a full-screen canvas. The whole field shifts with gyroscope input (parallax tilt effect).

Each bubble shows:
- Category emoji (large)
- Category name (small, below emoji)
- Spend amount for the active period — compact form (e.g. `$1.2k`, `380 ₫`) — or "tap" hint if zero

**Gestures on a bubble:**
- **Tap** (< 500 ms): opens the numpad modal for that category (expense mode by default)
- **Long press** (≥ 500 ms): enters drag mode with haptic feedback

**Drag mode:**
- All bubbles wobble
- Bubbles become pannable — drag to reposition; position is persisted to SQLite
- A "Done ✓" pill appears top-right; pressing it exits drag mode
- Tab-bar swipe navigation is disabled while drag mode is active

**Numpad modal** — slides up from the bottom:
- Type toggle pill at the top: `− Expense` | `+ Income`. Switching does not reset the typed amount.
- Header row shows the source bubble (emoji + name) in expense mode; in income mode it shows `💰 Income` regardless of source.
- Large amount display with currency symbol (position adapts to locale)
- Digit keys: 1–9, 0, 000 (for zero-decimal currencies like VND); backspace key
- "Done ✓" confirm button — accent purple in expense mode, green (`#3DB882`) in income mode. Creates transaction, closes modal, triggers fireworks (matching color).
- "Cancel" link at bottom
- The floating tab bar hides automatically while the numpad is open
- 10-digit max input

**Fireworks effect** — particle burst plays from the bubble's position on expense confirm, or from the income pill area on income confirm. Particle color is taken from the source bubble's glow / the income green respectively.

**Empty state hint** — "Tap a bubble to log your first spend" displayed when no transactions exist for the period and drag mode is off.

**Add category button** — floating "+" above the tab bar in the bottom-right corner (hidden at 8-bubble limit). Opens a bottom sheet with 12 preset emoji/name combinations. Color key is auto-assigned by cycling through the 8 bubble colors.

---

### History

Period selector tabs (same four options as Home, independent state).

**Header** — three-column summary identical to Home: Spent / Earned / Net, with the same colour treatment.

**Transaction list** — chronological list of all transactions in the period, grouped by date. Each row shows:
- Category emoji + name (`💰 Income` for income rows)
- Amount with sign — `−450,000 ₫` in white for expenses, `+1,200,000 ₫` in green for income
- Time of transaction

Empty state: "No transactions yet" + hint to go log one from Home.

---

### Settings

**Appearance**
- Theme: Dark / Light / System (default: Dark)
- Language: English / Tiếng Việt (default: auto-detected from device locale). Options derived from `SUPPORTED_LOCALES`; adding a locale requires no settings code change.

**General**
- Currency: VND / USD / EUR / GBP / JPY / KRW / SGD / THB (default: auto-detected from device region)

**Notifications**
- Daily reminder toggle — requests OS permission on first enable
- Reminder time picker: 09:00 / 12:00 / 18:00 / 21:00 / 22:00 (default: 21:00)
- Notification content localised to the current language

**About**
- App version + build number (read from `expo-application`)

---

## Income Tracking

- Income transactions use a reserved `categoryId = '__income__'` (exported as `INCOME_CATEGORY_ID` from `types/index.ts`)
- Income is not tied to any bubble category
- Income does **not** affect bubble sizes — `recalcSizes()` skips any transaction whose `type !== 'expense'` or whose `categoryId === '__income__'`
- All transactions carry a `type: 'expense' | 'income'` field (defaults to `'expense'` for rows that existed before the migration)

---

## Category Management

- Max **8 categories** on screen at any time — hard limit enforced in the store
- Default categories seeded on first launch (locale-aware):
  - `vi`: Ăn uống 🍜, Grab 🛵, Cà phê ☕, Mua sắm 🛍️, Nhà ở 🏠
  - `en`: Food 🍔, Transport 🚗, Coffee ☕, Shopping 🛍️, Housing 🏠
- Add via preset picker (12 preset options)
- Delete: not exposed in UI yet (store method exists)
- Position persisted as percentage coordinates (0–100) relative to the field container

---

## Data & Sync

- All data is stored locally in SQLite (offline-first)
- Every new transaction is written to a `sync_queue` table for future server sync
- `synced` flag on each transaction; will be flipped once the backend flush is implemented
- No server calls in the current build

---

## Not Yet Implemented

- Custom category name / emoji input (only presets supported)
- Category deletion UI
- Edit / delete existing transactions
- Backend API integration (sync queue writes but never flushes)
- Onboarding flow (`hasCompletedOnboarding` flag exists in settings store)
- FolderBubble grouping (component scaffolded, not wired)
