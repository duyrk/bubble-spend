# Bubble Spend 🫧

Offline-first expense tracker where every spending category is a floating glass bubble — the more you spend this period, the bigger it grows. Inspired by the PS Vita home screen.

Log a coffee in two taps: tap the ☕ bubble, punch the amount, done — fireworks included.

## Features

**Home — the bubble field**
- Frosted-glass category bubbles (max 8) with float animation and gyroscope parallax
- Tap a bubble → numpad sheet; long-press → iOS-style quick-actions menu (log, budget, recurring, rearrange, delete)
- Period tabs (Today / Yesterday / Week / Month) — tap or swipe to switch
- Expense **and** income logging with a type toggle; recent-amount chips; calendar backdating; undo toast
- Per-category **monthly budgets** with an on-bubble progress ring — accent under budget, amber at ≥ 80%, red over
- **Spending pace** on the month tab — projected month-end total vs your summed budgets
- **Recurring expenses** — daily / weekly / monthly templates that silently auto-log on app open (rent on the 1st, gym every Monday…)

**History**
- Date-grouped ledger with a "Where it went" per-category breakdown
- Edit amount / date / category / note; swipe to delete

**Insight**
- Year → month → week → day drill-down (month bubbles → week bars → day bars → transaction sheet)
- Spending **trend line** for the year, filterable per category
- Month-over-month delta, **peak day/time** spending habits, and the month's **biggest expense**

**Settings & data**
- Dark / light / system theme (dark-first frosted-glass aesthetic)
- English + Tiếng Việt, 8 currencies (auto-detected defaults)
- Daily reminder notification with configurable time
- Full **JSON backup** — export via share sheet, import replaces all local data atomically

Everything works offline: writes go to SQLite first and queue for a future sync backend.

## Tech stack

| | |
|---|---|
| Framework | React Native 0.81 · Expo SDK 54 · Expo Router 6 · TypeScript |
| Animation | Reanimated 4 + Gesture Handler 2 — all animations on the UI thread |
| State | Zustand 5 (AsyncStorage persistence for settings) |
| Storage | expo-sqlite 16, offline-first with a sync-queue table |
| Charts | react-native-svg |
| Testing | Jest 29 + jest-expo — the pure logic layer (`lib/*.ts`) is fully unit-tested |
| Backend | Golang (Gin · sqlc · PostgreSQL) in a separate repo — not yet integrated |

## Getting started

```bash
npm install
npx expo start          # dev server (press i / a for simulator)
```

Useful commands:

```bash
npx tsc --noEmit        # typecheck
npx eslint .            # lint
npm test                # unit tests (pure logic layer)
eas build --platform android --profile preview   # APK build
```

## Project structure

```
app/          Expo Router routes (tabs: Home · History · Settings, + /insight)
components/   Shared UI primitives (glass surface, tab bar, calendar, …)
features/     Screen feature modules (bubble, home, numpad, timeline, insight, settings, …)
stores/       Zustand stores (categories, transactions, recurring, UI, settings)
hooks/        Theme, currency, translation, gyroscope, …
lib/          SQLite layer + pure, unit-tested logic (budget, forecast, recurring, peaks, trend, backup, …)
constants/    Theme tokens and config
docs/         PRD, architecture, roadmap, design decisions
```

The architecture rule of thumb: anything that's pure math or pure data transformation lives in `lib/` with no React Native imports and a sibling `*.test.ts`; screens read SQLite through small hooks; every write hits SQLite before it touches in-memory state.

## Docs

- [`docs/PRD.md`](docs/PRD.md) — full product spec of what's built
- [`docs/architecture.md`](docs/architecture.md) — data flow, stores, animation/gesture architecture
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — release history and what's next
- [`docs/decisions.md`](docs/decisions.md) — locked design decisions with rationale

## Status

v1.3 feature-complete (minus a home-screen widget). Next up: the v1.4 backend — auth, sync-queue flush, and multi-device sync against the Go API.
