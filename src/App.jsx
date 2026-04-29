import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  isCrypto, isILStock, getMarket, displaySymbol,
  formatCurrency, calculateTotals, calculateAllTimeReturn,
  loadHoldings, saveHoldings, loadPricesCache, savePricesCache,
  calculateHoldingMetrics,
  convertAmount, calculateMonthlyTotals, aggregateByCategory,
  groupTransactionsByDate, calculateMonthlyTrend, budgetProgress,
  materializeRecurring, toCSV, newId,
  loadTransactions, saveTransactions,
  loadBudgets, saveBudgets,
  loadRecurring, saveRecurring,
  INCOME_CATEGORIES, EXPENSE_CATEGORIES,
} from './utils'
import { callGemini } from './gemini'
import {
  fetchPrices, supabaseConfigured,
  getSession, signInWithPassword, signUp, signOut, onAuthChange,
  fetchHoldings, upsertHolding, deleteHoldingBySymbol, bulkUpsertHoldings,
  fetchTransactions, upsertTransaction, deleteTransaction, bulkInsertTransactions,
  fetchBudgets, upsertBudget, deleteBudget, bulkUpsertBudgets,
  fetchRecurring, upsertRecurring, deleteRecurring, bulkUpsertRecurring,
} from './api'

// ─── deterministic PRNG ───────────────────────────────────────────────────────
function makeRand(seed) {
  let s = seed
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

function sparklinePoints(seed, n = 40) {
  const rand = makeRand(seed)
  const pts = []
  let v = 100
  for (let i = 0; i < n; i++) {
    v += (rand() - 0.5) * 4
    pts.push(v)
  }
  return pts
}

function priceHistoryPoints(symbol, startPrice, endPrice, days = 90) {
  const seed = symbol.charCodeAt(0) * 73 + symbol.length * 13
  const rand = makeRand(seed)
  const raw = []
  let v = 1
  for (let i = 0; i < days; i++) {
    v += (rand() - 0.5) * 0.04
    raw.push(v)
  }
  const lo = raw[0], hi = raw[raw.length - 1]
  return raw.map(r => {
    const t = (r - lo) / ((hi - lo) || 1)
    return startPrice + t * (endPrice - startPrice)
  })
}

function buildPortfolioReturnCurve(enriched, exchangeRate, numPts = 90) {
  const now = Date.now()
  const withDates = enriched
    .filter(h => h._holding.purchaseDate && h._metrics)
    .sort((a, b) => new Date(a._holding.purchaseDate) - new Date(b._holding.purchaseDate))

  if (!withDates.length) return sparklinePoints(42, numPts)

  const oldestDate = new Date(withDates[0]._holding.purchaseDate).getTime()
  const span = now - oldestDate || 1

  return Array.from({ length: numPts }, (_, i) => {
    const pointTime = oldestDate + (i / (numPts - 1)) * span
    let total = 0
    for (const h of withDates) {
      const t0 = new Date(h._holding.purchaseDate).getTime()
      if (t0 > pointTime) continue
      const progress = Math.min((pointTime - t0) / (now - t0 || 1), 1)
      const factor = h.market === 'IL' ? 1 / exchangeRate : 1
      total += (h._metrics.adjustedCostBasis + progress * (h._metrics.currentValue - h._metrics.adjustedCostBasis)) * factor
    }
    return total
  })
}

// ─── logo ─────────────────────────────────────────────────────────────────────
const LOGO_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#f97316','#14b8a6']

const CRYPTO_COLORS = {
  BTC:  '#f7931a',
  ETH:  '#8b5cf6',
  SOL:  '#d946ef',
  ADA:  '#3468dc',
  DOGE: '#c2a633',
  XRP:  '#00a4d3',
}

const SECTOR_MAP = {
  AAPL:'Tech', MSFT:'Tech', GOOGL:'Tech', GOOG:'Tech', META:'Tech', NVDA:'Tech',
  TSLA:'Tech', AMZN:'Tech', NFLX:'Tech', AMD:'Tech', CRM:'Tech', ORCL:'Tech',
  ADBE:'Tech', INTC:'Tech', QCOM:'Tech', UBER:'Tech', LYFT:'Tech', SNAP:'Tech',
  JPM:'Finance', BAC:'Finance', GS:'Finance', V:'Finance', MA:'Finance',
  WFC:'Finance', MS:'Finance', AXP:'Finance', BLK:'Finance', C:'Finance',
  XOM:'Energy', CVX:'Energy', COP:'Energy', SLB:'Energy', BP:'Energy',
  JNJ:'Healthcare', PFE:'Healthcare', UNH:'Healthcare', MRNA:'Healthcare',
  ABBV:'Healthcare', LLY:'Healthcare', BMY:'Healthcare', MRK:'Healthcare',
  WMT:'Consumer', HD:'Consumer', MCD:'Consumer', KO:'Consumer', PEP:'Consumer',
  COST:'Consumer', NKE:'Consumer', SBUX:'Consumer', TGT:'Consumer',
  SPY:'Index', QQQ:'Index', VTI:'Index', VOO:'Index', IWM:'Index', GLD:'Index',
}

const SECTOR_COLORS = {
  Tech:'#6366f1', Finance:'#22c55e', Energy:'#f59e0b', Healthcare:'#ec4899',
  Consumer:'#06b6d4', Index:'#8b5cf6', Crypto:'#f97316', IL:'#3b82f6', Other:'rgba(255,255,255,0.25)',
}

function generateLogo(ticker) {
  const base = displaySymbol(ticker).replace('.TA', '').toUpperCase()
  if (isCrypto(ticker) && CRYPTO_COLORS[base]) {
    return { bg: CRYPTO_COLORS[base], char: base[0] }
  }
  return { bg: LOGO_COLORS[base.charCodeAt(0) % LOGO_COLORS.length], char: base[0] }
}

// ─── SVG primitives ───────────────────────────────────────────────────────────
function Logo({ ticker, size = 40 }) {
  const { bg, char } = generateLogo(ticker)
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.42 }}>
      {char}
    </div>
  )
}

function Sparkline({ data, color = '#22c55e', width = 52, height = 24 }) {
  if (!data?.length) return <div style={{ width, height }} />
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / range) * height
  ])
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PriceChart({ data, color = '#22c55e', width = 360, height = 120, formatValue }) {
  const [tooltip, setTooltip] = useState(null)
  useEffect(() => setTooltip(null), [data])

  if (!data?.length) return <div style={{ width, height }} />
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pad = 6
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    pad + (1 - (v - min) / range) * (height - pad * 2)
  ])
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i]
    const mx = (px + cx) / 2
    d += ` Q${px.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${((py + cy) / 2).toFixed(1)} T${cx.toFixed(1)} ${cy.toFixed(1)}`
  }
  const area = `${d} L${width} ${height} L0 ${height} Z`
  const id = `pc${color.replace(/[^a-z0-9]/gi, '')}`

  const fmt = formatValue ?? (v => `$${v < 1 ? v.toFixed(4) : v.toFixed(2)}`)

  const handleMove = (e) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const relX = Math.max(0, Math.min(clientX - rect.left, width))
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((relX / width) * (data.length - 1))))
    setTooltip({ x: pts[idx][0], y: pts[idx][1], value: data[idx] })
  }

  const tipW = 82
  const tipH = 26
  const tipX = tooltip ? Math.max(4, Math.min(tooltip.x - tipW / 2, width - tipW - 4)) : 0
  const tipY = tooltip ? (tooltip.y < 44 ? tooltip.y + 10 : tooltip.y - tipH - 8) : 0

  return (
    <svg width={width} height={height} style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
      onMouseMove={handleMove} onMouseLeave={() => setTooltip(null)}
      onTouchMove={handleMove} onTouchEnd={() => setTooltip(null)}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {tooltip && (
        <>
          <line x1={tooltip.x.toFixed(1)} y1={0} x2={tooltip.x.toFixed(1)} y2={height}
            stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="4,3" />
          <circle cx={tooltip.x.toFixed(1)} cy={tooltip.y.toFixed(1)} r={4.5}
            fill={color} stroke="#000" strokeWidth="2" />
          <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={8}
            fill="rgba(10,10,15,0.88)" stroke={`${color}55`} strokeWidth="1" />
          <text x={tipX + tipW / 2} y={tipY + 17} fill="white" fontSize={11} fontWeight="700"
            textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif">
            {fmt(tooltip.value)}
          </text>
        </>
      )}
    </svg>
  )
}

// ─── market badge ─────────────────────────────────────────────────────────────
function MarketBadge({ market }) {
  const styles = {
    IL: 'bg-blue-500/15 text-blue-400',
    US: 'bg-white/8 text-white/55',
    CRYPTO: 'bg-orange-500/15 text-orange-400',
  }
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${styles[market] ?? styles.US}`}>
      {market}
    </span>
  )
}

// ─── AllocationBar ────────────────────────────────────────────────────────────
function AllocationBar({ slices }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  return (
    <div className="flex w-full h-2 rounded-full overflow-hidden bg-white/5">
      {slices.map((s, i) => (
        <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
      ))}
    </div>
  )
}

// ─── HoldingRow ───────────────────────────────────────────────────────────────
function HoldingRow({ h, onClick }) {
  const currency = h.market === 'IL' ? 'ILS' : 'USD'
  const metrics = h._metrics
  const spark = useMemo(() => sparklinePoints(h.ticker.charCodeAt(0) * 7 + h.ticker.length * 3), [h.ticker])
  const pl = metrics ? metrics.totalReturn : 0
  const isUp = pl >= 0
  const sparkColor = isUp ? '#22c55e' : '#ef4444'
  const dayColor = h.dayChange > 0 ? '#22c55e' : h.dayChange < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)'
  const display = displaySymbol(h.ticker)

  return (
    <div onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/3 active:bg-white/5">
      <div style={{ padding: 2, borderRadius: '50%', border: '1px solid rgba(212,175,55,0.3)', display: 'inline-flex' }}>
        <Logo ticker={h.ticker} size={36} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-semibold text-[15px] tracking-tight">{display}</span>
          <MarketBadge market={h.market} />
        </div>
        <div className="text-[12px] mt-0.5 truncate" style={{ color: '#71717a' }}>
          {h.qty < 1 ? h.qty.toFixed(4) : h.qty.toLocaleString()} · {h.name}
        </div>
      </div>
      <Sparkline data={spark} color={sparkColor} width={52} height={22} />
      <div className="text-right min-w-[78px]">
        <div className="text-white font-semibold text-[14px] tabular-nums tracking-tight">
          {metrics ? formatCurrency(metrics.currentValue, currency) : '—'}
        </div>
        <div className="text-[12px] font-medium mt-0.5 tabular-nums" style={{ color: dayColor }}>
          {h.dayChange === 0 ? '0.00%' : `${h.dayChange > 0 ? '+' : ''}${h.dayChange.toFixed(2)}%`}
        </div>
      </div>
    </div>
  )
}

// ─── HoldingDetail ────────────────────────────────────────────────────────────
function HoldingDetail({ h, onBack, onDelete, apiKey }) {
  const [range, setRange] = useState('1M')
  const isIL = h.market === 'IL'
  const currency = isIL ? 'ILS' : 'USD'
  const metrics = h._metrics
  const ranges = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

  const startPrice = h._holding.purchasePrice
    ? (isIL ? h._holding.purchasePrice / 100 : h._holding.purchasePrice)
    : (metrics?.effectiveCurrentPrice ?? 0) * 0.85
  const endPrice = metrics?.effectiveCurrentPrice ?? 0

  const syntheticData = useMemo(
    () => priceHistoryPoints(h.ticker, startPrice, endPrice, 90),
    [h.ticker, startPrice, endPrice]
  )
  const [chartData, setChartData] = useState(syntheticData)

  useEffect(() => {
    if (!apiKey) return
    fetchHistory(h.ticker, range, apiKey)
      .then(data => { if (data.length >= 2) setChartData(data) })
      .catch(() => {})
  }, [h.ticker, range, apiKey])

  const isUp = (metrics?.totalReturn ?? 0) >= 0
  const accent = isUp ? '#22c55e' : '#ef4444'
  const dayColor = h.dayChange > 0 ? '#22c55e' : h.dayChange < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)'

  return (
    <div className="absolute inset-0 bg-black text-white overflow-auto z-20" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 48px)' }}>
      {/* Sticky nav */}
      <div className="sticky top-0 z-10 px-4 pb-3 flex items-center gap-3"
        style={{
          background: 'linear-gradient(180deg,#000 60%,rgba(0,0,0,0))',
          paddingTop: 'calc(env(safe-area-inset-top) + 20px)',
        }}>
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl border border-white/8 bg-white/4 flex items-center justify-center shrink-0">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M8 2L2 9l6 7" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Logo ticker={h.ticker} size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold tracking-tight">{displaySymbol(h.ticker)}</div>
          <div className="text-[10px] text-white/45">{h.name}</div>
        </div>
      </div>

      <div className="px-5">
        {/* Price */}
        <div className="mt-1">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-white/45">Current price</div>
          <div className="flex items-baseline gap-3 mt-1">
            <div className="text-[40px] font-bold tracking-tight tabular-nums leading-none">
              {metrics ? formatCurrency(metrics.effectiveCurrentPrice, currency) : '—'}
            </div>
            <div className="text-[15px] font-semibold tabular-nums" style={{ color: dayColor }}>
              {h.dayChange === 0 ? '0.00%' : `${h.dayChange > 0 ? '+' : ''}${h.dayChange.toFixed(2)}%`}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="mt-4 -mx-5">
          <PriceChart data={chartData} color={accent} width={390} height={160}
            formatValue={v => formatCurrency(isIL ? v / 100 : v, currency)} />
        </div>

        {/* Range tabs */}
        <div className="flex gap-1 mt-2 p-1 rounded-xl bg-white/4">
          {ranges.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
              style={range === r ? { background: 'rgba(212,175,55,0.15)', color: '#D4AF37' } : { color: 'rgba(255,255,255,0.4)' }}>
              {r}
            </button>
          ))}
        </div>

        {/* Position card */}
        <div className="mt-5 p-4 rounded-[18px] bg-white/4 border border-white/5">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-[12px] text-white/45">Market value</span>
            <span className="text-[22px] font-bold tracking-tight tabular-nums">
              {metrics ? formatCurrency(metrics.currentValue, currency) : '—'}
            </span>
          </div>
          <div className="h-px bg-white/5 -mx-4 mb-3" />
          <div className="grid grid-cols-2 gap-3">
            <DetailStat label="Quantity" value={h.qty < 1 ? h.qty.toFixed(4) : h.qty.toLocaleString()} />
            <DetailStat label="Avg cost"
              value={metrics ? formatCurrencyPrecise(
                isIL ? h._holding.purchasePrice / 100 : h._holding.purchasePrice, currency
              ) : '—'} />
            <DetailStat label="Total gain"
              value={metrics ? `${metrics.totalReturn >= 0 ? '+' : ''}${formatCurrency(metrics.totalReturn, currency)}` : '—'}
              color={accent} />
            <DetailStat label="ROI"
              value={metrics ? `${metrics.roiPct >= 0 ? '+' : ''}${metrics.roiPct.toFixed(2)}%` : '—'}
              color={accent} />
            <DetailStat label="Cost basis"
              value={metrics ? formatCurrency(metrics.adjustedCostBasis, currency) : '—'} />
            <DetailStat label="Break-even"
              value={metrics ? formatCurrencyPrecise(metrics.breakEven, currency) : '—'} />
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => {
            if (confirm(`Remove ${displaySymbol(h.ticker)} from your portfolio?`)) {
              onDelete(h.ticker)
              onBack()
            }
          }}
          className="w-full h-[48px] mt-5 rounded-2xl font-bold text-[14px] tracking-tight border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/15 transition-colors">
          Remove holding
        </button>

        {/* Transactions */}
        {h._holding.purchaseDate || h._holding.purchasePrice ? (
          <div className="mt-5">
            <div className="text-[11px] font-semibold tracking-widest uppercase text-white/45 mb-2">Transactions</div>
            <div className="rounded-[18px] overflow-hidden bg-white/3 border border-white/5">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-[10px] font-bold shrink-0">BUY</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">
                    {h.qty < 1 ? h.qty.toFixed(4) : h.qty} @ {metrics ? formatCurrency(
                      isIL ? (h._holding.purchasePrice / 100) : h._holding.purchasePrice, currency
                    ) : '—'}
                  </div>
                  {h._holding.purchaseDate && (
                    <div className="text-[11px] text-white/45 mt-0.5">
                      {new Date(h._holding.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </div>
                  )}
                </div>
                {metrics && (
                  <div className="text-[13px] font-semibold tabular-nums shrink-0">
                    {formatCurrency(metrics.adjustedCostBasis, currency)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

    </div>
  )
}

function DetailStat({ label, value, color }) {
  return (
    <div>
      <div className="text-[11px] text-white/45 font-medium mb-0.5">{label}</div>
      <div className="text-[16px] font-semibold tabular-nums tracking-tight" style={{ color: color ?? '#fff' }}>{value}</div>
    </div>
  )
}

// ─── AddHoldingSheet ──────────────────────────────────────────────────────────
function AddHoldingSheet({ onClose, onAdd }) {
  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [fees, setFees] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [error, setError] = useState('')

  const sym = symbol.trim().toUpperCase()
  const isTASE = isILStock(sym)
  const isCryptoSym = isCrypto(sym)
  const marketType = isTASE ? 'IL' : isCryptoSym ? 'CRYPTO' : 'US'
  const marketLabel = isTASE ? 'Israeli stock (TASE)' : isCryptoSym ? 'Cryptocurrency' : 'US stock'
  const marketColor = isTASE ? '#6366f1' : isCryptoSym ? '#f59e0b' : 'rgba(255,255,255,0.35)'
  const priceCurrency = isTASE ? 'ILS' : 'USD'
  const priceLabel = isTASE ? 'Price (agorot)' : isCryptoSym ? 'Price (USD)' : 'Price (USD)'
  const feesLabel = isTASE ? 'Fees (₪)' : 'Fees ($)'

  function handleSubmit() {
    const cleanSym = sym
    if (!cleanSym) return setError('Ticker is required')
    const qty = parseFloat(shares)
    if (!qty || qty <= 0) return setError('Enter a valid quantity')
    const fmtRegex = /^[A-Z0-9]+(\.[A-Z]{2,4}|-USD)?$/
    if (!fmtRegex.test(cleanSym)) return setError('Invalid ticker format (e.g. AAPL, TEVA.TA, BTC-USD)')
    setError('')
    onAdd({
      symbol: cleanSym,
      shares: qty,
      purchasePrice: parseFloat(purchasePrice) || 0,
      fees: parseFloat(fees) || 0,
      dividends: 0,
      purchaseDate,
    })
    onClose()
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative text-white rounded-t-[28px] p-5"
        style={{
          background: '#0A0A0A',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.6)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#27272a' }} />
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="iq-label mb-1">Portfolio</div>
            <span className="text-[20px] font-light tracking-tight">Add holding</span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg">×</button>
        </div>

        {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

        <div className="space-y-3">
          <SheetField label="Ticker symbol">
            <input className="sheet-input" placeholder="e.g. AAPL, TEVA.TA, BTC-USD"
              value={symbol} onChange={e => setSymbol(e.target.value)} autoCapitalize="characters" />
            {sym && (
              <p className="text-[10px] mt-1 font-semibold" style={{ color: marketColor }}>
                {marketLabel}
              </p>
            )}
          </SheetField>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Quantity">
              <input className="sheet-input" type="number" placeholder="0.00" inputMode="decimal"
                value={shares} onChange={e => setShares(e.target.value)} />
            </SheetField>
            <SheetField label={priceLabel}>
              <input className="sheet-input" type="number" placeholder="0.00" inputMode="decimal"
                value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
              {isTASE && <p className="text-[10px] text-white/30 mt-1">100 agorot = ₪1</p>}
            </SheetField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label={feesLabel}>
              <input className="sheet-input" type="number" placeholder="0.00" inputMode="decimal"
                value={fees} onChange={e => setFees(e.target.value)} />
            </SheetField>
            <SheetField label="Date">
              <div className="relative">
                <input className="sheet-input sheet-input-date" type="date"
                  value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                {!purchaseDate && (
                  <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-white/30 text-[14px] pointer-events-none select-none">
                    Select date
                  </span>
                )}
              </div>
            </SheetField>
          </div>
        </div>

        <button onClick={handleSubmit}
          className="w-full h-[52px] mt-5 rounded-2xl font-bold text-[15px] tracking-tight text-black"
          style={{ background: '#D4AF37', boxShadow: '0 10px 30px rgba(212,175,55,0.25)' }}>
          Save investment
        </button>
      </div>
    </div>
  )
}

function SheetField({ label, children }) {
  return (
    <div>
      <div className="iq-label mb-1.5">{label}</div>
      {children}
    </div>
  )
}

// ─── AppHeader ────────────────────────────────────────────────────────────────
function AppHeader({ currency, onToggleCurrency, onRefresh, loading }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
        paddingBottom: '12px',
        background: 'rgba(5,5,5,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
      }}>
      <div className="flex items-center gap-2.5">
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#D4AF37',
          boxShadow: '0 0 10px rgba(212,175,55,0.7)',
        }} />
        <span style={{
          fontWeight: 300,
          fontSize: 13,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'white',
        }}>IQ.FINANCE</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onToggleCurrency}
          className="h-7 px-3 rounded-full text-[10px] font-semibold"
          style={{ border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37', background: 'rgba(212,175,55,0.06)' }}>
          {currency}
        </button>
        <button onClick={onRefresh} disabled={loading}
          className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={loading ? 'animate-spin' : ''}>
            <path d="M21 12a9 9 0 11-3.5-7.1M21 3v6h-6" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── TabBar ───────────────────────────────────────────────────────────────────
const TAB_PATHS = {
  home:     'M3 13l9-9 9 9M5 11v10h14V11',
  markets:  'M3 17l4-4 4 4 7-7 3 3',
  activity: 'M3 6h18M3 12h18M3 18h18',
  you:      'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 8c0-4 4-6 8-6s8 2 8 6',
}

function TabBar({ activeTab, onTabChange, onAdd }) {
  const tabIcon = (key, active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d={TAB_PATHS[key]} stroke={active ? '#D4AF37' : '#52525b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center px-5 pt-2"
      style={{
        background: 'rgba(5,5,5,0.92)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderTop: '1px solid rgba(255,255,255,0.03)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
      }}>
      <TabBtn icon={tabIcon('home', activeTab === 'home')} label="Home"
        active={activeTab === 'home'} onClick={() => onTabChange('home')} />
      <TabBtn icon={tabIcon('markets', activeTab === 'markets')} label="Markets"
        active={activeTab === 'markets'} onClick={() => onTabChange('markets')} />
      <div className="flex-1 flex justify-center">
        <button onClick={onAdd}
          className="w-[44px] h-[44px] rounded-full flex items-center justify-center -translate-y-1"
          style={{ background: '#D4AF37', boxShadow: '0 6px 20px rgba(212,175,55,0.35)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <TabBtn icon={tabIcon('activity', activeTab === 'activity')} label="Activity"
        active={activeTab === 'activity'} onClick={() => onTabChange('activity')} />
      <TabBtn icon={tabIcon('you', activeTab === 'you')} label="You"
        active={activeTab === 'you'} onClick={() => onTabChange('you')} />
    </div>
  )
}

function TabBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick}
      className="flex-1 flex flex-col items-center gap-0.5 bg-transparent border-0 p-0 py-1">
      {icon}
      <span style={{
        fontSize: 7,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        fontWeight: 600,
        color: active ? '#D4AF37' : '#52525b',
      }}>{label}</span>
    </button>
  )
}

// ─── PortfolioScreen ──────────────────────────────────────────────────────────
const formatUpdatedAt = (date) => {
  if (!date) return null
  const d = new Date(date)
  const month = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  const year = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `Updated ${month} ${day}, ${year} · ${hh}:${mm}`
}

function PortfolioScreen({ holdings, enriched, prices, exchangeRate, currency, onToggleCurrency, onRefresh, loading, stale, lastUpdated, onSelectHolding, onDeleteHolding, onMoveHolding, transactions }) {
  const [editMode, setEditMode] = useState(false)
  const { totalUSD, totalILS, usPct, ilPct, cryptoPct, gainUSD } = calculateTotals(holdings, prices, exchangeRate)
  const { pct: allTimePct } = calculateAllTimeReturn(holdings, prices, exchangeRate)
  const [range, setRange] = useState('1M')
  const [allocTab, setAllocTab] = useState('geo')
  const ranges = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

  const geminiKey = import.meta.env.VITE_GEMINI_KEY
  const [insights, setInsights] = useState('')
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')
  const [insightsOpen, setInsightsOpen] = useState(false)

  async function handleGetInsights() {
    setInsightsLoading(true)
    setInsightsError('')
    setInsightsOpen(true)
    try {
      const portfolioSummary = enriched.map(h =>
        `${displaySymbol(h.ticker)} (${h.market}): ${h.qty} shares @ ${formatCurrency(h._metrics?.effectiveCurrentPrice ?? 0, h.market === 'IL' ? 'ILS' : 'USD')}, value ${formatCurrency(h._metrics?.currentValue ?? 0, h.market === 'IL' ? 'ILS' : 'USD')}, ROI ${h._metrics?.roiPct?.toFixed(1) ?? 0}%`
      ).join('\n')
      const recentTxns = (transactions || []).slice(-20).map(t =>
        `${t.date} ${t.type} ${t.category} ${formatCurrency(t.amount, t.currency)}${t.note ? ' — ' + t.note : ''}`
      ).join('\n')
      const totalVal = currency === 'ILS' ? formatCurrency(totalILS, 'ILS') : formatCurrency(totalUSD, 'USD')
      const payload = {
        contents: [{
          parts: [{
            text: `You are a concise personal finance advisor. Analyze this portfolio and provide 3–5 bullet-point insights covering diversification, performance, risk, and one actionable recommendation. Be brief.\n\nTotal net worth: ${totalVal}\nAll-time return: ${allTimePct.toFixed(2)}%\n\nHoldings:\n${portfolioSummary || 'None'}\n\nRecent transactions (last 20):\n${recentTxns || 'None'}`,
          }],
        }],
      }
      const result = await callGemini(payload)
      setInsights(result)
    } catch {
      setInsightsError('Unable to fetch insights')
    } finally {
      setInsightsLoading(false)
    }
  }

  const totalDisplay = currency === 'ILS' ? formatCurrency(totalILS, 'ILS') : formatCurrency(totalUSD, 'USD')
  const isGainUp = gainUSD >= 0
  const gainColor = isGainUp ? '#22c55e' : '#ef4444'
  const isAllTimeUp = allTimePct >= 0

  const chartData = useMemo(() => buildPortfolioReturnCurve(enriched, exchangeRate), [enriched, exchangeRate])
  const chartColor = isGainUp ? '#22c55e' : '#ef4444'

  const sorted = [...enriched].sort((a, b) => {
    const va = a._metrics?.currentValue ?? 0
    const vb = b._metrics?.currentValue ?? 0
    return vb - va
  })

  const geoSlices = [
    { label: 'Crypto', value: cryptoPct, color: '#f59e0b' },
    { label: 'US',     value: usPct,     color: '#22c55e' },
    { label: 'IL',     value: ilPct,     color: '#6366f1' },
  ].filter(s => s.value > 0)

  const assetSlices = [
    { label: 'Equities', value: usPct + ilPct, color: '#22c55e' },
    { label: 'Crypto',   value: cryptoPct,     color: '#f59e0b' },
  ].filter(s => s.value > 0)

  const sectorValues = useMemo(() => {
    const totals = {}
    for (const h of enriched) {
      if (!h._metrics) continue
      const baseSymbol = displaySymbol(h.ticker).replace('.TA', '')
      const sector = h.market === 'CRYPTO' ? 'Crypto' : h.market === 'IL' ? 'IL' : (SECTOR_MAP[baseSymbol] ?? 'Other')
      const val = h.market === 'IL' ? h._metrics.currentValue / exchangeRate : h._metrics.currentValue
      totals[sector] = (totals[sector] ?? 0) + val
    }
    const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1
    return Object.entries(totals)
      .map(([label, val]) => ({ label, value: (val / grand) * 100, color: SECTOR_COLORS[label] ?? SECTOR_COLORS.Other }))
      .sort((a, b) => b.value - a.value)
  }, [enriched, exchangeRate])

  const allocationSlices = allocTab === 'asset' ? assetSlices : allocTab === 'sector' ? sectorValues : geoSlices

  const updatedText = formatUpdatedAt(lastUpdated)

  return (
    <div className="overflow-y-auto no-scrollbar" style={{
      height: '100%',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
      paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
    }}>
      {stale && (
        <div className="mx-5 mt-3 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-2xl px-4 py-2">
          ⚠ Could not fetch live prices — showing cached data.
        </div>
      )}

      {/* AI Insights */}
      {geminiKey && (
        <div className="mx-5 mt-4">
          <button onClick={handleGetInsights} disabled={insightsLoading}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-2xl text-[11px] font-semibold disabled:opacity-60"
            style={{ border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37', background: 'rgba(212,175,55,0.06)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={insightsLoading ? 'animate-spin' : ''}>
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" stroke="#D4AF37" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z" stroke="#D4AF37" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            {insightsLoading ? 'Analyzing…' : 'Get AI Insights'}
          </button>
          {insightsOpen && (
            <div className="mt-2 glass-panel rounded-2xl px-4 py-3">
              {insightsError ? (
                <p className="text-[12px]" style={{ color: '#71717a' }}>{insightsError}</p>
              ) : insightsLoading ? (
                <p className="text-[12px]" style={{ color: '#71717a' }}>Thinking…</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="iq-label">AI Insights</span>
                    <button onClick={() => setInsightsOpen(false)} className="text-white/30 text-[16px] leading-none">×</button>
                  </div>
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-300">{insights}</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hero card */}
      <div className="mx-5 mt-4">
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="iq-label mb-2">Total net worth</div>
          <div className="text-center mb-1">
            <div className="text-[48px] tabular-nums leading-none" style={{ fontWeight: 200, letterSpacing: '-0.03em' }}>
              {holdings.length ? totalDisplay : (currency === 'ILS' ? '₪0' : '$0')}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap mb-4 mt-2">
            {holdings.length > 0 && (
              <>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5"
                  style={{ color: gainColor, background: `${gainColor}1f` }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d={isGainUp ? 'M1 8l3-3 2 2 5-5M8 2h3v3' : 'M1 4l3 3 2-2 5 5M8 10h3V7'}
                      stroke={gainColor} strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  </svg>
                  {isGainUp ? '+' : ''}{formatCurrency(gainUSD, 'USD')} today
                </span>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/6 tabular-nums"
                  style={{ color: isAllTimeUp ? '#22c55e' : '#ef4444' }}>
                  {isAllTimeUp ? '+' : ''}{allTimePct.toFixed(2)}% all time
                </span>
              </>
            )}
            {!holdings.length && (
              <span className="text-[11px] px-3 py-1 rounded-full bg-white/5 text-white/30 border border-white/10">
                No holdings yet
              </span>
            )}
          </div>
          {/* Chart */}
          <div className="-mx-5">
            <PriceChart data={chartData} color={chartColor} width={350} height={90}
              formatValue={v => formatCurrency(v, 'USD')} />
          </div>
          {/* Range tabs */}
          <div className="flex gap-1 mt-2 p-1 rounded-xl bg-black/25">
            {ranges.map(r => (
              <button key={r} onClick={() => setRange(r)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
                style={range === r ? { background: 'rgba(212,175,55,0.15)', color: '#D4AF37' } : { color: 'rgba(255,255,255,0.35)' }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Allocation */}
      {holdings.length > 0 && geoSlices.length > 0 && (
        <div className="mx-5 mt-3">
          <div className="glass-card-small p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="iq-label">Allocation</div>
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-black/30">
                {[['geo','Geo'],['asset','Asset'],['sector','Sector']].map(([key,label]) => (
                  <button key={key} onClick={() => setAllocTab(key)}
                    className="px-2.5 py-1 rounded-md text-[9px] font-bold transition-colors"
                    style={allocTab === key ? { background: 'rgba(212,175,55,0.15)', color: '#D4AF37' } : { color: 'rgba(255,255,255,0.35)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <AllocationBar slices={allocationSlices} />
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3">
              {allocationSlices.map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-[12px] font-semibold text-white/80">{s.label}</span>
                  <span className="text-[12px] text-white/50 tabular-nums">{s.value.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Holdings list */}
      {enriched.length > 0 && (
        <div className="mx-5 mt-4">
          <div className="flex items-baseline justify-between px-1 mb-2">
            <span className="iq-label">Holdings · {enriched.length}</span>
            <button onClick={() => setEditMode(m => !m)}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors"
              style={editMode ? { background: 'rgba(212,175,55,0.15)', color: '#D4AF37' } : { color: 'rgba(255,255,255,0.45)' }}>
              {editMode ? 'Done' : 'Edit'}
            </button>
          </div>
          <div className="rounded-[22px] border border-white/5 bg-white/3 overflow-hidden divide-y divide-white/5">
            {(editMode ? enriched : sorted).map((h, i, arr) => (
              editMode ? (
                <div key={h.ticker} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <button disabled={i === 0} onClick={() => onMoveHolding(h.ticker, 'up')}
                      className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center disabled:opacity-25">
                      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 7l3-3 3 3" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                    </button>
                    <button disabled={i === arr.length - 1} onClick={() => onMoveHolding(h.ticker, 'down')}
                      className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center disabled:opacity-25">
                      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3l3 3 3-3" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <Logo ticker={h.ticker} size={32} />
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold truncate">{displaySymbol(h.ticker)}</div>
                      <div className="text-[11px] text-white/40 truncate">{h.name}</div>
                    </div>
                  </div>
                  <button onClick={() => {
                    if (confirm(`Remove ${displaySymbol(h.ticker)}?`)) onDeleteHolding(h.ticker)
                  }} className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </button>
                </div>
              ) : (
                <HoldingRow key={h.ticker} h={h} onClick={() => onSelectHolding(h)} />
              )
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Category icon (income/expense rows) ──────────────────────────────────────
const CATEGORY_EMOJI = {
  Salary: '💰', Dividends: '📈', Interest: '🏦', Bonus: '🎁',
  Gift: '🎀', Refund: '↩', Other: '✨',
  Housing: '🏠', Food: '🍽', Transport: '🚗', Utilities: '💡',
  Health: '🩺', Entertainment: '🎬', Subscriptions: '🔁',
  Insurance: '🛡', Education: '🎓', Travel: '✈', Shopping: '🛍', Tax: '🧾',
}

function categoryColor(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return LOGO_COLORS[Math.abs(h) % LOGO_COLORS.length]
}

function CategoryIcon({ category, type, size = 40 }) {
  const isIncome = type === 'INCOME'
  const bg = isIncome ? '#22c55e22' : `${categoryColor(category)}33`
  const fg = isIncome ? '#22c55e' : categoryColor(category)
  const glyph = CATEGORY_EMOJI[category] || (category?.[0]?.toUpperCase() ?? '?')
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: fg, fontWeight: 700, fontSize: size * 0.42, flexShrink: 0,
    }}>
      {glyph}
    </div>
  )
}

// ─── Month sparkline (net flow) ───────────────────────────────────────────────
function MonthSparkline({ trend, width = 350, height = 60 }) {
  const data = (trend || []).map(p => p.net)
  if (!data.length) return <div style={{ width, height }} />
  const min = Math.min(...data, 0)
  const max = Math.max(...data, 0)
  const range = (max - min) || 1
  const zeroY = height - ((0 - min) / range) * height
  const pts = data.map((v, i) => [
    (i / Math.max(1, data.length - 1)) * width,
    height - ((v - min) / range) * height,
  ])
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = data[data.length - 1]
  const color = last >= 0 ? '#22c55e' : '#ef4444'
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <line x1="0" x2={width} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} />
    </svg>
  )
}

// ─── TransactionRow ───────────────────────────────────────────────────────────
function TransactionRow({ txn, displayCurrency, exchangeRate, onClick }) {
  const isIncome = txn.type === 'INCOME'
  const converted = convertAmount(txn.amount, txn.currency, displayCurrency, exchangeRate)
  const sign = isIncome ? '+' : '−'
  const color = isIncome ? '#22c55e' : '#f43f5e'
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/3 active:bg-white/5 bg-transparent border-0 text-left relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: color, opacity: 0.7 }} />
      <CategoryIcon category={txn.category} type={txn.type} size={40} />
      <div className="flex-1 min-w-0">
        <div className="text-white font-semibold text-[15px] tracking-tight truncate">
          {txn.category}
        </div>
        <div className="text-[12px] mt-0.5 truncate" style={{ color: '#71717a' }}>
          {txn.note ? txn.note : isIncome ? 'Income' : 'Expense'}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-semibold text-[14px] tabular-nums tracking-tight" style={{ color }}>
          {sign}{formatCurrency(converted, displayCurrency)}
        </div>
        {txn.currency !== displayCurrency && (
          <div className="text-[11px] tabular-nums mt-0.5" style={{ color: '#71717a' }}>
            {formatCurrency(txn.amount, txn.currency)}
          </div>
        )}
      </div>
    </button>
  )
}

// ─── AddTransactionSheet ─────────────────────────────────────────────────────
function AddTransactionSheet({ initial, defaultCurrency, onClose, onSave, onDelete }) {
  const isEdit = Boolean(initial?.id)
  const [type, setType] = useState(initial?.type || 'EXPENSE')
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [currency, setCurrency] = useState(initial?.currency || defaultCurrency || 'USD')
  const todayIso = new Date().toISOString().slice(0, 10)
  const presetList = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const [category, setCategory] = useState(initial?.category || presetList[0])
  const [date, setDate] = useState(initial?.date || todayIso)
  const [note, setNote] = useState(initial?.note || '')
  const [error, setError] = useState('')

  function changeType(next) {
    setType(next)
    const list = next === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    if (!list.includes(category)) setCategory(list[0])
  }

  function handleSubmit() {
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) return setError('Enter a positive amount')
    if (!date) return setError('Pick a date')
    setError('')
    onSave({
      ...(initial || {}),
      type, amount: amt, currency, category, date, note: note.trim(),
    })
    onClose()
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative text-white rounded-t-[28px] p-5 max-h-[92dvh] overflow-y-auto"
        style={{
          background: '#0A0A0A',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.6)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#27272a' }} />
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="iq-label mb-1">Cash flow</div>
            <span className="text-[20px] font-light tracking-tight">{isEdit ? 'Edit transaction' : 'New transaction'}</span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg">×</button>
        </div>

        {/* Type segmented */}
        <div className="flex gap-1 p-1 rounded-2xl bg-white/5 mb-4">
          {['EXPENSE', 'INCOME'].map(t => (
            <button key={t} onClick={() => changeType(t)}
              className={`flex-1 h-10 rounded-xl text-[13px] font-bold tracking-tight transition-colors ${
                type === t
                  ? (t === 'INCOME' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/15 text-rose-300')
                  : 'text-white/45'
              }`}>
              {t === 'INCOME' ? 'Income' : 'Expense'}
            </button>
          ))}
        </div>

        {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

        <div className="space-y-3">
          <SheetField label="Amount">
            <div className="flex gap-2">
              <input className="sheet-input flex-1" type="number" inputMode="decimal" placeholder="0.00"
                value={amount} onChange={e => setAmount(e.target.value)} />
              <div className="flex p-1 rounded-xl bg-white/5">
                {['USD', 'ILS'].map(c => (
                  <button key={c} type="button" onClick={() => setCurrency(c)}
                    className={`px-3 h-[38px] rounded-lg text-[12px] font-bold ${
                      currency === c ? 'bg-white/10 text-white' : 'text-white/45'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </SheetField>

          <SheetField label="Category">
            <select className="sheet-input"
              value={category} onChange={e => setCategory(e.target.value)}>
              {presetList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </SheetField>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Date">
              <div className="relative">
                <input className="sheet-input sheet-input-date" type="date"
                  value={date} onChange={e => setDate(e.target.value)} />
                {!date && (
                  <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-white/30 text-[14px] pointer-events-none select-none">
                    Select date
                  </span>
                )}
              </div>
            </SheetField>
            <SheetField label="Note">
              <input className="sheet-input" type="text" placeholder="Optional"
                value={note} onChange={e => setNote(e.target.value)} />
            </SheetField>
          </div>
        </div>

        {isEdit && (
          <button type="button" onClick={() => { onDelete(initial.id); onClose() }}
            className="w-full h-[44px] mt-4 rounded-2xl font-semibold text-[13px] tracking-tight text-rose-300 bg-rose-500/10 border border-rose-500/30">
            Delete transaction
          </button>
        )}

        <button onClick={handleSubmit}
          className="w-full h-[52px] mt-4 rounded-2xl font-bold text-[15px] tracking-tight text-black"
          style={{ background: '#D4AF37', boxShadow: '0 10px 30px rgba(212,175,55,0.25)' }}>
          {isEdit ? 'Save changes' : 'Save transaction'}
        </button>
      </div>
    </div>
  )
}

// ─── BudgetSheet ─────────────────────────────────────────────────────────────
function BudgetSheet({ budgets, defaultCurrency, onClose, onSave, onDelete }) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(budgets.map(b => [b.category, { amount: String(b.amount), currency: b.currency }]))
  )
  const [currency, setCurrency] = useState(defaultCurrency || 'USD')

  function patch(cat, key, val) {
    setDrafts(prev => ({ ...prev, [cat]: { ...(prev[cat] || { amount: '', currency }), [key]: val } }))
  }

  function handleSaveAll() {
    for (const [cat, d] of Object.entries(drafts)) {
      const amt = parseFloat(d.amount)
      if (!Number.isFinite(amt) || amt < 0) continue
      onSave({ category: cat, amount: amt, currency: d.currency || currency })
    }
    onClose()
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative text-white rounded-t-[28px] p-5 max-h-[88dvh] overflow-y-auto"
        style={{ background: '#0A0A0A', boxShadow: '0 -20px 40px rgba(0,0,0,0.6)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#27272a' }} />
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="iq-label mb-1">Activity</div>
            <span className="text-[20px] font-light tracking-tight">Monthly budgets</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg">×</button>
        </div>
        <div className="space-y-2">
          {EXPENSE_CATEGORIES.filter(c => c !== 'Other').map(cat => {
            const d = drafts[cat] || { amount: '', currency }
            return (
              <div key={cat} className="flex items-center gap-2">
                <CategoryIcon category={cat} type="EXPENSE" size={32} />
                <span className="flex-1 text-[13px] font-medium text-white/80">{cat}</span>
                <input type="number" inputMode="decimal" placeholder="0"
                  className="w-24 h-9 rounded-xl border border-white/8 bg-white/3 text-white text-[14px] px-3 outline-none font-tabular"
                  value={d.amount} onChange={e => patch(cat, 'amount', e.target.value)} />
                <button onClick={() => patch(cat, 'currency', d.currency === 'USD' ? 'ILS' : 'USD')}
                  className="w-11 h-9 rounded-xl border border-white/8 bg-white/3 text-[11px] font-bold text-white/60">
                  {d.currency || currency}
                </button>
                {budgets.find(b => b.category === cat) && (
                  <button onClick={() => onDelete(cat)} className="text-rose-400 text-[18px] leading-none px-1">×</button>
                )}
              </div>
            )
          })}
        </div>
        <button onClick={handleSaveAll}
          className="w-full h-[52px] mt-5 rounded-2xl font-bold text-[15px] tracking-tight text-black"
          style={{ background: '#D4AF37', boxShadow: '0 10px 30px rgba(212,175,55,0.25)' }}>
          Save budgets
        </button>
      </div>
    </div>
  )
}

// ─── RecurringSheet ───────────────────────────────────────────────────────────
function RecurringSheet({ templates, defaultCurrency, onClose, onSave, onDelete }) {
  const blank = { type: 'EXPENSE', amount: '', currency: defaultCurrency || 'USD', category: EXPENSE_CATEGORIES[0], note: '', cadence: 'MONTHLY', start_date: new Date().toISOString().slice(0, 10), active: true }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')

  function handleAdd() {
    const amt = parseFloat(form.amount)
    if (!Number.isFinite(amt) || amt <= 0) return setError('Enter a positive amount')
    if (!form.start_date) return setError('Pick a start date')
    setError('')
    onSave({ ...form, amount: amt })
    setAdding(false); setForm(blank)
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative text-white rounded-t-[28px] p-5 max-h-[92dvh] overflow-y-auto"
        style={{ background: '#0A0A0A', boxShadow: '0 -20px 40px rgba(0,0,0,0.6)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#27272a' }} />
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="iq-label mb-1">Activity</div>
            <span className="text-[20px] font-light tracking-tight">Recurring</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg">×</button>
        </div>
        {templates.length === 0 && !adding && (
          <p className="text-white/40 text-[13px] text-center py-6">No recurring transactions yet.</p>
        )}
        {templates.map(t => (
          <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-white/5">
            <CategoryIcon category={t.category} type={t.type} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold">{t.category} · {formatCurrency(t.amount, t.currency)}</div>
              <div className="text-[11px] text-white/45">{t.cadence} from {t.start_date}</div>
            </div>
            <button onClick={() => onSave({ ...t, active: !t.active })}
              className={`text-[11px] font-bold px-2 py-1 rounded-lg ${t.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
              {t.active ? 'ON' : 'OFF'}
            </button>
            <button onClick={() => onDelete(t.id)} className="text-rose-400 text-[18px] px-1">×</button>
          </div>
        ))}
        {adding ? (
          <div className="mt-4 space-y-3">
            <div className="flex gap-1 p-1 rounded-2xl bg-white/5">
              {['EXPENSE', 'INCOME'].map(t => (
                <button key={t} onClick={() => { setForm(f => ({ ...f, type: t, category: (t === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0] })) }}
                  className={`flex-1 h-9 rounded-xl text-[12px] font-bold ${form.type === t ? (t === 'INCOME' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/15 text-rose-300') : 'text-white/45'}`}>
                  {t === 'INCOME' ? 'Income' : 'Expense'}
                </button>
              ))}
            </div>
            {error && <p className="text-rose-400 text-xs">{error}</p>}
            <SheetField label="Amount">
              <div className="flex gap-2">
                <input className="sheet-input flex-1" type="number" inputMode="decimal" placeholder="0.00"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                <button onClick={() => setForm(f => ({ ...f, currency: f.currency === 'USD' ? 'ILS' : 'USD' }))}
                  className="px-3 h-[46px] rounded-xl border border-white/8 bg-white/3 text-[12px] font-bold text-white/70">
                  {form.currency}
                </button>
              </div>
            </SheetField>
            <SheetField label="Category">
              <select className="sheet-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {(form.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </SheetField>
            <div className="grid grid-cols-2 gap-3">
              <SheetField label="Cadence">
                <select className="sheet-input" value={form.cadence} onChange={e => setForm(f => ({ ...f, cadence: e.target.value }))}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </SheetField>
              <SheetField label="Start date">
                <div className="relative">
                  <input className="sheet-input sheet-input-date" type="date"
                    value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
              </SheetField>
            </div>
            <SheetField label="Note (optional)">
              <input className="sheet-input" placeholder="e.g. Monthly rent"
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </SheetField>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setAdding(false)} className="flex-1 h-11 rounded-2xl bg-white/5 text-white/70 font-semibold text-[13px]">Cancel</button>
              <button onClick={handleAdd} className="flex-1 h-11 rounded-2xl font-bold text-[13px] text-black" style={{ background: '#D4AF37' }}>Add</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full h-11 mt-4 rounded-2xl border border-white/10 bg-white/3 text-white/70 font-semibold text-[13px]">
            + Add recurring
          </button>
        )}
      </div>
    </div>
  )
}

// ─── ActivityScreen ───────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatDateLabel(isoDate) {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (isoDate === today) return 'Today'
  if (isoDate === yesterday) return 'Yesterday'
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`
}

function ActivityScreen({
  transactions, budgets, currency, exchangeRate,
  onToggleCurrency, onOpenBudgets, onOpenRecurring, onEditTxn, onSaveTxn, onExportCsv,
}) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [catTab, setCatTab] = useState('EXPENSE')
  const [showOverflow, setShowOverflow] = useState(false)
  const [scanning, setScanning] = useState(false)
  const scanInputRef = useRef(null)
  const geminiKey = import.meta.env.VITE_GEMINI_KEY
  const todayIso = new Date().toISOString().slice(0, 10)

  async function handleScanFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanning(true)
    try {
      let parts
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        const text = await file.text()
        parts = [{
          text: `Parse financial transactions from this CSV and return ONLY a JSON array, no explanation.\nEach item: {"amount":number,"category":string,"note":string,"currency":"USD"|"ILS","type":"INCOME"|"EXPENSE"}\nExpense categories: ${EXPENSE_CATEGORIES.join(', ')}\nIncome categories: ${INCOME_CATEGORIES.join(', ')}\n\nCSV:\n${text}`,
        }]
      } else {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        parts = [
          { inline_data: { mime_type: file.type || 'image/jpeg', data: base64 } },
          { text: `Parse financial transactions from this document and return ONLY a JSON array, no explanation.\nEach item: {"amount":number,"category":string,"note":string,"currency":"USD"|"ILS","type":"INCOME"|"EXPENSE"}\nExpense categories: ${EXPENSE_CATEGORIES.join(', ')}\nIncome categories: ${INCOME_CATEGORIES.join(', ')}` },
        ]
      }
      const parsed = await callGemini({ contents: [{ parts }] }, true)
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('No transactions found')
      let saved = 0
      for (const item of parsed) {
        if (!item.amount || !item.type) continue
        onSaveTxn({
          type: item.type,
          amount: Number(item.amount),
          currency: item.currency || currency,
          category: item.category || (item.type === 'INCOME' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]),
          note: item.note || '',
          date: todayIso,
        })
        saved++
      }
      if (saved === 0) throw new Error('No valid transactions found')
    } catch (err) {
      alert('Scan failed: ' + (err?.message || 'Could not parse document'))
    } finally {
      setScanning(false)
    }
  }

  const monthTxns = useMemo(
    () => transactions.filter(t => t.date?.startsWith(`${viewYear}-${String(viewMonth).padStart(2, '0')}`)),
    [transactions, viewYear, viewMonth],
  )

  const totals = useMemo(
    () => calculateMonthlyTotals(transactions, viewYear, viewMonth, currency, exchangeRate),
    [transactions, viewYear, viewMonth, currency, exchangeRate],
  )

  const catSlices = useMemo(
    () => aggregateByCategory(monthTxns, catTab, currency, exchangeRate),
    [monthTxns, catTab, currency, exchangeRate],
  )

  const grouped = useMemo(() => groupTransactionsByDate(monthTxns), [monthTxns])

  const trend = useMemo(
    () => calculateMonthlyTrend(transactions, 6, currency, exchangeRate),
    [transactions, currency, exchangeRate],
  )

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const netColor = totals.net >= 0 ? '#22c55e' : '#f43f5e'
  const catColors = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#f97316','#14b8a6','#ec4899','#84cc16']

  return (
    <div className="overflow-y-auto no-scrollbar" style={{
      height: '100%',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
      paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
    }}>
      {/* Hidden file input for scan */}
      <input ref={scanInputRef} type="file" accept=".csv,image/*,.pdf"
        className="hidden" onChange={handleScanFile} />

      {/* Month picker */}
      <div className="flex items-center justify-between px-5 py-3">
        <button onClick={prevMonth} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
          <svg width="8" height="14" viewBox="0 0 10 18" fill="none"><path d="M8 2L2 9l6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="text-[15px] font-bold tracking-tight" style={{ color: '#D4AF37' }}>
          {MONTH_NAMES[viewMonth - 1]} {viewYear}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
            <svg width="8" height="14" viewBox="0 0 10 18" fill="none"><path d="M2 2l6 7-6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {geminiKey && (
            <button onClick={() => scanInputRef.current?.click()} disabled={scanning}
              className="h-8 px-2.5 rounded-xl flex items-center gap-1.5 text-[10px] font-semibold disabled:opacity-50"
              style={{ border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37', background: 'rgba(212,175,55,0.06)' }}>
              {scanning ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="#D4AF37" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
              Scan
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowOverflow(v => !v)}
              className="w-8 h-8 rounded-xl border border-white/8 bg-white/4 flex items-center justify-center text-white/50 text-[16px]">
              ⋯
            </button>
            {showOverflow && (
              <div className="absolute right-0 top-10 z-20 bg-[#1a1a1c] rounded-2xl border border-white/10 shadow-xl overflow-hidden min-w-[160px]">
                {[['Manage budgets', onOpenBudgets], ['Recurring', onOpenRecurring], ['Export CSV', onExportCsv]].map(([lbl, fn]) => (
                  <button key={lbl} onClick={() => { fn(); setShowOverflow(false) }}
                    className="w-full px-4 py-3 text-left text-[13px] font-medium text-white/80 hover:bg-white/5 border-b border-white/5 last:border-0">
                    {lbl}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      {trend.some(t => t.net !== 0) && (
        <div className="mx-5 mt-2">
          <div className="glass-card-small p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">6-month net flow</div>
            <MonthSparkline trend={trend} width={310} height={52} />
            <div className="flex justify-between mt-1">
              {trend.map(p => (
                <span key={`${p.year}-${p.month}`} className="text-[9px] text-white/30">
                  {MONTH_NAMES[p.month - 1]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary card */}
      <div className="mx-5 mt-3">
        <div className="glass-card p-5">
          <div className="grid grid-cols-3 gap-0">
            {[
              ['Income', totals.income, '#22c55e'],
              ['Expenses', totals.expenses, '#f43f5e'],
              ['Net', totals.net, netColor],
            ].map(([lbl, val, clr]) => (
              <div key={lbl} className={lbl !== 'Income' ? 'border-l border-white/5 pl-3' : ''}>
                <div className={lbl === 'Net' ? 'iq-label mb-1' : 'text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1'}>{lbl}</div>
                <div className="text-[17px] font-bold tabular-nums tracking-tight" style={{ color: clr }}>
                  {lbl === 'Expenses' ? '−' : ''}{formatCurrency(Math.abs(val), currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {catSlices.length > 0 && (
        <div className="mx-5 mt-3">
          <div className="glass-card-small p-4">
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-3">
              {['EXPENSE', 'INCOME'].map(t => (
                <button key={t} onClick={() => setCatTab(t)}
                  className={`flex-1 h-8 rounded-lg text-[11px] font-bold transition-colors ${catTab === t ? 'bg-white/10 text-white' : 'text-white/40'}`}>
                  {t === 'EXPENSE' ? 'Expenses' : 'Income'}
                </button>
              ))}
            </div>
            <AllocationBar slices={catSlices.map((s, i) => ({ value: s.pct, color: catColors[i % catColors.length] }))} />
            <div className="mt-3 space-y-2">
              {catSlices.map((s, i) => {
                const budget = budgets.find(b => b.category === s.category && catTab === 'EXPENSE')
                const progress = budget
                  ? budgetProgress(budget, monthTxns, viewYear, viewMonth, currency, exchangeRate)
                  : null
                return (
                  <div key={s.category}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: catColors[i % catColors.length] }} />
                      <span className="text-[12px] font-semibold text-white/80 flex-1">{s.category}</span>
                      <span className="text-[12px] text-white/50 tabular-nums">{s.pct.toFixed(0)}%</span>
                      <span className="text-[12px] font-semibold text-white/80 tabular-nums">
                        {formatCurrency(s.total, currency)}
                      </span>
                    </div>
                    {progress && (
                      <div className="ml-4 mt-1">
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${Math.min(progress.pct, 100)}%`,
                            background: progress.over ? '#f43f5e' : '#22c55e',
                          }} />
                        </div>
                        <div className="text-[10px] text-white/35 mt-0.5 tabular-nums">
                          {formatCurrency(progress.spent, currency)} of {formatCurrency(progress.limit, currency)}
                          {progress.over && <span className="text-rose-400"> · over budget</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Transaction list */}
      {grouped.length > 0 ? (
        <div className="mx-5 mt-4 space-y-3">
          {grouped.map(g => (
            <div key={g.date}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1.5 px-1">
                {formatDateLabel(g.date)}
              </div>
              <div className="rounded-[22px] border border-white/5 bg-white/3 overflow-hidden divide-y divide-white/5">
                {g.items.map(t => (
                  <TransactionRow key={t.id} txn={t}
                    displayCurrency={currency} exchangeRate={exchangeRate}
                    onClick={() => onEditTxn(t)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mx-5 mt-8 p-6 rounded-[22px] border border-white/5 bg-white/3 text-center">
          <div className="text-[28px] mb-2">📊</div>
          <div className="text-[14px] font-semibold text-white/60">No transactions this month</div>
          <div className="text-[12px] text-white/35 mt-1">Tap + to add your first</div>
        </div>
      )}
    </div>
  )
}

// ─── YouScreen ────────────────────────────────────────────────────────────────
function YouScreen({
  currency, onToggleCurrency,
  cloudAvailable, session, syncing,
  onSignIn, onSignOut,
}) {
  const email = session?.user?.email
  return (
    <div className="overflow-y-auto no-scrollbar" style={{
      height: '100%',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
      paddingTop: 'calc(env(safe-area-inset-top) + 60px)',
    }}>
      <div className="mx-5 space-y-3">
        <div className="glass-card-small p-4">
          <div className="iq-label mb-3">Preferences</div>
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium">Display currency</span>
            <button onClick={onToggleCurrency}
              className="h-9 px-4 rounded-xl font-bold text-[12px]"
              style={{ border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37', background: 'rgba(212,175,55,0.06)' }}>
              {currency} →
            </button>
          </div>
        </div>

        {cloudAvailable && (
          <div className="glass-card-small p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="iq-label">Cloud sync</div>
              {syncing && <div className="text-[10px] text-emerald-400">Syncing…</div>}
            </div>
            {session ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[14px]"
                    style={{ background: 'rgba(212,175,55,0.1)', border: '1.5px solid rgba(212,175,55,0.5)', color: '#D4AF37' }}>
                    {email?.[0]?.toUpperCase() || '·'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{email}</div>
                    <div className="text-[11px] text-emerald-400">Synced across devices</div>
                  </div>
                </div>
                <button onClick={onSignOut}
                  className="w-full h-10 rounded-xl border border-white/8 bg-white/4 text-white/80 font-semibold text-[12px]">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div className="text-[12px] leading-relaxed mb-3" style={{ color: '#71717a' }}>
                  Optional: sign in to sync holdings, transactions, and budgets across all your devices.
                </div>
                <button onClick={onSignIn}
                  className="w-full h-10 rounded-xl text-black font-bold text-[12px]"
                  style={{ background: '#D4AF37' }}>
                  Sign in / Create account
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AuthSheet ───────────────────────────────────────────────────────────────
function AuthSheet({ onClose, onSignedIn }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setInfo('')
    if (!email || !password) return setError('Email and password are required')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const session = await signUp(email, password)
        if (session) { onSignedIn(session); onClose() }
        else setInfo('Check your inbox to confirm your email, then sign in.')
      } else {
        const session = await signInWithPassword(email, password)
        onSignedIn(session)
        onClose()
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative text-white rounded-t-[28px] p-5 max-h-[92dvh] overflow-y-auto"
        style={{
          background: '#0A0A0A',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.6)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#27272a' }} />
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="iq-label mb-1">Account</div>
            <span className="text-[20px] font-light tracking-tight">
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </span>
          </div>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg">×</button>
        </div>
        <div className="text-[12px] leading-relaxed mb-4" style={{ color: '#71717a' }}>
          Your local data will be merged with the cloud on first sign-in.
        </div>

        <div className="space-y-3">
          <div>
            <div className="iq-label mb-1.5">Email</div>
            <input className="sheet-input" type="email" autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <div className="iq-label mb-1.5">Password</div>
            <input className="sheet-input" type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>

        {error && <p className="text-rose-400 text-xs mt-3">{error}</p>}
        {info && <p className="text-emerald-400 text-xs mt-3">{info}</p>}

        <button type="submit" disabled={busy}
          className="w-full h-[48px] mt-5 rounded-2xl font-bold text-[14px] tracking-tight text-black disabled:opacity-50"
          style={{ background: '#D4AF37' }}>
          {busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>

        <div className="mt-4 text-center text-[12px] text-white/50">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" style={{ color: '#D4AF37' }} className="font-semibold"
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setInfo('') }}>
            {mode === 'signup' ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── MarketsScreen (placeholder) ─────────────────────────────────────────────
function MarketsScreen() {
  return (
    <div className="flex items-center justify-center" style={{
      height: '100%',
      paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
    }}>
      <div className="text-center px-8">
        <div className="text-[36px] mb-3">📉</div>
        <div className="text-[16px] font-bold text-white/70">Markets coming soon</div>
        <div className="text-[13px] text-white/40 mt-1">Real-time market data will appear here</div>
      </div>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  // ── portfolio state ────────────────────────────────────────────────────────
  const [holdings, setHoldings] = useState(() => loadHoldings())
  const [prices, setPrices] = useState(() => loadPricesCache() ?? {})
  const [exchangeRate, setExchangeRate] = useState(3.7)
  const [loading, setLoading] = useState(false)
  const [stale, setStale] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  // ── cash flow state ────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState(() => loadTransactions())
  const [budgets, setBudgets] = useState(() => loadBudgets())
  const [recurring, setRecurring] = useState(() => loadRecurring())

  // ── UI state ───────────────────────────────────────────────────────────────
  const [currency, setCurrency] = useState('USD')
  const [activeTab, setActiveTab] = useState('home')
  const [selected, setSelected] = useState(null)
  const [adding, setAdding] = useState(false)
  const [addingTxn, setAddingTxn] = useState(false)
  const [editingTxn, setEditingTxn] = useState(null)
  const [managingBudgets, setManagingBudgets] = useState(false)
  const [managingRecurring, setManagingRecurring] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  // ── auth state (optional) ─────────────────────────────────────────────────
  const [session, setSession] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const userId = session?.user?.id ?? null
  const syncedForUser = useRef(null)

  const apiKey = import.meta.env.VITE_RAPIDAPI_KEY

  // ── materialize recurring on mount ────────────────────────────────────────
  useEffect(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    const { newTxns, updatedTemplates } = materializeRecurring(recurring, todayIso)
    if (newTxns.length > 0) {
      setTransactions(prev => {
        const next = [...prev, ...newTxns]
        saveTransactions(next)
        return next
      })
    }
    if (updatedTemplates.length > 0) {
      setRecurring(prev => {
        const next = prev.map(t => updatedTemplates.find(u => u.id === t.id) ?? t)
        saveRecurring(next)
        return next
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── auth bootstrap ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseConfigured) return
    getSession().then(setSession).catch(console.error)
    return onAuthChange(setSession)
  }, [])

  // ── initial sync after sign-in: merge local + cloud ───────────────────────
  useEffect(() => {
    if (!userId || syncedForUser.current === userId) return
    syncedForUser.current = userId
    setSyncing(true)
    ;(async () => {
      try {
        const [cloudH, cloudT, cloudB, cloudR] = await Promise.all([
          fetchHoldings(), fetchTransactions(), fetchBudgets(), fetchRecurring(),
        ])
        const localH = loadHoldings()
        const localT = loadTransactions()
        const localB = loadBudgets()
        const localR = loadRecurring()

        const cloudSymbols = new Set(cloudH.map(h => h.symbol))
        const localOnlyH = localH.filter(h => !cloudSymbols.has(h.symbol))
        const cloudTxnIds = new Set(cloudT.map(t => t.id))
        const localOnlyT = localT.filter(t => t.id && !cloudTxnIds.has(t.id))
        const cloudCats = new Set(cloudB.map(b => b.category))
        const localOnlyB = localB.filter(b => !cloudCats.has(b.category))
        const cloudRIds = new Set(cloudR.map(r => r.id))
        const localOnlyR = localR.filter(r => r.id && !cloudRIds.has(r.id))

        await Promise.all([
          localOnlyH.length ? bulkUpsertHoldings(localOnlyH, userId) : null,
          localOnlyT.length ? bulkInsertTransactions(localOnlyT, userId) : null,
          localOnlyB.length ? bulkUpsertBudgets(localOnlyB, userId) : null,
          localOnlyR.length ? bulkUpsertRecurring(localOnlyR, userId) : null,
        ].filter(Boolean))

        const [finalH, finalT, finalB, finalR] = await Promise.all([
          fetchHoldings(), fetchTransactions(), fetchBudgets(), fetchRecurring(),
        ])
        setHoldings(finalH); saveHoldings(finalH)
        setTransactions(finalT); saveTransactions(finalT)
        setBudgets(finalB); saveBudgets(finalB)
        setRecurring(finalR); saveRecurring(finalR)
      } catch (err) {
        console.error('Initial sync failed:', err)
      } finally {
        setSyncing(false)
      }
    })()
  }, [userId])

  // ── price refresh ──────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!holdings.length) return
    setLoading(true); setStale(false)
    try {
      const { priceMap, exchangeRate: rate } = await fetchPrices(holdings.map(h => h.symbol), apiKey)
      setPrices(priceMap)
      setExchangeRate(rate)
      savePricesCache(priceMap)
      setLastUpdated(Date.now())
    } catch {
      setStale(true)
    } finally {
      setLoading(false)
    }
  }, [holdings, apiKey])

  useEffect(() => { refresh() }, [refresh])

  // ── holdings handlers ──────────────────────────────────────────────────────
  const handleAdd = useCallback((holding) => {
    if (holdings.find(h => h.symbol === holding.symbol)) return
    const withId = { ...holding, id: newId() }
    setHoldings(prev => {
      const next = [...prev, withId]
      saveHoldings(next)
      return next
    })
    if (userId) upsertHolding(withId, userId).catch(console.error)
  }, [holdings, userId])

  const handleDelete = useCallback((symbol) => {
    setHoldings(prev => {
      const next = prev.filter(h => h.symbol !== symbol)
      saveHoldings(next)
      return next
    })
    setPrices(prev => { const next = { ...prev }; delete next[symbol]; return next })
    if (userId) deleteHoldingBySymbol(symbol, userId).catch(console.error)
  }, [userId])

  // ── transaction handlers ───────────────────────────────────────────────────
  const handleSaveTxn = useCallback((txn) => {
    const isNew = !txn.id
    const withId = isNew ? { ...txn, id: newId(), createdAt: Date.now() } : txn
    setTransactions(prev => {
      const next = isNew ? [...prev, withId] : prev.map(t => t.id === withId.id ? withId : t)
      saveTransactions(next)
      return next
    })
    if (userId) upsertTransaction(withId, userId).catch(console.error)
  }, [userId])

  const handleDeleteTxn = useCallback((id) => {
    setTransactions(prev => {
      const next = prev.filter(t => t.id !== id)
      saveTransactions(next)
      return next
    })
    if (userId) deleteTransaction(id).catch(console.error)
  }, [userId])

  // ── budget handlers ────────────────────────────────────────────────────────
  const handleSaveBudget = useCallback((budget) => {
    const withId = budget.id ? budget : { id: newId(), ...budget }
    setBudgets(prev => {
      const next = prev.find(b => b.category === withId.category)
        ? prev.map(b => b.category === withId.category ? { ...b, ...withId } : b)
        : [...prev, withId]
      saveBudgets(next)
      return next
    })
    if (userId) upsertBudget(withId, userId).catch(console.error)
  }, [userId])

  const handleDeleteBudget = useCallback((category) => {
    setBudgets(prev => {
      const next = prev.filter(b => b.category !== category)
      saveBudgets(next)
      return next
    })
    if (userId) deleteBudget(category, userId).catch(console.error)
  }, [userId])

  // ── recurring handlers ─────────────────────────────────────────────────────
  const handleSaveRecurring = useCallback((template) => {
    const isNew = !template.id
    const withId = isNew ? { ...template, id: newId() } : template
    setRecurring(prev => {
      const next = isNew ? [...prev, withId] : prev.map(t => t.id === withId.id ? withId : t)
      saveRecurring(next)
      return next
    })
    if (userId) upsertRecurring(withId, userId).catch(console.error)
  }, [userId])

  const handleDeleteRecurring = useCallback((id) => {
    setRecurring(prev => {
      const next = prev.filter(t => t.id !== id)
      saveRecurring(next)
      return next
    })
    if (userId) deleteRecurring(id).catch(console.error)
  }, [userId])

  // ── currency toggle ────────────────────────────────────────────────────────
  const toggleCurrency = useCallback(() => {
    setCurrency(c => c === 'USD' ? 'ILS' : 'USD')
  }, [])

  // ── sign out (keeps local data) ───────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    try { await signOut() } catch (e) { console.error(e) }
    syncedForUser.current = null
    setSession(null)
  }, [])

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleExportCsv = useCallback(() => {
    const csv = toCSV(transactions, currency, exchangeRate)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }, [transactions, currency, exchangeRate])

  // ── FAB context ────────────────────────────────────────────────────────────
  const handleFab = useCallback(() => {
    if (activeTab === 'activity') setAddingTxn(true)
    else setAdding(true)
  }, [activeTab])

  // ── enriched holdings ──────────────────────────────────────────────────────
  const enriched = useMemo(() => holdings.map(holding => {
    const priceData = prices[holding.symbol] ?? null
    const market = getMarket(holding.symbol)
    const apiPrice = priceData?.regularMarketPrice ?? 0
    const metrics = apiPrice ? calculateHoldingMetrics(holding, apiPrice) : null
    return {
      ticker: holding.symbol,
      name: priceData?.longName ?? displaySymbol(holding.symbol),
      qty: holding.shares,
      avgCost: holding.purchasePrice,
      price: apiPrice,
      dayChange: priceData?.regularMarketChangePercent ?? 0,
      market,
      _holding: holding,
      _metrics: metrics,
    }
  }), [holdings, prices])

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#050505] text-white" style={{
      height: '100dvh',
      overflow: 'hidden',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
      WebkitFontSmoothing: 'antialiased',
      backgroundImage: 'radial-gradient(at 85% 15%, rgba(99,102,241,0.10), transparent 55%), radial-gradient(at 10% 85%, rgba(37,99,235,0.06), transparent 60%)',
    }}>
      <div className="max-w-[430px] mx-auto relative" style={{ height: '100dvh', overflow: 'hidden' }}>
        <AppHeader
          currency={currency}
          onToggleCurrency={toggleCurrency}
          onRefresh={refresh}
          loading={loading}
        />
        <div className="absolute inset-0">
          {activeTab === 'home' && (
            <PortfolioScreen
              holdings={holdings} enriched={enriched} prices={prices}
              exchangeRate={exchangeRate} currency={currency}
              onToggleCurrency={toggleCurrency} onRefresh={refresh}
              loading={loading} stale={stale} lastUpdated={lastUpdated}
              onSelectHolding={setSelected}
              transactions={transactions}
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
              onSaveTxn={handleSaveTxn}
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

        {selected && <HoldingDetail h={selected} onBack={() => setSelected(null)} />}

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
          <BudgetSheet
            budgets={budgets}
            defaultCurrency={currency}
            onClose={() => setManagingBudgets(false)}
            onSave={handleSaveBudget}
            onDelete={handleDeleteBudget}
          />
        )}

        {managingRecurring && (
          <RecurringSheet
            templates={recurring}
            defaultCurrency={currency}
            onClose={() => setManagingRecurring(false)}
            onSave={handleSaveRecurring}
            onDelete={handleDeleteRecurring}
          />
        )}

        {showAuth && (
          <AuthSheet
            onClose={() => setShowAuth(false)}
            onSignedIn={setSession}
          />
        )}
      </div>

      <style>{`
        .sheet-input {
          width: 100%;
          height: 46px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: white;
          padding: 0 14px;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
          -webkit-appearance: none;
          appearance: none;
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
}
