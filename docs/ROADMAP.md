# Bubble Spend — Roadmap & Future Direction

## v1.0 (current — pre-APK)
- ✅ Bubble field with float animation + gyro parallax
- ✅ Liquid Glass bubble rendering (gyro-tracked primary + secondary highlights, directional rim)
- ✅ Numpad modal — expense + income entry with type toggle
- ✅ Fireworks on confirm (color matches transaction type)
- ✅ Drag-to-reposition bubbles
- ✅ History screen with date grouping + expense / income / net summary
- ✅ Settings: theme / language / currency / notifications
- ✅ Offline-first SQLite + sync queue
- ✅ Locale-aware default categories (vi / en) and `__income__` sentinel for income

## v1.1 — Polish & retention
- [ ] Category deletion UI (swipe-to-delete in a manage sheet)
- [ ] Edit / delete individual transactions (swipe on history row)
- [ ] Custom category name + emoji input (not just presets)
- [ ] Onboarding flow for first launch (uses `hasCompletedOnboarding` flag)
- [ ] FolderBubble — group multiple categories into one super-bubble
- [ ] Swipe gesture between period tabs on Home (in addition to tap)

## v1.2 — Budget & goals
- [ ] Per-category budget setting
- [ ] Budget progress ring around bubble (visual fill as % of budget)
- [ ] Alert when approaching budget limit
- [ ] Monthly savings goal — larger fireworks celebration when net is positive at month end
- [ ] Recurring expense templates (e.g. rent auto-logs on the 1st)

## v1.3 — Insights
- [ ] Spending trend chart (line chart, per category over time)
- [ ] "Peak spending" insight — which day/hour you spend most
- [ ] Month-over-month comparison
- [ ] Largest single transaction highlight
- [ ] iOS/Android widget — today's total at a glance

## v1.4 — Backend & sync
- [ ] Golang backend integration (Gin, sqlc + pgx, PostgreSQL)
- [ ] User auth — Google Sign In + JWT
- [ ] Sync queue flush — drain `sync_queue` rows to backend
- [ ] Multi-device sync — same account, different phones
- [ ] Cloud backup / restore

## v2.0 — Ecosystem
- [ ] Export CSV / PDF report
- [ ] Shared expenses (split with another user)
- [ ] Bank/e-wallet import (VCB, Momo, ZaloPay via PDF statement parse)
- [ ] Apple Watch / WearOS companion for even faster logging

## Technical debt to address
- [ ] Replace `expo-sqlite` synchronous API with async when Expo SDK stabilizes it
- [ ] Add proper error boundaries around SQLite operations
- [ ] E2E tests with Detox (gesture simulation on real devices)
- [ ] Performance profiling: Reanimated worklet count on low-end Android
