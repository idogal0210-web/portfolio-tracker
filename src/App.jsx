import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { isILStock, formatCurrency, calculateTotals, loadHoldings, saveHoldings, loadPricesCache, savePricesCache, calculateHoldingMetrics } from './utils'
import { fetchPrices } from './api'

// ─── StockCard ────────────────────────────────────────────────────────────────
function StockCard({ holding, price, onDelete }) {
  const { symbol, shares, purchaseDate } = holding
  const isIL = isILStock(symbol)
  const currency = isIL ? 'ILS' : 'USD'

  const currentApiPrice = price?.regularMarketPrice ?? 0
  const changePercent = price?.regularMarketChangePercent ?? 0
  const companyName = price?.longName ?? symbol

  const metrics = price ? calculateHoldingMetrics(holding, currentApiPrice) : null

  const displayPrice = metrics ? formatCurrency(metrics.effectiveCurrentPrice, currency) : '—'
  const displayValue = metrics ? formatCurrency(metrics.currentValue, currency) : '—'
  const displayCostBasis = metrics ? formatCurrency(metrics.adjustedCostBasis, currency) : '—'
  const displayReturn = metrics ? formatCurrency(Math.abs(metrics.totalReturn), currency) : '—'
  const displayBreakEven = metrics ? formatCurrency(metrics.breakEven, currency) : '—'

  const roiPct = metrics?.roiPct ?? 0
  const totalReturn = metrics?.totalReturn ?? 0
  const isPositive = totalReturn >= 0
  const isDayPositive = changePercent >= 0

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      {/* Header */}
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
      purchaseDate,
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
            min="0.0001"
            step="any"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="10.5"
            value={shares}
            onChange={e => setShares(e.target.value)}
            inputMode="decimal"
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
            placeholder={isTASE ? 'e.g. 15000 (agorot)' : 'e.g. 150.00'}
            value={purchasePrice}
            onChange={e => setPurchasePrice(e.target.value)}
            inputMode="decimal"
          />
          {isTASE && <p className="text-xs text-slate-500 mt-1">100 agorot = ₪1</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Fees {isTASE ? '(ILS)' : '(USD)'}
          </label>
          <input
            type="number"
            min="0"
            step="any"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder="0.00"
            value={fees}
            onChange={e => setFees(e.target.value)}
            inputMode="decimal"
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
            inputMode="decimal"
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

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [holdings, setHoldings] = useState(() => loadHoldings())
  const [prices, setPrices] = useState(() => loadPricesCache() ?? {})
  const [exchangeRate, setExchangeRate] = useState(3.7)
  const [loading, setLoading] = useState(false)
  const [stale, setStale] = useState(false)
  const [totalCurrency, setTotalCurrency] = useState('USD')

  const apiKey = import.meta.env.VITE_RAPIDAPI_KEY

  const refresh = useCallback(async () => {
    if (!holdings.length) return
    setLoading(true)
    setStale(false)
    try {
      const symbols = holdings.map((h) => h.symbol)
      const { priceMap, exchangeRate: rate } = await fetchPrices(symbols, apiKey)
      setPrices(priceMap)
      setExchangeRate(rate)
      savePricesCache(priceMap)
    } catch (err) {
      console.error('Price fetch failed:', err)
      setStale(true)
    } finally {
      setLoading(false)
    }
  }, [holdings, apiKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleAdd = (holding) => {
    const exists = holdings.find((h) => h.symbol === holding.symbol)
    if (exists) return
    const updated = [...holdings, holding]
    setHoldings(updated)
    saveHoldings(updated)
  }

  const handleDelete = (symbol) => {
    const updated = holdings.filter((h) => h.symbol !== symbol)
    setHoldings(updated)
    saveHoldings(updated)
    setPrices((prev) => {
      const next = { ...prev }
      delete next[symbol]
      return next
    })
  }

  const toggleCurrency = () => {
    setTotalCurrency((c) => (c === 'USD' ? 'ILS' : 'USD'))
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-md mx-auto px-4 pb-10">

        <div className="flex items-center justify-between py-4">
          <h1 className="gradient-text text-2xl font-black">MyStock</h1>
          <button
            onClick={refresh}
            disabled={loading}
            className="w-9 h-9 flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 disabled:opacity-40 transition-opacity"
            aria-label="Refresh prices"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {stale && (
          <div className="mb-3 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2">
            ⚠ Could not fetch live prices — showing cached data.
          </div>
        )}

        <PortfolioHeader
          holdings={holdings}
          prices={prices}
          exchangeRate={exchangeRate}
          totalCurrency={totalCurrency}
          onToggleCurrency={toggleCurrency}
        />

        {holdings.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold">
                My Holdings
              </p>
              <p className="text-[10px] text-slate-600">{holdings.length} stock{holdings.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="space-y-2">
              {holdings.map((h) => (
                <StockCard
                  key={h.symbol}
                  holding={h}
                  price={prices[h.symbol] ?? null}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}

        {holdings.length > 0 && (
          <div className="my-4 h-px bg-white/5" />
        )}

        <AddStockForm onAdd={handleAdd} />

      </div>
    </div>
  )
}
