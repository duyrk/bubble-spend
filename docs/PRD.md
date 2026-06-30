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

**Budget ring** — a category with a monthly budget shows a progress ring around its bubble: this calendar month's spend ÷ the cap (always monthly, regardless of the active period tab). The accent color under budget, amber at ≥ 80%, red once over — and an over-budget bubble swaps its soft glow for a red halo. Set via the quick-actions menu (below).

**Gestures on a bubble:**
- **Tap** (< 500 ms): opens the numpad modal for that category (expense mode by default)
- **Long press** (≥ 500 ms): opens the **quick-actions menu** (haptic feedback)

**Quick-actions menu** — an iOS-style long-press menu: a blurred backdrop dims the field and a menu pops anchored next to the pressed bubble (its window frame is captured via `measure()`). Rows: *Log expense* (opens the numpad), *Set budget* (→ a monthly-cap editor sheet, showing the current cap if any), *Rearrange* (→ drag mode), and *Delete category* (destructive, red → the delete confirmation). Tap the backdrop to dismiss.

**Drag mode** (entered via *Rearrange*):
- All bubbles do a gentle, slow wobble
- Bubbles become pannable — drag to reposition; position is persisted to SQLite
- A "Done ✓" pill appears top-right; pressing it exits drag mode
- Tab-bar swipe navigation is disabled while drag mode is active

**Spending pace** — on the "This month" tab only, a line under the summary projects the month-end total from the daily rate so far (`spent ÷ day-of-month × days-in-month`). When category budgets exist it also flags *on track* or *over* against the summed monthly budget. Hidden until the month has any spend.

**Numpad modal** — slides up from the bottom:
- Type toggle pill at the top: `− Expense` | `+ Income`. Switching does not reset the typed amount.
- Header row shows the source bubble (emoji + name) in expense mode; in income mode it shows `💰 Income` regardless of source.
- **Date pill** (`📅 Today`) under the header — tap to open a calendar and pick any past day to backdate the entry. Resets to Today each time the sheet opens; future days are disabled. Hidden while editing an existing transaction.
- Large amount display with currency symbol (position adapts to locale)
- Digit keys: 1–9, 0, 000 (for zero-decimal currencies like VND); backspace key
- **Recent amount chips** — up to 3 of the most recent distinct amounts for that bubble (or for income) appear above the keypad; tap one to fill the amount instantly. Updated each time the sheet opens; hidden while editing an existing transaction.
- "Done ✓" confirm button — accent purple in expense mode, green (`#3DB882`) in income mode. Creates transaction, closes modal, triggers fireworks (matching color).
- "Cancel" link at bottom
- The floating tab bar hides automatically while the numpad is open
- 10-digit max input

**Fireworks effect** — particle burst plays from the bubble's position on expense confirm, or from the income pill area on income confirm. Particle color is taken from the source bubble's glow / the income green respectively.

**Empty state hint** — "Tap a bubble to log your first spend" displayed when no transactions exist for the period and drag mode is off.

**Add category button** — floating "+" above the tab bar in the bottom-right corner (hidden at 8-bubble limit). Opens a bottom sheet with 12 preset emoji/name combinations, plus a **Custom** option to type a name and pick from ~40 icons. Color key is auto-assigned by cycling through the 8 bubble colors.

**Onboarding (first launch)** — a one-time coaching overlay introduces the non-obvious gestures: tap to log, long-press for the quick-actions menu, Rearrange to drag bubbles, and the "Earned" income entry point. Dismissed with "Got it". Gated on the persisted `hasCompletedOnboarding` flag and shown only after settings hydrate, so returning users never see a flash.

---

### History

Period selector tabs (same four options as Home, independent state).

**Header** — three-column summary identical to Home: Spent / Earned / Net, with the same colour treatment.

**Category breakdown** — a "Where it went" section above the list ranks the period's expense categories, each with a proportion bar (scaled to the top category, tinted with that bubble's colour) and its share of total spending. Hidden when the period has no expenses.

**Transaction list** — chronological list of all transactions in the period, grouped by date. Each row shows:
- Category emoji + name (`💰 Income` for income rows)
- Amount with sign — `−450,000 ₫` in white for expenses, `+1,200,000 ₫` in green for income
- Time of transaction, plus its note when present

Empty state: "No transactions yet" + hint to go log one from Home.

---

### Insight (Yearly drill-down)

Entry point: chart icon button in the History screen header.

**Year overview** — 12 month bubbles in a 4×3 grid. Bubble size scales linearly with spending (52px base → 82px max, same formula as home). Current month has a ring indicator. Future months are dimmed and non-tappable. Year navigator (← →). Summary row: total expense / income / net for the year.

**Month detail** — slides in from the right. Shows expense / income / net stats, a **month-over-month** delta (this month's expense vs the previous month — up in red, down in green, hidden when there's no prior-month baseline), category breakdown bars (actual DB totals), and 4 tappable week columns. Tap a week column → week detail.

**Week detail** — shows 7-day bar chart (Mon–Sun), stats (total / peak day / daily avg), and category breakdown for that week. Tap a day column → day sheet.

**Day sheet** — bottom sheet overlay with actual transactions for that day. Transaction list matches History screen item style. Backdrop tap to close.

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

**Data**
- Export backup — writes all categories + transactions to a JSON file and opens the share sheet to save or send it
- Import backup — pick a previously exported file; after a confirmation it **replaces** all current categories and transactions

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
- Add via preset picker (12 presets) or a custom name + icon (~40 icons)
- Delete: long-press a bubble in drag mode → confirmation sheet (cascades to delete its transactions)
- Position persisted as percentage coordinates (0–100) relative to the field container

---

## Data & Sync

- All data is stored locally in SQLite (offline-first)
- Every new transaction is written to a `sync_queue` table for future server sync
- `synced` flag on each transaction; will be flipped once the backend flush is implemented
- No server calls in the current build

---

## Implemented since the original spec

- Custom category name / emoji input (preset grid + a Custom step)
- Category deletion UI (long-press in drag mode → confirmation sheet)
- Edit a transaction's amount, date, category (expenses), and note (tap the amount in History → numpad edit sheet); delete it (swipe the row)
- First-launch onboarding overlay (wires up `hasCompletedOnboarding`)
- Recent-amount quick chips on the numpad
- Backdating new transactions via a JS-only calendar date picker on the numpad
- Undo toast on Home immediately after logging a transaction
- Per-category spending breakdown ("Where it went") on the History screen
- Data export / import — JSON backup of all categories + transactions via the share sheet; restore replaces all local data
- Insight screen — year → month → week → day drill-down (chart icon in the History header)
- Per-category monthly budgets with an on-bubble progress ring; set via the drag-mode bubble action sheet
- Spending pace projection on the "This month" tab (on-track / over-budget against summed caps)
- Month-over-month expense comparison on the Insight month level
- Jest unit tests for the pure logic layer (currency, period, bubble size, insights, backup, budget, forecast)

## Not Yet Implemented

- Backend API integration (sync queue writes but never flushes)
- FolderBubble grouping (component scaffolded, not wired)
- Editing a transaction's income/expense type, or its exact time of day (the edit sheet covers amount, date, category, and note)
- Recurring expense templates (e.g. rent auto-logs on the 1st)
- Over-budget *push notifications* — the budget warning is visual-only (ring color + bubble halo); no notification is sent
- A "smarter" daily reminder (skip if already logged today, surface today's running total) — doing this reliably needs background tasks or the backend; today's reminder is a fixed daily nudge
