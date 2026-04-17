import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { isILStock, formatCurrency, calculateTotals, loadHoldings, saveHoldings, loadPricesCache, savePricesCache } from './utils'
import { fetchPrices } from './api'

// ─── StockCard ────────────────────────────────────────────────────────────────
function StockCard({ holding, priceData, onDelete }) {
  const il = isILStock(holding.symbol)
  const currency = il ? 'ILS' : 'USD'
  const ticker = holding.symbol.replace('.TA', '').replace('.ta', '')

  const price = priceData?.regularMarketPrice ?? null
  const changePct = priceData?.regularMarketChangePercent ?? null
  const companyName = priceData?.longName ?? holding.symbol
  const totalValue = price !== null ? holding.shares * price : null
  const isUp = changePct !== null && changePct >= 0

  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-[9px] font-black tracking-tight ${
            il
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
          }`}
        >
          {ticker.length > 4 ? ticker.slice(0, 4) : ticker}
        </div>
        <div>
          <div className="text-sm font-bold text-slate-100 leading-tight">
            {companyName.length > 22 ? companyName.slice(0, 22) + '…' : companyName}
            {il && <span className="ml-1 text-[10px]">🇮🇱</span>}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {holding.shares} shares
            {price !== null && ` · ${il ? '₪' : '$'}${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-sm font-bold text-slate-100">
            {totalValue !== null ? formatCurrency(totalValue, currency) : '—'}
          </div>
          {changePct !== null && (
            <div className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {isUp ? '+' : ''}{changePct.toFixed(2)}%
            </div>
          )}
        </div>
        <button
          onClick={() => onDelete(holding.symbol)}
          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          aria-label={`Remove ${holding.symbol}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── PortfolioHeader ──────────────────────────────────────────────────────────
function PortfolioHeader({ holdings, prices, exchangeRate, totalCurrency, onToggleCurrency }) {
  const { totalUSD, totalILS, usPct, ilPct, gainUSD } = calculateTotals(holdings, prices, exchangeRate)

  const displayTotal = totalCurrency === 'ILS'
    ? formatCurrency(totalILS, 'ILS')
    : formatCurrency(totalUSD, 'USD')

  const toggleLabel = totalCurrency === 'ILS'
    ? `↔ ${formatCurrency(totalUSD, 'USD')}`
    : `↔ ${formatCurrency(totalILS, 'ILS')}`

  const gainLabel = gainUSD >= 0
    ? `+${formatCurrency(gainUSD, 'USD')} today`
    : `${formatCurrency(gainUSD, 'USD')} today`

  const isGainPositive = gainUSD >= 0

  return (
    <div className="glass-hero rounded-3xl px-5 py-5 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-indigo-500/10 pointer-events-none" />

      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
        Total Portfolio Value
      </p>

      <p className="gradient-total text-4xl font-black leading-none mb-2">
        {holdings.length === 0 ? (totalCurrency === 'ILS' ? '₪0' : '$0') : displayTotal}
      </p>

      <div className="flex items-center gap-2 mb-4">
        <span
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
            isGainPositive
              ? 'bg-green-400/10 text-green-400 border-green-400/20'
              : 'bg-red-400/10 text-red-400 border-red-400/20'
          }`}
        >
          {holdings.length === 0 ? 'No holdings yet' : gainLabel}
        </span>
        {holdings.length > 0 && (
          <button
            onClick={onToggleCurrency}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-400/10 text-indigo-300 border border-indigo-400/20 active:opacity-70 transition-opacity"
          >
            {toggleLabel}
          </button>
        )}
      </div>

      {holdings.length > 0 && (
        <>
          <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-1.5">
            Market Exposure
          </p>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden flex mb-1.5">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500"
              style={{ width: `${usPct}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
              style={{ width: `${ilPct}%` }}
            />
          </div>
          <div className="flex gap-3">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="text-indigo-400">●</span> US {usPct.toFixed(0)}%
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="text-emerald-400">●</span> IL {ilPct.toFixed(0)}%
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── AddStockForm ─────────────────────────────────────────────────────────────
function AddStockForm({ onAdd }) {
  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('')
  const [avgPrice, setAvgPrice] = useState('')
  const [error, setError] = useState('')

  const il = isILStock(ticker)
  const trimmedTicker = ticker.trim().toUpperCase()

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!trimmedTicker) return setError('Enter a ticker symbol.')
    if (!shares || Number(shares) <= 0) return setError('Enter a valid number of shares.')

    onAdd({
      symbol: trimmedTicker,
      shares: Number(shares),
      avgPrice: avgPrice ? Number(avgPrice) : 0,
    })

    setTicker('')
    setShares('')
    setAvgPrice('')
  }

  return (
    <div className="glass-form rounded-2xl p-4">
      <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-3">
        Add Stock
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
            Ticker Symbol
          </label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="AAPL or TEVA.TA"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          <p className="text-[10px] text-slate-600 mt-1">
            Add <span className="text-slate-400">.TA</span> suffix for Tel Aviv stocks (e.g. TEVA.TA)
          </p>
        </div>

        {trimmedTicker.length >= 2 && (
          <div
            className={`text-[10px] px-3 py-2 rounded-lg border font-medium ${
              il
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
            }`}
          >
            {il ? '🇮🇱 Tel Aviv Stock Exchange — prices in ₪' : '🇺🇸 US Exchange — prices in $'}
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
              Shares
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="100"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
              Avg. Price <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={avgPrice}
              onChange={(e) => setAvgPrice(e.target.value)}
              placeholder={il ? '₪85' : '$150'}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>

        {error && (
          <p className="text-[11px] text-red-400">{error}</p>
        )}

        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl text-sm font-bold text-white active:opacity-80 transition-opacity"
        >
          Add to Portfolio
        </button>
      </form>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const mockHoldings = [
    { symbol: 'AAPL', shares: 10, avgPrice: 180 },
    { symbol: 'TEVA.TA', shares: 50, avgPrice: 85 },
  ]
  const mockPrices = {
    AAPL: { regularMarketPrice: 190, regularMarketChangePercent: 1.2, longName: 'Apple Inc.' },
    'TEVA.TA': { regularMarketPrice: 91, regularMarketChangePercent: -0.8, longName: 'Teva Pharmaceutical' },
  }
  const [currency, setCurrency] = useState('USD')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-md mx-auto px-4 pb-10">
        <div className="flex items-center justify-between py-4">
          <h1 className="gradient-text text-2xl font-black">MyStock</h1>
          <button className="w-9 h-9 flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300">
            <RefreshCw size={15} />
          </button>
        </div>
        <PortfolioHeader
          holdings={mockHoldings}
          prices={mockPrices}
          exchangeRate={3.7}
          totalCurrency={currency}
          onToggleCurrency={() => setCurrency(c => c === 'USD' ? 'ILS' : 'USD')}
        />
        <div className="mt-4 space-y-2">
          {mockHoldings.map(h => (
            <StockCard key={h.symbol} holding={h} priceData={mockPrices[h.symbol]} onDelete={() => {}} />
          ))}
        </div>
        <div className="my-4 h-px bg-white/5" />
        <AddStockForm onAdd={(h) => console.log('add', h)} />
      </div>
    </div>
  )
}
