# IQ.FINANCE Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the IQ.FINANCE luxury visual aesthetic (gold/green dual-accent, Inter font, luxury glassmorphism) to the existing React app, keeping all tab structure and business logic unchanged, and add AI Insights + Document Scan features powered by Gemini.

**Architecture:** Visual-only reskin of `src/App.jsx` components plus a new `src/gemini.js` utility. A shared `AppHeader` component is extracted to the App level replacing per-screen headers. All data flow, Supabase sync, and utils remain untouched.

**Tech Stack:** React 19, Tailwind CSS v4, Vite, Gemini REST API (`gemini-2.5-flash`)

**Spec:** `docs/superpowers/specs/2026-04-29-iq-finance-reskin-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `index.html` | Modify | Add Inter font from Google Fonts |
| `src/index.css` | Modify | Update glass utilities, add `glass-panel`, `iq-label` |
| `src/gemini.js` | Create | Gemini REST API helper with retry |
| `src/App.jsx` | Modify | All component restyling + AppHeader + AI features |

---

## Task 1: Add Inter font and update CSS utilities

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Add Inter font to `index.html`**

Open `index.html`. Add this inside `<head>`, after the existing `<meta>` tags:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Update CSS utilities in `src/index.css`**

Replace the existing `@layer utilities` block with this updated version:

```css
@layer utilities {
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* IQ.FINANCE panel — replaces old glass-card */
  .glass-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.025), transparent);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 2rem;
  }

  /* IQ.FINANCE small panel — replaces old glass-card-small */
  .glass-card-small {
    background: linear-gradient(135deg, rgba(255,255,255,0.02), transparent);
    border: 1px solid rgba(255,255,255,0.035);
    border-radius: 1.5rem;
  }

  /* New: ultra-subtle glass panel for insight rows */
  .glass-panel {
    background: rgba(255,255,255,0.01);
    border: 1px solid rgba(255,255,255,0.03);
  }

  /* Existing utilities — keep unchanged */
  .glass-effect {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .glass-form {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-radius: 35px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.2);
  }

  .glass-input {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: white;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .glass-nav {
    background: rgba(20, 20, 25, 0.7);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-radius: 30px;
  }
}
```

- [ ] **Step 3: Update body font in `src/index.css`**

In the `@theme` block at the top of `src/index.css`, update font-family:

```css
@theme {
  --color-slate-950: #050505;
  --font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

- [ ] **Step 4: Run dev server and confirm Inter font loads**

```bash
npm run dev
```

Open browser at `http://localhost:5173`. Open DevTools → Network → filter by "inter". Confirm font files are fetched. Numbers on the screen should appear in Inter.

- [ ] **Step 5: Commit**

```bash
git add index.html src/index.css
git commit -m "style: add Inter font and update glass utilities for IQ reskin"
```

---

## Task 2: Create Gemini API helper

**Files:**
- Create: `src/gemini.js`
- Create: `src/test/gemini.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/test/gemini.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callGemini } from '../gemini'

describe('callGemini', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns text from a successful response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'hello insight' }] } }]
      })
    })
    const result = await callGemini({ contents: [] }, 'test-key', false)
    expect(result).toBe('hello insight')
  })

  it('parses JSON when isJson=true', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '[{"amount":100}]' }] } }]
      })
    })
    const result = await callGemini({ contents: [] }, 'test-key', true)
    expect(result).toEqual([{ amount: 100 }])
  })

  it('retries on failure and eventually throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'))
    await expect(callGemini({ contents: [] }, 'test-key', false, 2)).rejects.toThrow('network error')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/test/gemini.test.js
```

Expected: FAIL — `callGemini` not found.

- [ ] **Step 3: Create `src/gemini.js`**

```js
const GEMINI_ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`

/**
 * Call the Gemini REST API.
 * @param {object} payload  - Gemini request body
 * @param {string} apiKey   - VITE_GEMINI_KEY value
 * @param {boolean} isJson  - if true, JSON.parse the returned text
 * @param {number} maxRetries
 * @returns {Promise<string|object>}
 */
export async function callGemini(payload, apiKey, isJson = false, maxRetries = 3) {
  let delay = 800
  let lastErr
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(GEMINI_ENDPOINT(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('No text in Gemini response')
      return isJson ? JSON.parse(text) : text
    } catch (err) {
      lastErr = err
      if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, delay))
      delay *= 2
    }
  }
  throw lastErr
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/test/gemini.test.js
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/gemini.js src/test/gemini.test.js
git commit -m "feat: add Gemini API helper with retry logic"
```

---

## Task 3: Add shared AppHeader + restyled TabBar

**Files:**
- Modify: `src/App.jsx` (TabBar component ~line 566, App render ~line 1873)

- [ ] **Step 1: Replace the `TabBar` component**

Find the `TabBar` function (around line 566) and replace it entirely with:

```jsx
// ─── AppHeader ────────────────────────────────────────────────────────────────
function AppHeader({ currency, onToggleCurrency, onRefresh, loading }) {
  return (
    <header className="sticky top-0 z-40 flex justify-between items-center px-5 py-4"
      style={{ background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="flex items-center gap-2.5">
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#D4AF37', boxShadow: '0 0 10px rgba(212,175,55,0.8)' }} />
        <span style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#fff', fontWeight: 300 }}>
          IQ.FINANCE
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onToggleCurrency}
          style={{ fontSize: 9, fontWeight: 700, color: '#71717a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 8px', letterSpacing: '0.15em', background: 'transparent' }}>
          {currency}
        </button>
        <button onClick={onRefresh} disabled={loading}
          style={{ color: '#52525b', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={loading ? 'animate-spin' : ''}>
            <path d="M21 12a9 9 0 11-3.5-7.1M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </header>
  )
}

// ─── TabBar ───────────────────────────────────────────────────────────────────
function TabBar({ activeTab, onTabChange, onAdd }) {
  const tabs = [
    { key: 'home',     label: 'Home',     path: 'M3 13l9-9 9 9M5 11v10h14V11' },
    { key: 'markets',  label: 'Markets',  path: 'M3 17l4-4 4 4 7-7 3 3' },
    { key: 'activity', label: 'Activity', path: 'M3 6h18M3 12h18M3 18h18' },
    { key: 'you',      label: 'You',      path: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 8c0-4 4-6 8-6s8 2 8 6' },
  ]
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center px-5 pt-2"
      style={{
        background: 'linear-gradient(180deg,transparent,rgba(5,5,5,0.95) 40%)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.03)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
      }}>
      {tabs.slice(0, 2).map(t => (
        <TabBtn key={t.key} path={t.path} label={t.label}
          active={activeTab === t.key} onClick={() => onTabChange(t.key)} />
      ))}
      <div className="flex-1 flex justify-center">
        <button onClick={onAdd}
          className="w-[48px] h-[48px] rounded-full flex items-center justify-center -translate-y-1 font-bold"
          style={{ background: '#D4AF37', boxShadow: '0 6px 20px rgba(212,175,55,0.35)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {tabs.slice(2).map(t => (
        <TabBtn key={t.key} path={t.path} label={t.label}
          active={activeTab === t.key} onClick={() => onTabChange(t.key)} />
      ))}
    </div>
  )
}

function TabBtn({ path, label, active, onClick }) {
  return (
    <button onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1 bg-transparent border-0 p-0">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d={path} stroke={active ? '#D4AF37' : 'rgba(255,255,255,0.25)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600,
        color: active ? '#D4AF37' : 'rgba(255,255,255,0.25)' }}>
        {label}
      </span>
      {active
        ? <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4AF37' }} />
        : <div style={{ width: 4, height: 4 }} />}
    </button>
  )
}
```

- [ ] **Step 2: Wire AppHeader into the App render**

Find the App `return (...)` block (around line 1873). Update it to add `AppHeader` and adjust the inner container to account for header height:

```jsx
return (
  <div className="bg-[#050505] text-white" style={{
    height: '100dvh',
    overflow: 'hidden',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    WebkitFontSmoothing: 'antialiased',
  }}>
    <div className="max-w-[430px] mx-auto relative" style={{ height: '100dvh', overflow: 'hidden' }}>
      <AppHeader
        currency={currency}
        onToggleCurrency={toggleCurrency}
        onRefresh={refresh}
        loading={loading}
      />
      <div className="absolute inset-0" style={{ top: 65, overflow: 'hidden' }}>
        {activeTab === 'home' && (
          <PortfolioScreen
            holdings={holdings} enriched={enriched} prices={prices}
            exchangeRate={exchangeRate} currency={currency}
            onToggleCurrency={toggleCurrency} onRefresh={refresh}
            loading={loading} stale={stale} lastUpdated={lastUpdated}
            onSelectHolding={setSelected}
            onDeleteHolding={handleDelete}
            onMoveHolding={(ticker, dir) => {
              setHoldings(prev => {
                const idx = prev.findIndex(h => h.symbol === ticker)
                if (idx < 0) return prev
                const next = [...prev]
                const swap = dir === 'up' ? idx - 1 : idx + 1
                if (swap < 0 || swap >= next.length) return prev
                ;[next[idx], next[swap]] = [next[swap], next[idx]]
                saveHoldings(next)
                return next
              })
            }}
          />
        )}
        {activeTab === 'activity' && (
          <ActivityScreen
            transactions={transactions} budgets={budgets}
            currency={currency} exchangeRate={exchangeRate}
            onToggleCurrency={toggleCurrency}
            onOpenBudgets={() => setManagingBudgets(true)}
            onOpenRecurring={() => setManagingRecurring(true)}
            onEditTxn={setEditingTxn}
            onExportCsv={handleExportCsv}
          />
        )}
        {activeTab === 'markets' && <MarketsScreen />}
        {activeTab === 'you' && (
          <YouScreen
            currency={currency} onToggleCurrency={toggleCurrency}
            cloudAvailable={supabaseConfigured}
            session={session} syncing={syncing}
            onSignIn={() => setShowAuth(true)}
            onSignOut={handleSignOut}
          />
        )}
      </div>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} onAdd={handleFab} />

      {selected && <HoldingDetail h={selected} onBack={() => setSelected(null)} onDelete={handleDelete} apiKey={apiKey} />}
      {adding && <AddHoldingSheet onClose={() => setAdding(false)} onAdd={handleAdd} />}
      {(addingTxn || editingTxn) && (
        <AddTransactionSheet
          initial={editingTxn}
          defaultCurrency={currency}
          onClose={() => { setAddingTxn(false); setEditingTxn(null) }}
          onSave={handleSaveTxn}
          onDelete={handleDeleteTxn}
        />
      )}
      {managingBudgets && (
        <BudgetSheet budgets={budgets} defaultCurrency={currency}
          onClose={() => setManagingBudgets(false)}
          onSave={handleSaveBudget} onDelete={handleDeleteBudget} />
      )}
      {managingRecurring && (
        <RecurringSheet templates={recurring} defaultCurrency={currency}
          onClose={() => setManagingRecurring(false)}
          onSave={handleSaveRecurring} onDelete={handleDeleteRecurring} />
      )}
      {showAuth && (
        <AuthSheet onClose={() => setShowAuth(false)} onSignedIn={setSession} />
      )}
    </div>

    <style>{`
      .sheet-input {
        width: 100%; height: 46px; border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03); color: white;
        padding: 0 14px; font-size: 15px; outline: none;
        box-sizing: border-box; font-family: inherit;
        -webkit-appearance: none; appearance: none;
      }
      .sheet-input::placeholder { color: rgba(255,255,255,0.2); }
      .sheet-input[type="date"] { color: rgba(255,255,255,0.85); font-size: 14px; min-height: 46px; }
      .sheet-input-date::-webkit-date-and-time-value { text-align: left; }
      .sheet-input-date::-webkit-calendar-picker-indicator { opacity: 0.6; cursor: pointer; }
      select.sheet-input { padding-right: 32px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M6 9l6 6 6-6' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
      select.sheet-input option { background: #1a1a1c; color: white; }
    `}</style>
  </div>
)
```

- [ ] **Step 3: Remove per-screen header from PortfolioScreen**

In `PortfolioScreen`, find the `{/* Header */}` block (around line 682–710) and delete it. The shared AppHeader now covers this. Also remove the `stale` warning banner and add it back inside PortfolioScreen below the chart (since AppHeader handles currency/refresh):

```jsx
{stale && (
  <div className="mx-5 mt-3 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-2xl px-4 py-2">
    ⚠ Could not fetch live prices — showing cached data.
  </div>
)}
```

- [ ] **Step 4: Remove per-screen header from ActivityScreen**

In `ActivityScreen`, find and delete the `{/* Header */}` div (around line 1280–1308) — currency toggle and overflow menu. The shared AppHeader provides currency toggle. Keep the overflow menu buttons accessible via a smaller control: add a small `⋯` button inside the month picker row in ActivityScreen.

- [ ] **Step 5: Remove per-screen header from YouScreen**

In `YouScreen`, delete the header `<div className="px-5 pt-3 pb-4">` block (around line 1453–1456).

- [ ] **Step 6: Run dev server and verify**

```bash
npm run dev
```

Confirm: gold IQ.FINANCE header appears at top on all tabs. Tab bar has gold active state + gold FAB. No duplicate headers.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add AppHeader and restyle TabBar with IQ gold accent"
```

---

## Task 4: Restyle PortfolioScreen (Home tab)

**Files:**
- Modify: `src/App.jsx` — `PortfolioScreen` component

- [ ] **Step 1: Restyle net worth hero section**

In `PortfolioScreen`, find the hero card section (inside `<div className="mx-5 mt-4">`). Replace the content with:

```jsx
{/* Hero — Net Worth */}
<div className="mx-5 mt-6 text-center">
  <div style={{ fontSize: 8, letterSpacing: '0.5em', textTransform: 'uppercase', color: '#D4AF37', marginBottom: 10 }}>
    Total Net Worth
  </div>
  <div className="flex items-baseline justify-center gap-1">
    <span style={{ fontSize: 48, fontWeight: 200, color: '#fff', letterSpacing: '-2px', lineHeight: 1 }}>
      {holdings.length
        ? (currency === 'ILS' ? formatCurrency(totalILS, 'ILS') : formatCurrency(totalUSD, 'USD')).replace(/[₪$]/, '')
        : '0.00'}
    </span>
    <span style={{ fontSize: 11, color: '#52525b', letterSpacing: '0.1em', marginLeft: 4 }}>{currency}</span>
  </div>
  {holdings.length > 0 && (
    <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
        color: isGainUp ? '#22c55e' : '#f43f5e',
        background: isGainUp ? 'rgba(34,197,94,0.12)' : 'rgba(244,63,94,0.12)' }}>
        {isGainUp ? '+' : ''}{formatCurrency(gainUSD, 'USD')} today
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
        background: 'rgba(255,255,255,0.06)',
        color: isAllTimeUp ? '#22c55e' : '#f43f5e' }}>
        {isAllTimeUp ? '+' : ''}{allTimePct.toFixed(2)}% all time
      </span>
    </div>
  )}
</div>

{/* Chart */}
<div className="mt-5 -mx-0">
  <PriceChart data={chartData} color={chartColor} width={390} height={90}
    formatValue={v => formatCurrency(v, 'USD')} />
</div>
<div className="flex gap-1 mx-5 mt-2 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
  {ranges.map(r => (
    <button key={r} onClick={() => setRange(r)}
      style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 10, fontWeight: 600, border: 'none',
        background: range === r ? 'rgba(212,175,55,0.12)' : 'transparent',
        color: range === r ? '#D4AF37' : 'rgba(255,255,255,0.35)',
        cursor: 'pointer' }}>
      {r}
    </button>
  ))}
</div>

{/* Income / Expense grid */}
{holdings.length > 0 && (
  <div className="mx-5 mt-4 grid grid-cols-2 gap-3">
    <div className="glass-card-small p-4">
      <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#52525b', marginBottom: 8 }}>
        ↗ Portfolio Value
      </div>
      <div style={{ fontSize: 16, color: '#fff', fontWeight: 300 }}>
        {currency === 'ILS' ? formatCurrency(totalILS, 'ILS') : formatCurrency(totalUSD, 'USD')}
      </div>
    </div>
    <div className="glass-card-small p-4">
      <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#52525b', marginBottom: 8 }}>
        ↗ All-time ROI
      </div>
      <div style={{ fontSize: 16, fontWeight: 300, color: isAllTimeUp ? '#22c55e' : '#f43f5e' }}>
        {isAllTimeUp ? '+' : ''}{allTimePct.toFixed(2)}%
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Restyle the Allocation section**

Find the allocation section (around `{/* Allocation */}`). Keep the existing logic. Update the tab buttons to use gold active state:

```jsx
<button key={key} onClick={() => setAllocTab(key)}
  className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-colors`}
  style={{ background: allocTab === key ? 'rgba(212,175,55,0.12)' : 'transparent',
    color: allocTab === key ? '#D4AF37' : 'rgba(255,255,255,0.35)',
    border: 'none', cursor: 'pointer' }}>
  {label}
</button>
```

- [ ] **Step 3: Restyle `HoldingRow` component**

Find `HoldingRow` (around line 241). Replace its return value with:

```jsx
return (
  <div onClick={onClick}
    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
    style={{ transition: 'background 0.15s' }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
    {/* Icon ring in gold */}
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#D4AF37', fontSize: 16, flexShrink: 0,
    }}>
      {display[0]}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span style={{ color: '#fff', fontWeight: 500, fontSize: 14, letterSpacing: '0.05em' }}>{display}</span>
        <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.06)', color: '#52525b',
          background: 'rgba(255,255,255,0.02)' }}>
          {currency}
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#52525b', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {h.qty < 1 ? h.qty.toFixed(4) : h.qty.toLocaleString()} · {h.name}
      </div>
    </div>
    <Sparkline data={spark} color={sparkColor} width={48} height={20} />
    <div className="text-right min-w-[78px]">
      <div style={{ color: '#fff', fontWeight: 500, fontSize: 13, letterSpacing: '0.02em' }}>
        {metrics ? formatCurrency(metrics.currentValue, currency) : '—'}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: dayColor }}>
        {h.dayChange === 0 ? '0.00%' : `${h.dayChange > 0 ? '+' : ''}${h.dayChange.toFixed(2)}%`}
      </div>
    </div>
  </div>
)
```

- [ ] **Step 4: Run dev server and verify Home tab looks correct**

```bash
npm run dev
```

Check: centered net worth with `font-weight: 200`, gold label, gold range tabs when active, gold icon rings on holdings, allocation tabs gold when active.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "style: restyle PortfolioScreen with IQ luxury aesthetic"
```

---

## Task 5: Restyle ActivityScreen

**Files:**
- Modify: `src/App.jsx` — `ActivityScreen` component, `TransactionRow` component

- [ ] **Step 1: Restyle ActivityScreen month picker**

Find the month picker section in `ActivityScreen` (the `<div className="flex items-center justify-center gap-4 px-5 py-2">` block). Replace with:

```jsx
{/* Month picker */}
<div className="mx-5 mt-4 flex items-center justify-between glass-panel p-4 rounded-3xl">
  <button onClick={prevMonth}
    style={{ background: 'transparent', border: 'none', color: '#52525b', cursor: 'pointer', padding: 8, display: 'flex' }}>
    <svg width="8" height="14" viewBox="0 0 10 18" fill="none">
      <path d="M8 2L2 9l6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
  <div className="flex flex-col items-center">
    <span style={{ fontSize: 7, letterSpacing: '0.4em', color: '#52525b', textTransform: 'uppercase', marginBottom: 3 }}>
      Fiscal Period
    </span>
    <span style={{ fontSize: 10, color: '#fff', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 300 }}>
      {MONTH_NAMES[viewMonth - 1]} {viewYear}
    </span>
  </div>
  <button onClick={nextMonth}
    style={{ background: 'transparent', border: 'none', color: '#52525b', cursor: 'pointer', padding: 8, display: 'flex' }}>
    <svg width="8" height="14" viewBox="0 0 10 18" fill="none">
      <path d="M2 2l6 7-6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
</div>
```

- [ ] **Step 2: Restyle ActivityScreen summary card**

Find the summary card section (the `{/* Summary card */}` block). Update the three stat labels to use gold for net:

```jsx
<div className="mx-5 mt-3">
  <div className="glass-card p-5">
    <div className="grid grid-cols-3 gap-0">
      {[
        ['Income', totals.income, '#22c55e'],
        ['Expenses', totals.expenses, '#f43f5e'],
        ['Net', totals.net, netColor],
      ].map(([lbl, val, clr]) => (
        <div key={lbl} className={lbl !== 'Income' ? 'border-l pl-3' : ''}
          style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 7, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.3em', color: lbl === 'Net' ? '#D4AF37' : '#52525b', marginBottom: 6 }}>
            {lbl}
          </div>
          <div style={{ fontSize: 17, fontWeight: 300, color: clr, letterSpacing: '-0.5px' }}>
            {lbl === 'Expenses' ? '−' : ''}{formatCurrency(Math.abs(val), currency)}
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

- [ ] **Step 3: Restyle `TransactionRow`**

Find `TransactionRow` (around line 898). Replace return value with:

```jsx
return (
  <button onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer bg-transparent border-0 text-left"
    style={{ transition: 'background 0.15s' }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
    {/* Accent bar */}
    <div style={{ width: 2, height: 24, borderRadius: 2, flexShrink: 0,
      background: isIncome ? '#22c55e' : '#f43f5e' }} />
    <CategoryIcon category={txn.category} type={txn.type} size={38} />
    <div className="flex-1 min-w-0">
      <div style={{ color: '#e4e4e7', fontWeight: 500, fontSize: 13, letterSpacing: '0.03em' }}>
        {txn.category}
      </div>
      <div style={{ color: '#52525b', fontSize: 10, marginTop: 2, letterSpacing: '0.05em' }}>
        {txn.note || (isIncome ? 'Income' : 'Expense')}
      </div>
    </div>
    <div className="text-right shrink-0">
      <div style={{ fontWeight: 600, fontSize: 13, color, letterSpacing: '0.02em' }}>
        {sign}{formatCurrency(converted, displayCurrency)}
      </div>
      {txn.currency !== displayCurrency && (
        <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>
          {formatCurrency(txn.amount, txn.currency)}
        </div>
      )}
    </div>
  </button>
)
```

- [ ] **Step 4: Run dev server and verify Activity tab**

```bash
npm run dev
```

Confirm: IQ-style month picker, gold "Net" label in summary, accent bar on transactions.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "style: restyle ActivityScreen and TransactionRow with IQ aesthetic"
```

---

## Task 6: Restyle bottom sheets

**Files:**
- Modify: `src/App.jsx` — `AddHoldingSheet`, `AddTransactionSheet`

The existing sheets are already dark panels. We're updating the title style, submit button color, and type toggle.

- [ ] **Step 1: Update `AddHoldingSheet` title and button**

In `AddHoldingSheet`, find the header section and replace:

```jsx
{/* Sheet handle */}
<div style={{ width: 48, height: 4, borderRadius: 2, background: '#3f3f46', margin: '0 auto 28px' }} />

{/* Title */}
<div className="flex justify-between items-center mb-6">
  <div>
    <span style={{ fontSize: 8, letterSpacing: '0.4em', color: '#D4AF37', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
      Wealth
    </span>
    <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 300, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      New Asset
    </h2>
  </div>
  <button onClick={onClose}
    style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.05)', color: '#71717a', fontSize: 18, display: 'flex',
      alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
</div>
```

Replace the submit button:

```jsx
<button onClick={handleSubmit}
  className="w-full mt-5 rounded-2xl font-semibold text-[11px] tracking-[0.3em] uppercase"
  style={{ height: 52, background: 'transparent', border: '1px solid #D4AF37',
    color: '#D4AF37', cursor: 'pointer',
    boxShadow: '0 5px 20px rgba(212,175,55,0.1)', fontFamily: 'inherit' }}>
  Append Position
</button>
```

- [ ] **Step 2: Update `AddTransactionSheet` type toggle and button**

In `AddTransactionSheet`, replace the type segmented control:

```jsx
<div className="flex gap-1 p-1 rounded-2xl mb-4"
  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
  {['EXPENSE', 'INCOME'].map(t => (
    <button key={t} onClick={() => changeType(t)}
      className="flex-1 rounded-xl text-[10px] font-bold tracking-widest uppercase"
      style={{
        height: 40, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: type === t
          ? (t === 'INCOME' ? 'rgba(34,197,94,0.1)' : 'rgba(244,63,94,0.1)')
          : 'transparent',
        color: type === t
          ? (t === 'INCOME' ? '#22c55e' : '#f43f5e')
          : 'rgba(255,255,255,0.3)',
        boxShadow: type === t
          ? (t === 'INCOME' ? '0 0 0 1px rgba(34,197,94,0.2)' : '0 0 0 1px rgba(244,63,94,0.2)')
          : 'none',
      }}>
      {t === 'INCOME' ? 'Income' : 'Expense'}
    </button>
  ))}
</div>
```

Replace the submit button:

```jsx
<button onClick={handleSubmit}
  className="w-full rounded-xl font-semibold text-[11px] tracking-[0.3em] uppercase"
  style={{ height: 52, marginTop: 16, background: '#D4AF37', color: '#000',
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 5px 20px rgba(212,175,55,0.2)' }}>
  {isEdit ? 'Save Changes' : 'Secure Record'}
</button>
```

- [ ] **Step 3: Run dev server — open both sheets and verify**

```bash
npm run dev
```

Open the + FAB → add holding, add transaction. Confirm gold title accents, updated buttons, income/expense toggle colors.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "style: restyle AddHoldingSheet and AddTransactionSheet with IQ aesthetic"
```

---

## Task 7: Restyle YouScreen

**Files:**
- Modify: `src/App.jsx` — `YouScreen` component

- [ ] **Step 1: Update YouScreen layout**

Replace the entire `YouScreen` return with:

```jsx
return (
  <div className="overflow-y-auto no-scrollbar" style={{
    height: '100%',
    paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
    paddingTop: 24,
  }}>
    <div className="mx-5 space-y-4">
      {/* Profile card */}
      <div className="glass-card-small p-5 flex items-center gap-4">
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#D4AF37', fontSize: 22,
        }}>
          {email ? email[0].toUpperCase() : '◎'}
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 400, letterSpacing: '0.02em' }}>
            {email ? email.split('@')[0] : 'Guest'}
          </div>
          <div style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: 3 }}>
            {session ? 'Cloud Synced' : 'Local Only'}
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div>
        <div style={{ fontSize: 8, fontWeight: 600, color: '#52525b', textTransform: 'uppercase',
          letterSpacing: '0.25em', marginBottom: 8, paddingLeft: 4 }}>
          Preferences
        </div>
        <div className="glass-card-small p-4 flex items-center justify-between">
          <span style={{ fontSize: 13, color: '#d4d4d8' }}>Display currency</span>
          <button onClick={onToggleCurrency}
            style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37',
              background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}>
            {currency} →
          </button>
        </div>
      </div>

      {/* Cloud sync */}
      {cloudAvailable && (
        <div>
          <div style={{ fontSize: 8, fontWeight: 600, color: '#52525b', textTransform: 'uppercase',
            letterSpacing: '0.25em', marginBottom: 8, paddingLeft: 4 }}>
            Cloud Sync
          </div>
          <div className="glass-card-small p-4">
            {syncing && <div style={{ fontSize: 10, color: '#22c55e', marginBottom: 8 }}>Syncing…</div>}
            {session ? (
              <>
                <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 12 }}>
                  Synced as {email}
                </div>
                <button onClick={onSignOut}
                  style={{ width: '100%', height: 40, borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.6, marginBottom: 12 }}>
                  Sign in to sync across devices.
                </div>
                <button onClick={onSignIn}
                  style={{ width: '100%', height: 40, borderRadius: 12,
                    background: '#D4AF37', color: '#000',
                    fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Sign in / Create account
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  </div>
)
```

- [ ] **Step 2: Run dev server and verify You tab**

```bash
npm run dev
```

Confirm: gold avatar ring, gold currency toggle, gold sign-in button.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "style: restyle YouScreen with IQ gold aesthetic"
```

---

## Task 8: Add AI Insights to Home tab

**Files:**
- Modify: `src/App.jsx` — `PortfolioScreen` component + App state
- Modify: `src/App.jsx` — import `callGemini`

- [ ] **Step 1: Add `callGemini` import to App.jsx**

At the top of `src/App.jsx`, add:

```js
import { callGemini } from './gemini'
```

- [ ] **Step 2: Add `VITE_GEMINI_KEY` constant in App**

In the `App` function, after `const apiKey = import.meta.env.VITE_RAPIDAPI_KEY`, add:

```js
const geminiKey = import.meta.env.VITE_GEMINI_KEY ?? ''
```

- [ ] **Step 3: Pass `geminiKey` to PortfolioScreen**

In the App render, update the `<PortfolioScreen>` JSX to pass:

```jsx
<PortfolioScreen
  ...
  geminiKey={geminiKey}
  transactions={transactions}
/>
```

- [ ] **Step 4: Update `PortfolioScreen` signature**

Change the function signature from:

```jsx
function PortfolioScreen({ holdings, enriched, prices, exchangeRate, currency, onToggleCurrency, onRefresh, loading, stale, lastUpdated, onSelectHolding, onDeleteHolding, onMoveHolding }) {
```

to:

```jsx
function PortfolioScreen({ holdings, enriched, prices, exchangeRate, currency, onToggleCurrency, onRefresh, loading, stale, lastUpdated, onSelectHolding, onDeleteHolding, onMoveHolding, geminiKey, transactions }) {
```

- [ ] **Step 5: Add AI Insights state and handler inside PortfolioScreen**

Add after the existing `useState` calls in `PortfolioScreen`:

```jsx
const [insightsOpen, setInsightsOpen] = useState(false)
const [insightsText, setInsightsText] = useState('')
const [insightsLoading, setInsightsLoading] = useState(false)

async function fetchInsights() {
  if (!geminiKey || insightsLoading) return
  setInsightsLoading(true)
  try {
    const prompt = `You are a smart personal financial advisor. Here is the user's data:
Holdings: ${JSON.stringify(holdings.map(h => ({ symbol: h.symbol, shares: h.shares, purchasePrice: h.purchasePrice })))}
Recent transactions: ${JSON.stringify((transactions || []).slice(0, 20))}

Give exactly 2 short, actionable insights in English about their portfolio and financial behaviour. Be concise, encouraging, and professional. No markdown.`
    const text = await callGemini(
      { contents: [{ parts: [{ text: prompt }] }] },
      geminiKey,
      false
    )
    setInsightsText(text)
    setInsightsOpen(true)
  } catch {
    setInsightsText('Unable to fetch insights. Check your Gemini API key.')
    setInsightsOpen(true)
  } finally {
    setInsightsLoading(false)
  }
}
```

- [ ] **Step 6: Add AI Insights button + panel to PortfolioScreen JSX**

Add this block near the bottom of the PortfolioScreen return, after the holdings list and before the closing `</div>`:

```jsx
{/* AI Insights — only shown if VITE_GEMINI_KEY is set */}
{geminiKey && (
  <div className="mx-5 mt-4 mb-4">
    <button onClick={fetchInsights} disabled={insightsLoading}
      className="w-full flex items-center justify-between"
      style={{
        padding: '14px 16px', borderRadius: 16,
        background: 'linear-gradient(90deg, rgba(212,175,55,0.12), transparent)',
        border: '1px solid rgba(212,175,55,0.25)',
        color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: '0 4px 20px rgba(212,175,55,0.1)',
        opacity: insightsLoading ? 0.7 : 1,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#D4AF37', fontSize: 16, display: 'inline-block',
          animation: insightsLoading ? 'spin 1s linear infinite' : 'none' }}>✦</span>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.03em' }}>
          {insightsLoading ? 'Analyzing...' : 'Get AI Insights'}
        </span>
      </div>
      <span style={{ color: '#D4AF37', fontSize: 14 }}>›</span>
    </button>

    {insightsOpen && insightsText && (
      <div style={{
        marginTop: 10, padding: 16, borderRadius: 14,
        background: '#0A0A0A', border: '1px solid rgba(212,175,55,0.15)',
      }}>
        <div style={{ fontSize: 9, color: '#D4AF37', textTransform: 'uppercase',
          letterSpacing: '0.2em', fontWeight: 600, marginBottom: 10 }}>
          Smart Financial Advisor
        </div>
        <p style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
          {insightsText}
        </p>
        <button onClick={() => setInsightsOpen(false)}
          style={{ marginTop: 12, fontSize: 10, color: '#52525b', background: 'transparent',
            border: 'none', cursor: 'pointer', padding: 0 }}>
          Dismiss
        </button>
      </div>
    )}
  </div>
)}
```

Also add the spin keyframe to the `<style>` block at the bottom of App:

```css
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
```

- [ ] **Step 7: Test with no Gemini key (button hidden)**

```bash
npm run dev
```

Without `VITE_GEMINI_KEY` set in `.env.local`, confirm the AI Insights button does not appear.

- [ ] **Step 8: Test with a Gemini key**

Create `.env.local` (if it doesn't exist):

```
VITE_GEMINI_KEY=your-key-here
```

Restart dev server. Confirm button appears. Click it — confirm it shows loading state then insights text (or error message if key is invalid).

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx src/gemini.js
git commit -m "feat: add AI Insights panel to Home tab via Gemini"
```

---

## Task 9: Add Document Scan to Activity tab

**Files:**
- Modify: `src/App.jsx` — `ActivityScreen` component

- [ ] **Step 1: Pass `geminiKey` and `onSaveTxn` to ActivityScreen**

In App render, update `<ActivityScreen>`:

```jsx
<ActivityScreen
  transactions={transactions} budgets={budgets}
  currency={currency} exchangeRate={exchangeRate}
  onToggleCurrency={toggleCurrency}
  onOpenBudgets={() => setManagingBudgets(true)}
  onOpenRecurring={() => setManagingRecurring(true)}
  onEditTxn={setEditingTxn}
  onExportCsv={handleExportCsv}
  geminiKey={geminiKey}
  onSaveTxn={handleSaveTxn}
/>
```

- [ ] **Step 2: Update `ActivityScreen` signature**

```jsx
function ActivityScreen({
  transactions, budgets, currency, exchangeRate,
  onToggleCurrency, onOpenBudgets, onOpenRecurring, onEditTxn, onExportCsv,
  geminiKey, onSaveTxn,
}) {
```

- [ ] **Step 3: Add scan state and handler in `ActivityScreen`**

Add after the existing `useState` calls in `ActivityScreen`:

```jsx
const [scanning, setScanning] = useState(false)
const fileInputRef = useRef(null)

async function handleScan(file) {
  if (!file || !geminiKey) return
  setScanning(true)
  try {
    let payload
    const isText = file.name.endsWith('.csv') || file.type === 'text/csv'
    if (isText) {
      const textData = await file.text()
      payload = {
        contents: [{ role: 'user', parts: [
          { text: 'Analyze this CSV of financial transactions. Extract them as JSON. Categories allowed: Housing, Food, Transport, Utilities, Health, Entertainment, Subscriptions, Insurance, Shopping, Other, Salary, Dividends, Interest, Gift. Respond ONLY with valid JSON array.' },
          { text: textData },
        ]}],
        generationConfig: { responseMimeType: 'application/json' },
      }
    } else {
      const base64Data = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
      })
      const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
      payload = {
        contents: [{ role: 'user', parts: [
          { text: 'Analyze this receipt or bank statement. Extract transactions as JSON array with fields: amount (number), category (string), note (string), currency ("ILS" or "USD"), type ("EXPENSE" or "INCOME"). Respond ONLY with valid JSON.' },
          { inlineData: { mimeType, data: base64Data } },
        ]}],
        generationConfig: { responseMimeType: 'application/json' },
      }
    }
    const parsed = await callGemini(payload, geminiKey, true)
    const arr = Array.isArray(parsed) ? parsed : []
    const today = new Date().toISOString().slice(0, 10)
    arr.forEach(t => {
      if (!t.amount || !t.type) return
      onSaveTxn({ type: t.type, amount: Number(t.amount), currency: t.currency || currency,
        category: t.category || 'Other', note: t.note || '', date: today })
    })
    if (arr.length === 0) alert('No transactions found in this document.')
  } catch (err) {
    console.error('Scan error:', err)
    alert('Could not parse document. Please try a different file.')
  } finally {
    setScanning(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
}
```

Also add `useRef` to the import at the top of the file (it's already imported in the main imports — check).

- [ ] **Step 4: Add Scan button + file input to ActivityScreen JSX**

At the top of the ActivityScreen return, after the month picker and before the sparkline, add:

```jsx
{/* Scan button — only when geminiKey is set */}
{geminiKey && (
  <div className="mx-5 mt-3 flex justify-end">
    <input ref={fileInputRef} type="file" accept=".csv,.pdf,.xls,.xlsx,image/*"
      style={{ display: 'none' }}
      onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f) }} />
    <button onClick={() => fileInputRef.current?.click()} disabled={scanning}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 12,
        border: '1px solid rgba(212,175,55,0.3)',
        background: 'rgba(212,175,55,0.05)', color: '#D4AF37',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
        cursor: scanning ? 'not-allowed' : 'pointer',
        opacity: scanning ? 0.6 : 1, fontFamily: 'inherit',
      }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      {scanning ? 'Scanning...' : 'Scan'}
    </button>
  </div>
)}
```

- [ ] **Step 5: Run dev server and test scan**

```bash
npm run dev
```

With `VITE_GEMINI_KEY` set: go to Activity tab, confirm Scan button appears. Click it, upload an image of a receipt or a CSV file. Confirm transactions are added to the ledger.

Without `VITE_GEMINI_KEY`: confirm Scan button is hidden.

- [ ] **Step 6: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all existing tests (26) pass. The 3 new gemini tests pass. Total: 29 passing.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Document Scan to Activity tab via Gemini vision"
```

---

## Task 10: Final polish pass

**Files:**
- Modify: `src/App.jsx` — background glow, HoldingDetail, MarketBadge

- [ ] **Step 1: Update background glow in App**

In the App root `div` style, replace the existing `backgroundImage` with the IQ gold glow:

```jsx
backgroundImage: 'radial-gradient(at 50% 0%, rgba(212,175,55,0.06) 0%, transparent 60%)',
```

- [ ] **Step 2: Update `MarketBadge` colors**

Find `MarketBadge` (around line 215). Update:

```jsx
const styles = {
  IL:     'text-blue-400',
  US:     'text-zinc-500',
  CRYPTO: 'text-amber-400',
}
return (
  <span style={{
    fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
    padding: '1px 5px', borderRadius: 3,
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    color: market === 'IL' ? '#60a5fa' : market === 'CRYPTO' ? '#f59e0b' : '#71717a',
  }}>
    {market}
  </span>
)
```

- [ ] **Step 3: Update `HoldingDetail` back button and range tabs to gold**

In `HoldingDetail`, find the range tab buttons and update active style:

```jsx
className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors`}
style={{
  background: range === r ? 'rgba(212,175,55,0.12)' : 'transparent',
  color: range === r ? '#D4AF37' : 'rgba(255,255,255,0.4)',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}}
```

- [ ] **Step 4: Run full test suite one final time**

```bash
npm test
```

Expected: 29 tests pass, 0 failing.

- [ ] **Step 5: Build and verify no build errors**

```bash
npm run build
```

Expected: build completes without errors. Check `dist/` exists.

- [ ] **Step 6: Final commit**

```bash
git add src/App.jsx
git commit -m "style: final IQ.FINANCE polish — gold glow, MarketBadge, HoldingDetail tabs"
```

---

## Self-Review Notes

- All spec color roles covered: gold UI chrome ✓, green financial signals ✓, rose losses ✓
- Inter font: Task 1 ✓
- `glass-panel` utility: Task 1 ✓  
- AppHeader: Task 3 ✓
- Tab bar gold: Task 3 ✓
- Net worth centered + light weight: Task 4 ✓
- HoldingRow restyled: Task 4 ✓
- ActivityScreen month picker: Task 5 ✓
- TransactionRow accent bar: Task 5 ✓
- Sheets gold title + button: Task 6 ✓
- YouScreen gold: Task 7 ✓
- AI Insights: Task 8 ✓
- Document Scan: Task 9 ✓
- `src/gemini.js` tested: Task 2 ✓
- No changes to utils.js, api.js: confirmed ✓
- `VITE_GEMINI_KEY` guard on both AI features: Task 8 step 7, Task 9 step 4 ✓
