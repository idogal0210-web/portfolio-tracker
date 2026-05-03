# Supabase Cloud Sync — Design Spec

**Date:** 2026-05-03
**Scope:** Fix cross-device sync so data is visible on any device after sign-in and page refresh.

---

## Problem

The existing sync logic pushes local-only items to Supabase on sign-in, but never pulls cloud data back into React state. As a result, signing in on a new device shows empty data even though the cloud has all the holdings and transactions.

---

## Goal

After signing in on any device (desktop or mobile), a page refresh shows all data from the cloud. No real-time subscriptions needed — refresh-based sync is sufficient.

---

## Approach: Cloud-first on sign-in

When `userId` becomes available (sign-in or session restore on page load):

1. Fetch all cloud rows: `holdings`, `transactions`, `budgets`, `recurring_templates`
2. Find local-only items (items not yet in cloud) and upload them (existing behaviour)
3. **New:** Build merged arrays (`cloudData + localOnlyItems`) and:
   - Call `setHoldings / setTransactions / setBudgets / setRecurring` with merged data
   - Persist merged data back to localStorage as a cache

On page refresh, `persistSession: true` restores the session automatically, the `useEffect` on `userId` re-runs (the `syncedForUser` ref resets to `null` on every mount), and fresh cloud data is loaded.

All writes (`handleAdd`, `handleSaveTxn`, etc.) are unchanged — they continue to write to both localStorage and Supabase when a `userId` is present.

---

## What Changes

**File:** `src/App.jsx` — the `useEffect` block starting at the `if (!userId || syncedForUser.current === userId) return` guard (~line 2302).

**Current behaviour after `Promise.all` uploads:** does nothing with cloud data.

**New behaviour after `Promise.all` uploads:**
```js
const mergedH = [...cloudH, ...localOnlyH]
const mergedT = [...cloudT, ...localOnlyT]
const mergedB = [...cloudB, ...localOnlyB]
const mergedR = [...cloudR, ...localOnlyR]

setHoldings(mergedH);   saveHoldings(mergedH)
setTransactions(mergedT); saveTransactions(mergedT)
setBudgets(mergedB);    saveBudgets(mergedB)
setRecurring(mergedR);  saveRecurring(mergedR)
```

No other files need changes.

---

## Constraints

- No real-time subscriptions (Supabase channels) — refresh-based is enough.
- `useIsDesktop` hook (defined but unused) is out of scope for this spec — cleanup is a separate task.
- Supabase tables (`holdings`, `transactions`, `budgets`, `recurring_templates`) must already exist with correct RLS policies. If they don't, the fetch calls will return empty arrays and no data will be lost.

---

## Success Criteria

1. Sign in on desktop → all data uploads to cloud.
2. Open app on phone → sign in → refresh → see all holdings and transactions.
3. Add a transaction on phone → refresh desktop → transaction appears.
4. All 47 existing tests still pass (no utils logic changed).
