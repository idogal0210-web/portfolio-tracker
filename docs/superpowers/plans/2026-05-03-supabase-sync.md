# Supabase Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cross-device sync work by applying the existing Supabase schema, wiring up local dev credentials, and removing dead code.

**Architecture:** The sync logic is already fully implemented in App.jsx. The only missing pieces are: the database tables don't exist yet in Supabase (migration never applied), local dev has no `.env.local`, and one dead hook needs removing.

**Tech Stack:** Supabase (Postgres + Auth), React 19, Vite

---

### Task 1: Create `.env.local` for local development

**Files:**
- Create: `.env.local` (git-ignored via `*.local`)

- [ ] **Step 1: Copy the example file**

```bash
cp .env.example .env.local
```

- [ ] **Step 2: Fill in your Supabase credentials**

Open `.env.local` and replace the placeholder values. Get the values from your Supabase project: **Project Settings → API**.

```
VITE_RAPIDAPI_KEY=<your existing RapidAPI key>
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon/public key>
```

- [ ] **Step 3: Verify Vite picks it up**

```bash
npm run dev
```

Open the browser console. There should be no `Supabase is not configured` warning. The Settings → Cloud sync section should show "Sign in" instead of being hidden.

---

### Task 2: Apply the SQL migration to Supabase

**Files:**
- Read: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Open the Supabase SQL Editor**

In your browser: go to your Supabase project → **SQL Editor** → **New query**.

- [ ] **Step 2: Run the migration**

Copy the entire contents of `supabase/migrations/0001_init.sql` and paste it into the SQL Editor. Click **Run**.

Expected: all statements succeed with no errors. You should see tables `holdings`, `transactions`, `budgets`, `recurring_templates`, and `profiles` in the **Table Editor**.

- [ ] **Step 3: Verify RLS is enabled**

In **Table Editor**, click each table → **Policies**. Each table should show at least one policy (e.g. `holdings_user_all`).

---

### Task 3: Test sign-up and sync locally

- [ ] **Step 1: Sign up via the app**

With `npm run dev` running, open `http://localhost:5173/portfolio-tracker/`.

Go to **Settings** → scroll to **Cloud sync** → tap **Sign in**. In the AuthSheet, switch to "Create account", enter an email and password, and submit.

Expected: "Syncing…" appears briefly, then disappears. No console errors.

- [ ] **Step 2: Verify data uploaded to Supabase**

In the Supabase **Table Editor** → `holdings` table: your existing holdings should appear as rows with your `user_id`.

If the holdings table is empty but you have local holdings, check the browser console for errors from `bulkUpsertHoldings`.

- [ ] **Step 3: Test cross-device sync**

Open the app in a different browser (or Incognito) at `http://localhost:5173/portfolio-tracker/`. Sign in with the same account.

Expected: after sign-in, your holdings and transactions appear — loaded from Supabase, not from the other browser's localStorage.

- [ ] **Step 4: Test write sync**

In the second browser, add a new transaction (Cashflow tab → +). Go back to the first browser and refresh the page.

Expected: the new transaction appears in the first browser.

---

### Task 4: Remove dead `useIsDesktop` hook

**Files:**
- Modify: `src/App.jsx:99-110`

- [ ] **Step 1: Delete the hook**

Remove lines 99–110 from `src/App.jsx` — the entire `useIsDesktop` function:

```js
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = e => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 47 passing, 0 failing.

- [ ] **Step 3: Verify dev server still runs**

```bash
npm run dev
```

Open the app, confirm no console errors, all 4 tabs work normally.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "refactor: remove unused useIsDesktop hook"
```

---

### Task 5: Push and verify production build

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Verify GitHub Actions build succeeds**

Watch the Actions tab on GitHub. The build step passes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from secrets — `supabaseConfigured` will be `true` in the deployed build.

- [ ] **Step 3: Test on the live URL**

Open `https://idogal0210-web.github.io/portfolio-tracker/` on your phone. Sign in with the same account used on desktop.

Expected: holdings and transactions appear immediately after sign-in.
