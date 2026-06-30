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
- [x] Category deletion UI (long-press a bubble in drag mode → confirmation sheet)
- [x] Edit / delete individual transactions (swipe to delete; tap → edit amount/date/category/note)
- [x] Custom category name + emoji input (not just presets)
- [x] Onboarding flow for first launch (uses `hasCompletedOnboarding` flag)
- [ ] FolderBubble — group multiple categories into one super-bubble
- [ ] Swipe gesture between period tabs on Home (in addition to tap)

## v1.2 — Budget & goals
- [x] Per-category budget setting (long-press a bubble → quick-actions menu → "Set budget")
- [x] Budget progress ring around bubble (monthly spend as % of cap; amber ≥80%, red over)
- [x] Alert when approaching / over budget limit (visual: ring color + red bubble halo)
- [x] Spending pace — projected month-end total on the "This month" tab, on-track vs budget
- [ ] Monthly savings goal — larger fireworks celebration when net is positive at month end
- [ ] Recurring expense templates (e.g. rent auto-logs on the 1st)

## v1.3 — Insights
- [x] Category spending breakdown per period ("Where it went" — bars on History)
- [ ] Spending trend chart (line chart, per category over time)
- [ ] "Peak spending" insight — which day/hour you spend most
- [x] Month-over-month comparison (expense delta vs previous month on the Insight month level)
- [ ] Largest single transaction highlight
- [ ] iOS/Android widget — today's total at a glance

## v1.4 — Backend & sync
- [x] Local backup / restore — JSON export + import of all categories + transactions (precursor to cloud backup)
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
- [x] Unit tests for the pure logic layer (Jest + jest-expo — currency, period, bubble size, insights, backup)
- [ ] Replace `expo-sqlite` synchronous API with async when Expo SDK stabilizes it
- [ ] Add proper error boundaries around SQLite operations
- [ ] E2E / component tests (gesture + native-module flows: backup IO, numpad edit) on real devices
- [ ] Performance profiling: Reanimated worklet count on low-end Android
