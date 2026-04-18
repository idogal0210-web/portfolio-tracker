import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, RefreshCw, Wallet,
  PieChart, Plus, History, LayoutGrid,
  ArrowUpRight, UserCircle, Calendar,
  DollarSign, Tag, Hash, Coins, Banknote
} from 'lucide-react'
import {
  isILStock, formatCurrency, calculateTotals,
  loadHoldings, saveHoldings, loadPricesCache, savePricesCache,
  calculateHoldingMetrics
} from './utils'
import { fetchPrices } from './api'

// ─── TabItem ──────────────────────────────────────────────────────────────────
function TabItem({ icon, active = false }) {
  return (
    <button className={`p-2 flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'text-white' : 'text-white/20 hover:text-white/50'}`}>
      {icon}
      {active && <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_white]" />}
    </button>
  )
}

// ─── StockCard ────────────────────────────────────────────────────────────────
function StockCard({ holding, price, onDelete }) {
  if (!holding) return null
  const { symbol, shares } = holding
  const isIL = isILStock(symbol)
  const currency = isIL ? 'ILS' : 'USD'

  const currentApiPrice = price?.regularMarketPrice ?? 0
  const companyName = price?.longName ?? symbol

  const metrics = price ? calculateHoldingMetrics(holding, currentApiPrice) : null

  const displayValue = metrics ? formatCurrency(metrics.currentValue, currency) : '—'
  const roiPct = metrics?.roiPct ?? null
  const isPositive = (roiPct ?? 0) >= 0

  return (
    <div className="glass-card-small p-5 flex flex-col justify-between min-h-[150px] active:scale-95 transition-transform relative">
      <div>
        <div className="flex justify-between items-start mb-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isIL ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/10 border-white/10'}`}>
            <span className="text-[10px] font-black">{symbol[0]}</span>
          </div>
          <button
            onClick={() => onDelete(symbol)}
            className="text-white/20 hover:text-red-400 transition-colors text-lg leading-none"
            aria-label={`Remove ${symbol} from portfolio`}
          >
            ×
          </button>
        </div>
        <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${isIL ? 'text-emerald-400/60' : 'text-white/40'}`}>{symbol}</p>
        <p className="text-white/30 text-[9px] truncate mb-1">{companyName}</p>
        <h4 className="text-lg font-light tracking-tight">{displayValue}</h4>
      </div>
      <div className={`text-[10px] font-bold flex items-center gap-1 ${roiPct === null ? 'text-white/20' : isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
        {roiPct === null ? '—' : `${isPositive ? '+' : ''}${roiPct.toFixed(2)}%`}
        <span className="text-white/20 font-normal">· {shares} shares</span>
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
    <section className="mt-4 mb-8">
      <div className="glass-card p-7 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="flex items-center gap-2 mb-3">
          <Wallet size={14} className="text-white/60" />
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Total Net Worth</p>
        </div>

        <h2 className="text-4xl font-light tracking-tighter mb-4">
          {holdings.length === 0 ? (totalCurrency === 'ILS' ? '₪0' : '$0') : displayTotal}
        </h2>

        <div className="flex items-center gap-2 flex-wrap">
          {holdings.length === 0 ? (
            <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-white/5 text-white/30 border border-white/10">
              No holdings yet
            </span>
          ) : (
            <>
              <span className={`text-[10px] font-bold px-3 py-1 rounded-full border flex items-center gap-1 ${isGainPositive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                {isGainPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {gainLabel}
              </span>
              <button
                onClick={onToggleCurrency}
                className="text-[10px] font-bold px-3 py-1 rounded-full bg-white/5 text-white/40 border border-white/10 active:opacity-70 transition-opacity"
              >
                {toggleLabel}
              </button>
            </>
          )}
        </div>

        {holdings.length > 0 && (
          <div className="mt-5">
            <p className="text-[9px] text-white/20 uppercase tracking-widest mb-1.5">Market Exposure</p>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden flex mb-1.5">
              <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${usPct}%` }} />
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${ilPct}%` }} />
            </div>
            <div className="flex gap-3">
              <span className="text-[10px] text-white/30 flex items-center gap-1">
                <span className="text-indigo-400">●</span> US {usPct.toFixed(0)}%
              </span>
              <span className="text-[10px] text-white/30 flex items-center gap-1">
                <span className="text-emerald-400">●</span> IL {ilPct.toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
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
    setError('')
    onAdd({
      symbol: sym,
      shares: qty,
      purchasePrice: parseFloat(purchasePrice) || 0,
      fees: parseFloat(fees) || 0,
      dividends: parseFloat(dividends) || 0,
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
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-5">
        <Plus size={18} className="text-white/80" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-white/80">Add New Holding</h3>
      </div>

      <form onSubmit={handleSubmit} className="glass-form p-6 space-y-5">
        {error && <p className="text-rose-400 text-xs px-1">{error}</p>}

        <div className="space-y-2">
          <label className="text-white/40 text-[10px] font-bold uppercase ml-1 flex items-center gap-2">
            <Tag size={12} /> Ticker Symbol
          </label>
          <input
            className="w-full glass-input rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 transition-all placeholder:text-white/10"
            placeholder="e.g. AAPL or ELBT.TA"
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-white/40 text-[10px] font-bold uppercase ml-1 flex items-center gap-2">
              <Hash size={12} /> Quantity
            </label>
            <input
              type="number"
              min="0.0001"
              step="any"
              inputMode="decimal"
              placeholder="0.00"
              className="w-full glass-input rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 transition-all placeholder:text-white/10"
              value={shares}
              onChange={e => setShares(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-white/40 text-[10px] font-bold uppercase ml-1 flex items-center gap-2">
              <DollarSign size={12} /> {isTASE ? 'Price (Agorot)' : 'Price (USD)'}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder={isTASE ? 'e.g. 15000' : '0.00'}
              className="w-full glass-input rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 transition-all placeholder:text-white/10"
              value={purchasePrice}
              onChange={e => setPurchasePrice(e.target.value)}
            />
            {isTASE && <p className="text-[10px] text-white/20 ml-1">100 agorot = ₪1</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-white/40 text-[10px] font-bold uppercase ml-1 flex items-center gap-2">
              <Calendar size={12} /> Date
            </label>
            <input
              type="date"
              className="w-full glass-input rounded-2xl px-5 py-4 text-xs focus:outline-none focus:ring-1 focus:ring-white/20 transition-all text-white/40"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-white/40 text-[10px] font-bold uppercase ml-1 flex items-center gap-2">
              <Coins size={12} /> Rewards
            </label>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="0.00"
              className="w-full glass-input rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 transition-all placeholder:text-white/10"
              value={dividends}
              onChange={e => setDividends(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-white/40 text-[10px] font-bold uppercase ml-1 flex items-center gap-2">
            <Banknote size={12} /> Fees {isTASE ? '(ILS)' : '(USD)'}
          </label>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="0.00"
            className="w-full glass-input rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 transition-all placeholder:text-white/10"
            value={fees}
            onChange={e => setFees(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-white/90 text-black font-bold py-4 rounded-2xl text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2"
        >
          <Plus size={16} strokeWidth={3} /> Save Investment
        </button>
      </form>
    </section>
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
      const symbols = holdings.map(h => h.symbol)
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

  useEffect(() => { refresh() }, [refresh])

  const handleAdd = (holding) => {
    if (holdings.find(h => h.symbol === holding.symbol)) return
    const updated = [...holdings, holding]
    setHoldings(updated)
    saveHoldings(updated)
  }

  const handleDelete = (symbol) => {
    const updated = holdings.filter(h => h.symbol !== symbol)
    setHoldings(updated)
    saveHoldings(updated)
    setPrices(prev => { const next = { ...prev }; delete next[symbol]; return next })
  }

  return (
    <div className="flex justify-center bg-[#050505] min-h-screen relative overflow-hidden">

      {/* Background animated glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] right-[20%] w-[300px] h-[300px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[20%] left-[10%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[150px]" />
        <div className="absolute top-[50%] left-[40%] w-[250px] h-[250px] bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      {/* iPhone container */}
      <div className="w-[390px] min-h-screen bg-[#050505]/40 text-white relative flex flex-col border-x border-white/10">

        <div className="h-12" />

        {/* Header */}
        <header className="px-6 py-4 flex justify-between items-center relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <UserCircle size={16} className="text-white/50" />
              <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Welcome Back</p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">My Portfolio</h1>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="w-10 h-10 rounded-2xl glass-effect flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
            aria-label="Refresh prices"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto px-6 pb-40 no-scrollbar relative z-10">

          {stale && (
            <div className="mb-3 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-2xl px-4 py-2">
              ⚠ Could not fetch live prices — showing cached data.
            </div>
          )}

          <PortfolioHeader
            holdings={holdings}
            prices={prices}
            exchangeRate={exchangeRate}
            totalCurrency={totalCurrency}
            onToggleCurrency={() => setTotalCurrency(c => c === 'USD' ? 'ILS' : 'USD')}
          />

          <AddStockForm onAdd={handleAdd} />

          {holdings.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <LayoutGrid size={16} className="text-white/40" />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Asset Holdings</h3>
                </div>
                <p className="text-[10px] text-white/20">{holdings.length} stock{holdings.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {holdings.map(h => (
                  <StockCard
                    key={h.symbol}
                    holding={h}
                    price={prices[h.symbol] ?? null}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </>
          )}
        </main>

        {/* Bottom tab bar */}
        <div className="absolute bottom-6 left-6 right-6 z-20">
          <footer className="glass-nav px-8 py-4 flex justify-between items-center shadow-2xl">
            <TabItem icon={<LayoutGrid size={22} />} active />
            <TabItem icon={<PieChart size={22} />} />
            <div className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center shadow-2xl active:scale-90 transition-transform -translate-y-1">
              <Plus size={28} strokeWidth={2.5} />
            </div>
            <TabItem icon={<History size={22} />} />
            <TabItem icon={<UserCircle size={22} />} />
          </footer>
        </div>

      </div>
    </div>
  )
}
