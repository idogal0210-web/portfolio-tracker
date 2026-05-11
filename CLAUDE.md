# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: MyStock Portfolio Tracker

A personal stock portfolio tracking application supporting US stocks (via Yahoo Finance), Israeli TASE stocks (symbols ending in `.TA`), and cryptocurrency (ending in `-USD`). Built with React 19 + Vite + Tailwind CSS v4, deployed to GitHub Pages.

**Live:** https://idogal0210-web.github.io/portfolio-tracker

## Quick Commands

```bash
npm run dev        # Start Vite dev server (localhost:5173)
npm run build      # Production build → ./dist/
npm run preview    # Preview built dist locally
npm test           # Run Vitest suite (JSDOM env)
npm run test -- src/test/utils.test.js  # Run single test file
npm run lint       # ESLint check
```

## Architecture

### Data Flow
- **Holdings** (localStorage): `{ symbol, shares, purchasePrice, fees, dividends, purchaseDate }`. For TASE stocks, `purchasePrice` is in agorot (100 agorot = ₪1).
- **Prices** (localStorage + API): Fetched from `https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/get-profile`. Cached with 5-minute TTL to minimize API calls.
- **Exchange Rate** (localStorage): USD→ILS, cached, with fallback to 3.7 if API fails.

### Key Modules

**`src/utils.js`** — Core logic:
- `getMarket(symbol)` → 'IL' | 'US' | 'CRYPTO'
- `calculateTotals(holdings, prices, exchangeRate)` → aggregated portfolio value broken by market
- `calculateHoldingMetrics(holding, currentPrice)` → ROI%, gain/loss per holding
- `calculateAllTimeReturn()` → all-time return including dividends and fees
- `isILStock / isCrypto / displaySymbol` — market-specific helpers
- `loadHoldings / saveHoldings` — localStorage CRUD
- `loadPricesCache / savePricesCache` — price cache with TTL

**`src/api.js`** — External integrations:
- `fetchPrices(symbols, apiKey)` → returns `{ priceMap, exchangeRate }`
- Uses `VITE_RAPIDAPI_KEY` from env (GitHub secret: `RAPIDAPI_KEY`)

**`src/App.jsx`** — All UI:
- Single-file component with multiple sub-components: `PortfolioHeader`, `StockCard`, `AddStockForm`, `TabItem`, bottom tab nav
- State: `holdings`, `prices`, `exchangeRate`, `loading`, `error`, `stale`, `activeTab`, `currency`
- Fetches on mount and on "Refresh" button; marks stale after 5 minutes
- Deterministic sparkline & price history curves generated from symbol hash for pseudo-realistic charts

**`src/index.css`** — Dark glassmorphism design:
- Tailwind v4 with custom utilities: `.glass-card`, `.glass-input`, `.glass-form`, `.glass-nav`, `.glass-effect`, `.no-scrollbar`
- Fixed glow blobs (pointer-events-none), 390px centered iPhone-like container

### Testing
- **Vitest + jsdom** environment (setup in `vite.config.js`, `src/test/setup.js`)
- Focus: `utils.js` calculations (`calculateTotals`, `calculateHoldingMetrics`, etc.)
- **26 passing tests** covering market detection, currency formatting, holding metrics, portfolio aggregation

## Environment & Deployment

**`VITE_RAPIDAPI_KEY`**: Set in GitHub Actions secrets as `RAPIDAPI_KEY`. Required for price fetches; fallback handles API failures.

**Deployment**: `.github/workflows/deploy.yml` → on every push to `main`:
1. Build with Vite
2. Push dist/ to `gh-pages` branch
3. GitHub Pages serves from `gh-pages`

**Base URL**: `/portfolio-tracker/` (set in `vite.config.js`)

## Git & Commits

- **Push method**: SSH only (`git@github.com:idogal0210-web/portfolio-tracker.git`). HTTPS fails in this environment.
- **Before first push**: Verify remote with `git remote get-url origin`, set if needed.
- **Git config** (one-time per session):
  ```bash
  git config user.email "idogal0210@gmail.com"
  git config user.name "idogal0210-web"
  ```
- On merge, branches auto-delete (`deleteBranchOnMerge: true` in GitHub repo settings).

## Important Notes

1. **Market Detection**: Uses `.TA` suffix (Israeli), `-USD` suffix (crypto), or defaults to US. All logic flows from `getMarket()`.
2. **Agora Pricing**: TASE holdings use `purchasePrice` in agorot; divide by 100 when displaying in shekels. Backward-compatible with legacy `avgPrice` field.
3. **API Resilience**: If price fetch fails, portfolio displays cached prices; if exchange rate fails, uses 3.7 fallback. UI shows "Stale data" warning.
4. **LSB (Least Significant Bit)**: localStorage keys: `portfolio_holdings`, `portfolio_prices_cache`, `portfolio_exchange_rate`. No migrations yet; assume current schema.
5. **Component Consolidation**: All UI is in `App.jsx` intentionally; no separate component files. Keep components tightly coupled to the single-file structure when adding features.

## Copilot Skills

### component-preview
After every visual/UI change (add/modify component, update styles, layout changes):
1. Generate standalone `preview.html` in project root
2. Adapt React JSX to static HTML (`className` → `class`, remove event handlers)
3. Use Tailwind CDN, dark background (`#0f0f0f`), centered component
4. Open with `xdg-open preview.html`

**Triggers:** Any work on `src/components/`, `src/App.jsx`, `src/index.css`, or styling changes

