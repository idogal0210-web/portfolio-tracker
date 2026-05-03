# Supabase Cloud Sync — Design Spec

**Date:** 2026-05-03
**Scope:** Make cross-device sync work so data is visible on any device after sign-in and page refresh.

---

## Actual State (after code review)

The sync code is **already fully implemented**:

- `src/supabase.js` — Supabase client using `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- `src/api.js` — CRUD functions for all 4 tables with `fromDb`/`toDb` converters
- `src/App.jsx` lines 2301–2344 — on sign-in: fetches cloud data, merges local-only items (uploads them), re-fetches final authoritative state, then calls `setHoldings / setTransactions / setBudgets / setRecurring` and updates localStorage cache
- `supabase/migrations/0001_init.sql` — full schema with RLS policies, already written
- GitHub Actions secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` — already configured for production builds

## What Is Actually Missing

1. **Migration not applied** — `0001_init.sql` exists locally but has never been run against the live Supabase project. All table fetches currently return `error` and the sync silently fails.
2. **No `.env.local`** — local dev builds cannot connect to Supabase. Only the production GitHub Actions build has credentials. Developers cannot test sync locally.
3. **Dead code** — `useIsDesktop` hook (lines 99–110 in App.jsx) is defined but never called anywhere.

---

## Goal

1. Apply the existing migration to the live Supabase project so tables + RLS policies exist.
2. Add `.env.local` so local dev connects to Supabase.
3. Verify the full sign-up → sync → cross-device flow works end-to-end.
4. Remove the dead `useIsDesktop` hook.

---

## Approach

No code changes needed for the sync logic itself. The implementation is three operational steps + one code deletion:

1. Create `.env.local` from `.env.example` with real Supabase credentials.
2. Run `0001_init.sql` in the Supabase SQL Editor.
3. Test locally: sign up in Settings → Cloud sync, add a holding, verify it appears in Supabase.
4. Delete `useIsDesktop` from App.jsx.

---

## Sync flow (for reference)

```
Page load / sign-in
  └─ onAuthChange fires → userId set
       └─ useEffect on userId
            ├─ fetch [cloudH, cloudT, cloudB, cloudR]
            ├─ load [localH, localT, localB, localR]
            ├─ compute local-only items not in cloud
            ├─ bulkUpsert local-only items to cloud
            ├─ re-fetch final state [finalH, finalT, finalB, finalR]
            └─ setHoldings/setTransactions/setBudgets/setRecurring
               + saveHoldings/saveTransactions/saveBudgets/saveRecurring
```

---

## Success Criteria

1. Sign in on desktop → all holdings/transactions appear in Supabase dashboard tables.
2. Open app on phone → sign in with same account → holdings and transactions visible immediately.
3. Add a transaction on phone → refresh desktop → transaction appears.
4. All 47 existing tests still pass (no logic changes).
