import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  isCrypto, getMarket, displaySymbol,
  formatCurrency, calculateTotals, calculateAllTimeReturn,
  loadHoldings, saveHoldings, loadPricesCache, savePricesCache,
  loadExchangeRate, saveExchangeRate,
  calculateHoldingMetrics
} from './utils'
import { fetchPrices, fetchHistory } from './api'

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

function PriceChart({ data, color = '#22c55e', width = 360, height = 120 }) {
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
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      <Logo ticker={h.ticker} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-semibold text-[15px] tracking-tight">{display}</span>
          <MarketBadge market={h.market} />
        </div>
        <div className="text-white/45 text-[12px] mt-0.5 truncate">
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
function HoldingDetail({ h, onBack, apiKey }) {
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
    <div className="absolute inset-0 bg-black text-white overflow-auto z-20" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
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
          <PriceChart data={chartData} color={accent} width={390} height={160} />
        </div>

        {/* Range tabs */}
        <div className="flex gap-1 mt-2 p-1 rounded-xl bg-white/4">
          {ranges.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${range === r ? 'bg-white/10 text-white' : 'text-white/45'}`}>
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
              value={metrics ? formatCurrency(
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
              value={metrics ? formatCurrency(metrics.breakEven, currency) : '—'} />
          </div>
        </div>

        {/* Transactions */}
        {h._holding.purchaseDate || h._holding.purchasePrice ? (
          <div className="mt-5">
            <div className="text-[11px] font-semibold tracking-widest uppercase text-white/45 mb-2">Transactions</div>
            <div className="rounded-[18px] overflow-hidden bg-white/3 border border-white/5">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-[10px] font-bold">BUY</div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold">
                    {h.qty < 1 ? h.qty.toFixed(4) : h.qty} @ {metrics ? formatCurrency(
                      isIL ? (h._holding.purchasePrice / 100) : h._holding.purchasePrice, currency
                    ) : '—'}
                  </div>
                  {h._holding.purchaseDate && (
                    <div className="text-[11px] text-white/45 mt-0.5">
                      {new Date(h._holding.purchaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>
                {metrics && (
                  <div className="text-[13px] font-semibold tabular-nums">
                    {formatCurrency(metrics.adjustedCostBasis, currency)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 px-5 pt-4 pb-8 flex gap-2.5"
        style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0),#000 30%)' }}>
        <button className="flex-1 h-12 rounded-2xl font-bold text-[14px] tracking-tight bg-white/8 text-white">Sell</button>
        <button className="flex-1 h-12 rounded-2xl font-bold text-[14px] tracking-tight text-black"
          style={{ background: accent, boxShadow: `0 8px 24px ${accent}44` }}>
          Buy more
        </button>
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
  const [purchaseDate, setPurchaseDate] = useState('')
  const [error, setError] = useState('')

  const isTASE = symbol.toUpperCase().endsWith('.TA')

  function handleSubmit() {
    const sym = symbol.trim().toUpperCase()
    if (!sym) return setError('Ticker is required')
    const qty = parseFloat(shares)
    if (!qty || qty <= 0) return setError('Enter a valid quantity')
    setError('')
    onAdd({
      symbol: sym,
      shares: qty,
      purchasePrice: parseFloat(purchasePrice) || 0,
      fees: 0,
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
          background: '#0E0E10',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.5)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}>
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
        <div className="flex items-center justify-between mb-5">
          <span className="text-[20px] font-bold tracking-tight">Add holding</span>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg">×</button>
        </div>

        {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

        <div className="space-y-3">
          <SheetField label="Ticker symbol">
            <input className="sheet-input" placeholder="e.g. AAPL, ELBT.TA, BTC-USD"
              value={symbol} onChange={e => setSymbol(e.target.value)} />
          </SheetField>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Quantity">
              <input className="sheet-input" type="number" placeholder="0.00"
                value={shares} onChange={e => setShares(e.target.value)} />
            </SheetField>
            <SheetField label={isTASE ? 'Price (agorot)' : 'Price (USD)'}>
              <input className="sheet-input" type="number" placeholder="0.00"
                value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
              {isTASE && <p className="text-[10px] text-white/30 mt-1">100 agorot = ₪1</p>}
            </SheetField>
          </div>

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

        <button onClick={handleSubmit}
          className="w-full h-[52px] mt-5 rounded-2xl font-bold text-[15px] tracking-tight text-black"
          style={{ background: '#22c55e', boxShadow: '0 10px 30px rgba(34,197,94,0.3)' }}>
          Save investment
        </button>
      </div>
    </div>
  )
}

function SheetField({ label, children }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">{label}</div>
      {children}
    </div>
  )
}

// ─── TabBar ───────────────────────────────────────────────────────────────────
function TabBar({ onAdd }) {
  const tabIcon = (path, active) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d={path} stroke={active ? '#22c55e' : 'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center px-5 pt-2.5"
      style={{
        background: 'linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.9) 40%)',
        backdropFilter: 'blur(12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
      }}>
      <TabBtn icon={tabIcon('M3 13l9-9 9 9M5 11v10h14V11', true)} label="Home" active />
      <TabBtn icon={tabIcon('M3 17l4-4 4 4 7-7 3 3', false)} label="Markets" />
      <div className="flex-1 flex justify-center">
        <button onClick={onAdd}
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center -translate-y-3 font-bold"
          style={{ background: '#22c55e', boxShadow: '0 6px 20px rgba(34,197,94,0.4)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <TabBtn icon={tabIcon('M3 6h18M3 12h18M3 18h18', false)} label="Activity" />
      <TabBtn icon={tabIcon('M12 12a4 4 0 100-8 4 4 0 000 8zm-8 8c0-4 4-6 8-6s8 2 8 6', false)} label="You" />
    </div>
  )
}

function TabBtn({ icon, label, active }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      {icon}
      <span className={`text-[10px] font-semibold ${active ? 'text-emerald-400' : 'text-white/30'}`}>{label}</span>
      {active && <div className="w-1 h-1 rounded-full bg-emerald-400" />}
    </div>
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

function PortfolioScreen({ holdings, enriched, prices, exchangeRate, currency, onToggleCurrency, onRefresh, loading, stale, lastUpdated, onSelectHolding }) {
  const { totalUSD, totalILS, usPct, ilPct, cryptoPct, gainUSD } = calculateTotals(holdings, prices, exchangeRate)
  const { pct: allTimePct } = calculateAllTimeReturn(holdings, prices, exchangeRate)
  const [range, setRange] = useState('1M')
  const ranges = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

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

  const allocationSlices = [
    { label: 'Crypto', value: cryptoPct, color: '#f59e0b' },
    { label: 'US',     value: usPct,     color: '#22c55e' },
    { label: 'IL',     value: ilPct,     color: '#6366f1' },
  ].filter(s => s.value > 0)

  const updatedText = formatUpdatedAt(lastUpdated)

  return (
    <div className="overflow-y-auto no-scrollbar" style={{
      height: '100%',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      {/* Header */}
      <div className="px-5 pt-3 pb-1 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-white/45 font-medium">My Portfolio</div>
          <div className="text-[28px] font-bold tracking-tight leading-tight">Overview</div>
          {updatedText && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/45">
              <span className="relative inline-flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald-400/60 animate-ping" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </span>
              {updatedText}
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-5">
          <button onClick={onToggleCurrency}
            className="h-9 px-3 rounded-xl border border-white/8 bg-white/4 text-white font-bold text-[12px]">
            {currency}
          </button>
          <button onClick={onRefresh} disabled={loading}
            className="w-9 h-9 rounded-xl border border-white/8 bg-white/4 flex items-center justify-center disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={loading ? 'animate-spin' : ''}>
              <path d="M21 12a9 9 0 11-3.5-7.1M21 3v6h-6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {stale && (
        <div className="mx-5 mt-3 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-2xl px-4 py-2">
          ⚠ Could not fetch live prices — showing cached data.
        </div>
      )}

      {/* Hero card */}
      <div className="mx-5 mt-4">
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">Total net worth</div>
          <div className="text-[44px] font-bold tracking-tighter leading-none tabular-nums mb-3">
            {holdings.length ? totalDisplay : (currency === 'ILS' ? '₪0' : '$0')}
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-4">
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
            <PriceChart data={chartData} color={chartColor} width={350} height={90} />
          </div>
          {/* Range tabs */}
          <div className="flex gap-1 mt-2 p-1 rounded-xl bg-black/25">
            {ranges.map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${range === r ? 'bg-white/10 text-white' : 'text-white/40'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Allocation */}
      {holdings.length > 0 && allocationSlices.length > 0 && (
        <div className="mx-5 mt-3">
          <div className="glass-card-small p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-3">Allocation</div>
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
      {sorted.length > 0 && (
        <div className="mx-5 mt-4">
          <div className="flex items-baseline justify-between px-1 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
              Holdings · {sorted.length}
            </span>
            <span className="text-[11px] text-white/40">Value ↓</span>
          </div>
          <div className="rounded-[22px] border border-white/5 bg-white/3 overflow-hidden divide-y divide-white/5">
            {sorted.map(h => (
              <HoldingRow key={h.ticker} h={h} onClick={() => onSelectHolding(h)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [holdings, setHoldings] = useState(() => loadHoldings())
  const [prices, setPrices] = useState(() => loadPricesCache() ?? {})
  const [exchangeRate, setExchangeRate] = useState(() => loadExchangeRate())
  const [loading, setLoading] = useState(false)
  const [stale, setStale] = useState(false)
  const [currency, setCurrency] = useState('USD')
  const [selected, setSelected] = useState(null)
  const [adding, setAdding] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const apiKey = import.meta.env.VITE_RAPIDAPI_KEY

  const refresh = useCallback(async () => {
    if (!holdings.length) return
    setLoading(true)
    setStale(false)
    try {
      const symbols = holdings.map(h => h.symbol)
      const { priceMap, exchangeRate: rate } = await fetchPrices(symbols, apiKey)
      if (Object.keys(priceMap).length > 0) {
        setPrices(priceMap)
        setExchangeRate(rate)
        savePricesCache(priceMap)
        saveExchangeRate(rate)
        setLastUpdated(Date.now())
      } else {
        setStale(true)
      }
    } catch (err) {
      console.error('Price fetch failed:', err)
      setStale(true)
    } finally {
      setLoading(false)
    }
  }, [holdings, apiKey])

  useEffect(() => { refresh() }, [refresh])

  const handleAdd = useCallback((holding) => {
    if (holdings.find(h => h.symbol === holding.symbol)) return
    const updated = [...holdings, holding]
    setHoldings(updated)
    saveHoldings(updated)
  }, [holdings])

  const handleDelete = useCallback((symbol) => {
    const updated = holdings.filter(h => h.symbol !== symbol)
    setHoldings(updated)
    saveHoldings(updated)
    setPrices(prev => { const next = { ...prev }; delete next[symbol]; return next })
  }, [holdings])

  // Bridge: enrich holdings with API data + metrics
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
      currency: market === 'IL' ? 'ILS' : undefined,
      _holding: holding,
      _metrics: metrics,
    }
  }), [holdings, prices])

  return (
    <div className="bg-[#050505] text-white" style={{
      height: '100dvh',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      WebkitFontSmoothing: 'antialiased',
      backgroundImage: 'radial-gradient(at 85% 15%, rgba(99,102,241,0.10), transparent 55%), radial-gradient(at 10% 85%, rgba(37,99,235,0.06), transparent 60%)',
    }}>
      <div className="max-w-[430px] mx-auto relative" style={{ height: '100dvh', overflow: 'hidden' }}>
        <div className="absolute inset-0">
          <PortfolioScreen
            holdings={holdings}
            enriched={enriched}
            prices={prices}
            exchangeRate={exchangeRate}
            currency={currency}
            onToggleCurrency={() => setCurrency(c => c === 'USD' ? 'ILS' : 'USD')}
            onRefresh={refresh}
            loading={loading}
            stale={stale}
            lastUpdated={lastUpdated}
            onSelectHolding={setSelected}
          />
        </div>

        {/* Tab bar */}
        <TabBar onAdd={() => setAdding(true)} />

        {/* Detail overlay */}
        {selected && (
          <HoldingDetail
            h={selected}
            onBack={() => setSelected(null)}
            apiKey={apiKey}
          />
        )}

        {/* Add sheet */}
        {adding && (
          <AddHoldingSheet
            onClose={() => setAdding(false)}
            onAdd={handleAdd}
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
        }
        .sheet-input::placeholder { color: rgba(255,255,255,0.2); }
        .sheet-input[type="date"] { color: rgba(255,255,255,0.85); font-size: 14px; min-height: 46px; }
        .sheet-input-date::-webkit-date-and-time-value { text-align: left; }
        .sheet-input-date::-webkit-calendar-picker-indicator { opacity: 0.6; cursor: pointer; }
      `}</style>
    </div>
  )
}
