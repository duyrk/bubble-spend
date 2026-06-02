# Bubble Spend

Expense tracking app with bubble UI. Each spending category = a bubble. Size reflects spending. Inspired by PS Vita launcher.

Full PRD and architecture: @docs/PRD.md

---

## Stack

- **Framework:** React Native + Expo SDK, Expo Router, TypeScript
- **Animation:** Reanimated 3 + Gesture Handler — all animations on UI thread
- **State:** Zustand
- **Local DB:** expo-sqlite (offline-first, sync queue pattern)
- **Server state:** TanStack Query + Axios
- **Backend:** Golang (separate repo) — Gin, sqlc + pgx, PostgreSQL

## Project Structure

```
app/
  (tabs)/index.tsx        # Home — bubble field
  (tabs)/history.tsx      # Transaction timeline
  _layout.tsx
components/
  bubble/                 # BubbleField, BubbleItem, FolderBubble
  input/                  # NumpadModal, AmountDisplay
  effects/                # Fireworks
  timeline/               # TransactionList, TransactionItem
stores/                   # useCategoryStore, useTransactionStore, useUIStore
hooks/                    # useBubblePhysics, useDragGesture, useFireworks
constants/                # theme.ts (colors/sizes), config.ts
types/index.ts
docs/                     # Reference docs — load with @docs/filename.md when needed
```

---

## Always Follow

**Animations — Reanimated 3 only, never React Native's Animated API:**

```typescript
// ✅
const scale = useSharedValue(1);
const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

// ❌
const scale = new Animated.Value(1);
```

**Colors — always from theme, never hardcoded:**

```typescript
// ✅
import { COLORS } from '@/constants/theme'
// ❌
style={{ backgroundColor: '#7c6af7' }}
```

**Writes — local SQLite first, then enqueue sync. Never block UI on network.**

**Types — `type` for data objects, `interface` for component props.**

---

## Key Rules (non-negotiable)

- Max 8 bubbles on screen — hard limit, enforced in `useCategoryStore`
- Gesture priority: tap < 500ms → open numpad | long press ≥ 500ms → drag mode
- Drag mode active = swipe navigation disabled (no gesture conflict)
- Bubble size: `BASE=76px`, `MAX=118px`, scales by `amount/maxAmount` ratio
- Always timestamp transactions with `Date.now()` at confirm, never ask user for date/time

---

## Run & Verify

```bash
npx expo start          # dev server
npx expo start --ios    # iOS simulator
npx tsc --noEmit        # typecheck
npx eslint .            # lint
```

---

## Reference Docs (load on demand)

- `@docs/PRD.md` — full product requirements, feature list, priorities
- `@docs/architecture.md` — data flow, API endpoints, offline sync design
- `@docs/decisions.md` — locked design decisions with rationale
