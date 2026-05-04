import { useState, useEffect, useMemo } from 'react'
import { displaySymbol, formatCurrency } from '../../utils'
import { fetchHistory } from '../../api'
import { Logo, PriceChart } from '../ui'

// Define makeRand and priceHistoryPoints internally or move to a separate util if needed
function makeRand(seed) {
  let s = seed
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
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

function formatCurrencyPrecise(value, currency) {
  if (value == null || !isFinite(value)) return '—'
  const abs = Math.abs(value)
  const decimals = abs < 1 ? 4 : abs < 10 ? 3 : 2
  const formatted = value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return currency === 'ILS' ? `₪${formatted}` : `$${formatted}`
}

function DetailStat({ label, value, color }) {
  return (
    <div>
      <div className="text-[11px] font-medium mb-0.5" style={{ color: '#71717a' }}>{label}</div>
      <div className="text-[16px] font-semibold tabular-nums tracking-tight" style={{ color: color ?? '#fff' }}>{value}</div>
    </div>
  )
}

export function HoldingDetail({ h, onBack, onDelete, apiKey }) {
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
    <div className="absolute inset-0 bg-[#050505] text-white overflow-auto z-20" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 48px)' }}>
      {/* Sticky nav */}
      <div className="sticky top-0 z-10 px-4 pb-3 flex items-center gap-3"
        style={{
          background: 'linear-gradient(180deg,#050505 60%,rgba(5,5,5,0))',
          paddingTop: 'calc(env(safe-area-inset-top) + 20px)',
        }}>
        <button onClick={onBack}
          className="pressable w-9 h-9 rounded-xl border border-white/8 bg-white/4 flex items-center justify-center shrink-0">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M8 2L2 9l6 7" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Logo ticker={h.ticker} size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold tracking-tight">{displaySymbol(h.ticker)}</div>
          <div className="text-[10px]" style={{ color: '#71717a' }}>{h.name}</div>
        </div>
      </div>

      <div className="px-5">
        {/* Price */}
        <div className="mt-1">
          <div className="iq-label" style={{ color: '#52525b' }}>Current price</div>
          <div className="flex items-baseline gap-3 mt-1">
            <div className="text-[40px] tabular-nums leading-none" style={{ fontWeight: 200, letterSpacing: '-0.03em' }}>
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
        <div className="flex gap-1 mt-2 p-1 rounded-xl bg-black/25">
          {ranges.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="pressable flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200"
              style={range === r ? { background: 'rgba(134,239,172,0.15)', color: '#86efac' } : { color: 'rgba(255,255,255,0.4)' }}>
              {r}
            </button>
          ))}
        </div>

        {/* Position card */}
        <div className="mt-5 p-4 rounded-[18px] bg-white/4 border border-white/5">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-[12px]" style={{ color: '#71717a' }}>Market value</span>
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
            {h._holding.fees > 0 && (
              <DetailStat label="Fees paid"
                value={formatCurrency(h._holding.fees, currency)} />
            )}
            {h._holding.dividends > 0 && (
              <DetailStat label="Dividends"
                value={formatCurrency(h._holding.dividends, currency)}
                color="#22c55e" />
            )}
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
            <div className="iq-label mb-2" style={{ color: '#52525b' }}>Transactions</div>
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
