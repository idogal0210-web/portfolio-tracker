# Enhanced Holdings & Portfolio Calculations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend each holding with purchase price, fees, dividends, and purchase date, then display calculated metrics (cost basis, current value, total return, ROI%, break-even) per holding, with automatic Agurot→Shekel conversion for TASE stocks.

**Architecture:** Add `calculateHoldingMetrics` to `utils.js`, update the holding data model and `AddStockForm` in `App.jsx` to collect new fields, and extend `StockCard` to display the derived metrics. Backward-compatibility is handled by defaulting new fields to `0` when loading old localStorage data.

**Tech Stack:** React 19, Vitest, @testing-library/react, Tailwind CSS 4, Vite

---

## File Map

| File | Change |
|------|--------|
| `src/utils.js` | Add `calculateHoldingMetrics`, update `loadHoldings` migration |
| `src/test/utils.test.js` | Add tests for `calculateHoldingMetrics` |
| `src/App.jsx` | Update `AddStockForm` (new fields), `StockCard` (new metrics display) |

---

### Task 1: Add `calculateHoldingMetrics` to utils.js

**Files:**
- Modify: `src/utils.js`
- Test: `src/test/utils.test.js`

- [ ] **Step 1: Write the failing tests**

Open `src/test/utils.test.js` and add this test block after the existing `calculateTotals` tests:

```js
import { calculateHoldingMetrics } from '../utils.js'

describe('calculateHoldingMetrics', () => {
  const baseHolding = {
    symbol: 'AAPL',
    shares: 10,
    purchasePrice: 150,
    fees: 5,
    dividends: 20,
    purchaseDate: '2024-01-01',
  }

  test('calculates adjustedCostBasis as (purchasePrice * shares) + fees', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    // (150 * 10) + 5 = 1505
    expect(result.adjustedCostBasis).toBeCloseTo(1505)
  })

  test('calculates currentValue as currentPrice * shares', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    // 190 * 10 = 1900
    expect(result.currentValue).toBeCloseTo(1900)
  })

  test('calculates totalReturn as currentValue + dividends - adjustedCostBasis', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    // 1900 + 20 - 1505 = 415
    expect(result.totalReturn).toBeCloseTo(415)
  })

  test('calculates roiPct as (totalReturn / adjustedCostBasis) * 100', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    // (415 / 1505) * 100 ≈ 27.57
    expect(result.roiPct).toBeCloseTo(415 / 1505 * 100, 1)
  })

  test('calculates breakEven as (adjustedCostBasis - dividends) / shares', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    // (1505 - 20) / 10 = 148.5
    expect(result.breakEven).toBeCloseTo(148.5)
  })

  test('divides both currentPrice and purchasePrice by 100 for .TA stocks', () => {
    const taseHolding = { ...baseHolding, symbol: 'ELBT.TA', purchasePrice: 15000 }
    // purchasePrice in Agurot: 15000 / 100 = 150 ILS
    // currentApiPrice in Agurot: 19000
    const result = calculateHoldingMetrics(taseHolding, 19000)
    // effectivePurchasePrice = 150, effectiveCurrentPrice = 190
    // adjustedCostBasis = (150 * 10) + 5 = 1505
    expect(result.adjustedCostBasis).toBeCloseTo(1505)
    expect(result.currentValue).toBeCloseTo(1900)
  })

  test('returns roiPct = 0 when adjustedCostBasis is 0', () => {
    const zeroCost = { ...baseHolding, purchasePrice: 0, fees: 0, dividends: 0 }
    const result = calculateHoldingMetrics(zeroCost, 190)
    expect(result.roiPct).toBe(0)
  })

  test('defaults fees and dividends to 0 if missing', () => {
    const minimal = { symbol: 'AAPL', shares: 10, purchasePrice: 150 }
    const result = calculateHoldingMetrics(minimal, 190)
    expect(result.adjustedCostBasis).toBeCloseTo(1500)
    expect(result.totalReturn).toBeCloseTo(400)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /home/idoga/portfolio-tracker && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: FAIL with `calculateHoldingMetrics is not a function` (or similar import error).

- [ ] **Step 3: Implement `calculateHoldingMetrics` in utils.js**

Open `src/utils.js` and add this function at the end of the file (before any existing exports if needed — just append it):

```js
export function calculateHoldingMetrics(holding, currentApiPrice) {
  const isTASE = isILStock(holding.symbol)
  const effectiveCurrentPrice = isTASE ? currentApiPrice / 100 : currentApiPrice
  const effectivePurchasePrice = isTASE ? (holding.purchasePrice || 0) / 100 : (holding.purchasePrice || 0)

  const fees = holding.fees || 0
  const dividends = holding.dividends || 0
  const shares = holding.shares || 0

  const adjustedCostBasis = effectivePurchasePrice * shares + fees
  const currentValue = effectiveCurrentPrice * shares
  const totalReturn = currentValue + dividends - adjustedCostBasis
  const roiPct = adjustedCostBasis > 0 ? (totalReturn / adjustedCostBasis) * 100 : 0
  const breakEven = shares > 0 ? (adjustedCostBasis - dividends) / shares : 0

  return { adjustedCostBasis, currentValue, totalReturn, roiPct, breakEven, effectiveCurrentPrice }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /home/idoga/portfolio-tracker && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: All `calculateHoldingMetrics` tests PASS. Existing tests should still pass.

- [ ] **Step 5: Commit**

```bash
cd /home/idoga/portfolio-tracker && git add src/utils.js src/test/utils.test.js && git commit -m "feat: add calculateHoldingMetrics with TASE Agurot conversion"
```

---

### Task 2: Extend holding data model and update `AddStockForm`

**Files:**
- Modify: `src/App.jsx` (AddStockForm component and holdings state initialization)

The new holding shape is:
```js
{
  symbol: string,
  shares: number,       // decimal supported
  purchasePrice: number, // per-unit price (Agurot for .TA, USD for US stocks)
  fees: number,          // total transaction fees, default 0
  dividends: number,     // total dividends/staking income, default 0
  purchaseDate: string,  // ISO date string e.g. "2024-01-15", default ''
}
```

Old holdings stored in localStorage have `avgPrice` instead of `purchasePrice` and lack `fees`, `dividends`, `purchaseDate`. The `loadHoldings` function must migrate these gracefully.

- [ ] **Step 1: Update `loadHoldings` in utils.js to migrate old data**

In `src/utils.js`, replace the existing `loadHoldings` function with:

```js
export function loadHoldings() {
  try {
    const raw = localStorage.getItem('mystock_holdings')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return parsed.map(h => ({
      symbol: h.symbol,
      shares: h.shares,
      purchasePrice: h.purchasePrice ?? h.avgPrice ?? 0,
      fees: h.fees ?? 0,
      dividends: h.dividends ?? 0,
      purchaseDate: h.purchaseDate ?? '',
    }))
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Locate the `AddStockForm` component in App.jsx**

The form is inside `src/App.jsx`. Find the `AddStockForm` function. It currently has state for `symbol`, `shares`, and `avgPrice`. Replace the entire `AddStockForm` function with:

```jsx
function AddStockForm({ onAdd }) {
  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [fees, setFees] = useState('')
  const [dividends, setDividends] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [error, setError] = useState('')

  const isTASE = symbol.toUpperCase().endsWith('.TA')

  function handleSubmit(e) {
    e.preventDefault()
    const sym = symbol.trim().toUpperCase()
    if (!sym) return setError('Ticker is required')
    const qty = parseFloat(shares)
    if (!qty || qty <= 0) return setError('Enter a valid quantity')
    const price = parseFloat(purchasePrice) || 0
    const feesVal = parseFloat(fees) || 0
    const divsVal = parseFloat(dividends) || 0
    setError('')
    onAdd({
      symbol: sym,
      shares: qty,
      purchasePrice: price,
      fees: feesVal,
      dividends: divsVal,
      purchaseDate: purchaseDate || '',
    })
    setSymbol('')
    setShares('')
    setPurchasePrice('')
    setFees('')
    setDividends('')
    setPurchaseDate('')
  }

  return (
    <form onSubmit={handleSubmit} className="glass-form rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Add Holding</h2>
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Ticker</label>
          <input
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="AAPL / ELBT.TA"
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Quantity</label>
          <input
            type="number"
            min="0"
            step="any"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="10.5"
            value={shares}
            onChange={e => setShares(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Purchase Price {isTASE ? '(Agurot)' : '(USD)'}
          </label>
          <input
            type="number"
            min="0"
            step="any"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder={isTASE ? 'e.g. 15000 ag' : 'e.g. 150.00'}
            value={purchasePrice}
            onChange={e => setPurchasePrice(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Fees (total)</label>
          <input
            type="number"
            min="0"
            step="any"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="0.00"
            value={fees}
            onChange={e => setFees(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Dividends / Staking</label>
          <input
            type="number"
            min="0"
            step="any"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="0.00"
            value={dividends}
            onChange={e => setDividends(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Purchase Date</label>
          <input
            type="date"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            value={purchaseDate}
            onChange={e => setPurchaseDate(e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
      >
        Add Holding
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Update `onAdd` handler in the main `App` component**

In `App.jsx`, find the function passed as `onAdd` to `AddStockForm`. It currently looks like:
```js
function addHolding(holding) {
  const updated = [...holdings, holding]
  setHoldings(updated)
  saveHoldings(updated)
}
```

That function does NOT need to change — it already just appends whatever object it receives. Verify it looks like the above. If it already appends the object as-is, no edit is needed here.

- [ ] **Step 4: Start dev server and verify form renders**

```bash
cd /home/idoga/portfolio-tracker && npm run dev
```

Open the browser. Verify the "Add Holding" form shows six fields: Ticker, Quantity, Purchase Price, Fees, Dividends/Staking, Purchase Date. Check that when you type a `.TA` symbol, the Purchase Price label changes to show "(Agurot)".

- [ ] **Step 5: Commit**

```bash
cd /home/idoga/portfolio-tracker && git add src/App.jsx src/utils.js && git commit -m "feat: extend holding form with purchase price, fees, dividends, date"
```

---

### Task 3: Display holding metrics in `StockCard`

**Files:**
- Modify: `src/App.jsx` (StockCard component)

`StockCard` currently receives `{ holding, price, exchangeRate, onDelete }`.

`price` is the object from `priceMap[symbol]` — shape `{ regularMarketPrice, regularMarketChangePercent, longName }`.

We will call `calculateHoldingMetrics(holding, price.regularMarketPrice)` inside StockCard to get the derived values, then display them.

- [ ] **Step 1: Import `calculateHoldingMetrics` at the top of App.jsx**

Find the existing import line from utils:
```js
import { isILStock, formatCurrency, calculateTotals, loadHoldings, saveHoldings, loadPricesCache, savePricesCache } from './utils.js'
```

Add `calculateHoldingMetrics` to it:
```js
import { isILStock, formatCurrency, calculateTotals, loadHoldings, saveHoldings, loadPricesCache, savePricesCache, calculateHoldingMetrics } from './utils.js'
```

- [ ] **Step 2: Replace the `StockCard` function with the updated version**

Find the existing `StockCard` function in `App.jsx` and replace it entirely with:

```jsx
function StockCard({ holding, price, exchangeRate, onDelete }) {
  const { symbol, shares, purchaseDate } = holding
  const isIL = isILStock(symbol)

  const currentApiPrice = price?.regularMarketPrice ?? 0
  const changePercent = price?.regularMarketChangePercent ?? 0
  const companyName = price?.longName ?? symbol

  const metrics = price
    ? calculateHoldingMetrics(holding, currentApiPrice)
    : null

  const displayPrice = metrics
    ? formatCurrency(metrics.effectiveCurrentPrice, isIL ? 'ILS' : 'USD')
    : '—'

  const displayValue = metrics
    ? formatCurrency(isIL ? metrics.currentValue : metrics.currentValue, isIL ? 'ILS' : 'USD')
    : '—'

  const displayCostBasis = metrics
    ? formatCurrency(metrics.adjustedCostBasis, isIL ? 'ILS' : 'USD')
    : '—'

  const displayReturn = metrics
    ? formatCurrency(Math.abs(metrics.totalReturn), isIL ? 'ILS' : 'USD')
    : '—'

  const displayBreakEven = metrics
    ? formatCurrency(metrics.breakEven, isIL ? 'ILS' : 'USD')
    : '—'

  const roiPct = metrics?.roiPct ?? 0
  const totalReturn = metrics?.totalReturn ?? 0
  const isPositive = totalReturn >= 0
  const isDayPositive = changePercent >= 0

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${isIL ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
            {symbol}
          </span>
          <span className="text-sm text-slate-300 truncate">{companyName}</span>
        </div>
        <button
          onClick={() => onDelete(symbol)}
          className="text-slate-500 hover:text-red-400 transition-colors shrink-0 text-lg leading-none"
          aria-label="Remove holding"
        >
          ×
        </button>
      </div>

      {/* Price + daily change */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-white font-semibold">{displayPrice}</span>
        <span className={`font-medium ${isDayPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isDayPositive ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}% today
        </span>
      </div>

      {/* Shares + date */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{shares} shares</span>
        {purchaseDate && <span>Since {purchaseDate}</span>}
      </div>

      {/* Metrics grid */}
      {metrics && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
          <div>
            <p className="text-xs text-slate-500">Cost Basis</p>
            <p className="text-sm text-slate-200">{displayCostBasis}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Current Value</p>
            <p className="text-sm text-slate-200">{displayValue}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Return</p>
            <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : '-'}{displayReturn}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">ROI</p>
            <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{roiPct.toFixed(2)}%
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-500">Break-even Price</p>
            <p className="text-sm text-slate-200">{displayBreakEven}</p>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

The dev server should still be running (`npm run dev`). Open the app. Add a test holding (e.g., AAPL, 10 shares, $150 purchase price, $5 fees, $20 dividends, any date). After the price fetches, verify the card shows:
- Current price and daily % change
- Shares count + purchase date
- Cost Basis, Current Value, Total Return (colored), ROI%, Break-even Price

Test a TASE stock (e.g., TEVA.TA): enter purchase price in Agurot (e.g., 15000). Verify the card shows values in Shekels (divided by 100).

- [ ] **Step 4: Commit**

```bash
cd /home/idoga/portfolio-tracker && git add src/App.jsx && git commit -m "feat: show cost basis, return, ROI, break-even in StockCard"
```

---

### Task 4: Push to GitHub and deploy

- [ ] **Step 1: Push to trigger GitHub Actions deployment**

```bash
cd /home/idoga/portfolio-tracker && git push origin main
```

Expected output ends with `main -> main`.

- [ ] **Step 2: Verify deployment**

Wait ~2 minutes, then open:
`https://idogal0210-web.github.io/portfolio-tracker/`

Verify the new form and metric cards appear in production.

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|-------------|-----------|
| Ticker input | Task 2 - AddStockForm |
| Quantity with decimal support | Task 2 - `step="any"` on input, `parseFloat` |
| Purchase Price input | Task 2 - AddStockForm |
| Fees input | Task 2 - AddStockForm |
| Dividends/Staking input | Task 2 - AddStockForm |
| Purchase Date input | Task 2 - AddStockForm |
| .TA Agurot÷100 for API price | Task 1 - `calculateHoldingMetrics` |
| .TA Agurot÷100 for input price | Task 1 - `calculateHoldingMetrics` |
| Adjusted Cost Basis = (price×qty)+fees | Task 1 - formula + tests |
| Current Value = price×qty | Task 1 - formula + tests |
| Total Return = value+dividends-costBasis | Task 1 - formula + tests |
| ROI% = (totalReturn/costBasis)×100 | Task 1 - formula + tests |
| Break-even = (costBasis-dividends)/qty | Task 1 - formula + tests |
| Display metrics on card | Task 3 - StockCard |
| Backward compat with old holdings | Task 2 - `loadHoldings` migration |

All requirements covered. No placeholders. Type signatures consistent across tasks.
