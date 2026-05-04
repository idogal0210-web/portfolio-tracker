import { useState, useMemo } from 'react'
import {
  calculateTotals, calculateAllTimeReturn,
  displaySymbol, formatCurrency, formatCurrencyPrecise
} from '../utils'
import { Logo, MarketBadge, Sparkline, sparklinePoints } from '../components/ui'
import { HoldingRow } from '../components/features'

export function HoldingsScreen({ holdings, enriched, prices, exchangeRate, currency, onSelectHolding, onDeleteHolding, onMoveHolding }) {
  const [editMode, setEditMode] = useState(false)
  const [filter, setFilter] = useState('ALL')
  const filters = ['ALL', 'US', 'IL', 'CRYPTO']

  const { totalUSD, totalILS } = calculateTotals(holdings, prices, exchangeRate)
  const { pct: allTimePct } = calculateAllTimeReturn(holdings, prices, exchangeRate)
  const isAllTimeUp = allTimePct >= 0
  const totalDisplay = currency === 'ILS' ? formatCurrency(totalILS, 'ILS') : formatCurrency(totalUSD, 'USD')

  const sorted = useMemo(() => [...enriched].sort((a, b) => (b._metrics?.currentValue ?? 0) - (a._metrics?.currentValue ?? 0)), [enriched])

  const filtered = useMemo(() => {
    const list = [...enriched].sort((a, b) => (b._metrics?.currentValue ?? 0) - (a._metrics?.currentValue ?? 0))
    return filter === 'ALL' ? list : list.filter(h => h.market === filter)
  }, [enriched, filter])

  const gainers = useMemo(() => [...enriched].filter(h => h.dayChange > 0).sort((a, b) => b.dayChange - a.dayChange).slice(0, 3), [enriched])
  const losers = useMemo(() => [...enriched].filter(h => h.dayChange < 0).sort((a, b) => a.dayChange - b.dayChange).slice(0, 3), [enriched])

  const todayPnL = useMemo(() =>
    enriched.reduce((sum, h) => sum + (h._metrics?.currentValue ?? 0) * (h.dayChange / 100), 0),
  [enriched])
  const todayPnLColor = todayPnL >= 0 ? '#22c55e' : '#ef4444'

  if (!enriched.length) {
    return (
      <div className="flex flex-col items-center justify-center" style={{
        height: '100%',
        paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
      }}>
        <div className="text-center px-8">
          <div className="mb-5 flex items-center justify-center">
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid rgba(134,239,172,0.3)', background: 'rgba(134,239,172,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M3 12h18M3 18h12" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="iq-label mb-3">Holdings</div>
          <div className="text-[16px] font-light text-white/70">No holdings yet</div>
          <div className="text-[12px] mt-2" style={{ color: '#52525b' }}>Tap + to add your first holding</div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto no-scrollbar" style={{
      height: '100%',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
      paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
    }}>
      {/* Header */}
      <div className="px-5 pt-3 pb-2">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[26px] font-bold tracking-tight leading-none">HOLDINGS</div>
            <div className="text-[13px] mt-0.5" style={{ color: '#71717a' }}>
              {enriched.length} {enriched.length === 1 ? 'position' : 'positions'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[16px] font-semibold tabular-nums tracking-tight">{totalDisplay}</div>
            <div className="text-[12px] font-semibold tabular-nums" style={{ color: isAllTimeUp ? '#22c55e' : '#ef4444' }}>
              {isAllTimeUp ? '+' : ''}{allTimePct.toFixed(2)}% all time
            </div>
          </div>
        </div>
        {enriched.some(h => h.dayChange !== 0) && (
          <div className="glass-card-small px-4 py-3 flex items-center justify-between">
            <div>
              <div className="iq-label mb-0.5" style={{ color: '#52525b' }}>Today&apos;s P&amp;L</div>
              <div className="text-[11px] text-white/35">
                {gainers.length} gainer{gainers.length !== 1 ? 's' : ''} · {losers.length} loser{losers.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[22px] font-bold tabular-nums tracking-tight" style={{ color: todayPnLColor }}>
                {todayPnL >= 0 ? '+' : ''}{formatCurrency(Math.abs(todayPnL), 'USD')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Holdings list */}
      <div className="mx-5 mt-2">
        <div className="flex items-baseline justify-between px-1 mb-2">
          <span className="iq-label">Portfolio · {enriched.length}</span>
          <button onClick={() => setEditMode(m => !m)}
            className="text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors border-none cursor-pointer"
            style={editMode ? { background: 'rgba(134,239,172,0.15)', color: '#86efac' } : { color: 'rgba(255,255,255,0.45)' }}>
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
        <div className="rounded-[22px] border border-white/5 bg-white/3 overflow-hidden divide-y divide-white/5 stagger">
          {(editMode ? enriched : sorted).map((h, i, arr) => (
            editMode ? (
              <div key={h.ticker} className="flex items-center gap-2 px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <button disabled={i === 0} onClick={() => onMoveHolding(h.ticker, 'up')}
                    className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center disabled:opacity-25 border-none cursor-pointer">
                    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 7l3-3 3 3" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                  </button>
                  <button disabled={i === arr.length - 1} onClick={() => onMoveHolding(h.ticker, 'down')}
                    className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center disabled:opacity-25 border-none cursor-pointer">
                    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3l3 3 3-3" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                  </button>
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <Logo ticker={h.ticker} size={32} />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold truncate">{displaySymbol(h.ticker)}</div>
                    <div className="text-[11px] truncate" style={{ color: '#71717a' }}>{h.name}</div>
                  </div>
                </div>
                <button onClick={() => { if (confirm(`Remove ${displaySymbol(h.ticker)}?`)) onDeleteHolding(h.ticker) }}
                  className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center border-none cursor-pointer">
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </button>
              </div>
            ) : (
              <HoldingRow key={h.ticker} h={h} onClick={() => onSelectHolding(h)} />
            )
          ))}
        </div>
      </div>

      {/* Markets / Watchlist */}
      {(gainers.length > 0 || losers.length > 0) && (
        <div className="mx-5 mt-5 grid grid-cols-2 gap-3">
          {gainers.length > 0 && (
            <div className="glass-card-small p-3">
              <div className="iq-label mb-2">Top gainers</div>
              {gainers.map(h => (
                <button key={h.ticker} onClick={() => onSelectHolding(h)}
                  className="w-full flex items-center gap-2 py-1.5 bg-transparent border-0 text-left cursor-pointer">
                  <Logo ticker={h.ticker} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate">{displaySymbol(h.ticker)}</div>
                  </div>
                  <div className="text-[12px] font-bold tabular-nums" style={{ color: '#22c55e' }}>+{h.dayChange.toFixed(2)}%</div>
                </button>
              ))}
            </div>
          )}
          {losers.length > 0 && (
            <div className="glass-card-small p-3">
              <div className="iq-label mb-2">Top losers</div>
              {losers.map(h => (
                <button key={h.ticker} onClick={() => onSelectHolding(h)}
                  className="w-full flex items-center gap-2 py-1.5 bg-transparent border-0 text-left cursor-pointer">
                  <Logo ticker={h.ticker} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate">{displaySymbol(h.ticker)}</div>
                  </div>
                  <div className="text-[12px] font-bold tabular-nums" style={{ color: '#f43f5e' }}>{h.dayChange.toFixed(2)}%</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mx-5 mt-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="iq-label">Watchlist · {filtered.length}</span>
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-black/30">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors border-none cursor-pointer"
                style={filter === f ? { background: 'rgba(134,239,172,0.15)', color: '#86efac' } : { color: 'rgba(255,255,255,0.35)' }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-[22px] border border-white/5 bg-white/3 overflow-hidden divide-y divide-white/5">
          {filtered.map(h => {
            const mktCurrency = h.market === 'IL' ? 'ILS' : 'USD'
            const price = h._metrics?.effectiveCurrentPrice ?? h.price ?? 0
            const dayColor = h.dayChange > 0 ? '#22c55e' : h.dayChange < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)'
            const spark = sparklinePoints(h.ticker.charCodeAt(0) * 7 + h.ticker.length * 3)
            const sparkColor = h.dayChange >= 0 ? '#22c55e' : '#ef4444'
            return (
              <button key={h.ticker} onClick={() => onSelectHolding(h)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-0 text-left hover:bg-white/3 transition-colors cursor-pointer">
                <div style={{ padding: 2, borderRadius: '50%', border: '1px solid rgba(134,239,172,0.3)', display: 'inline-flex' }}>
                  <Logo ticker={h.ticker} size={34} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-semibold text-[14px] tracking-tight">{displaySymbol(h.ticker)}</span>
                    <MarketBadge market={h.market} />
                  </div>
                  <div className="text-[11px] mt-0.5 truncate" style={{ color: '#71717a' }}>{h.name}</div>
                </div>
                <Sparkline data={spark} color={sparkColor} width={48} height={20} />
                <div className="text-right min-w-[72px]">
                  <div className="text-white font-semibold text-[14px] tabular-nums">
                    {price ? formatCurrencyPrecise(h.market === 'IL' ? price / 100 : price, mktCurrency) : '—'}
                  </div>
                  <div className="text-[12px] font-medium tabular-nums" style={{ color: dayColor }}>
                    {h.dayChange === 0 ? '—' : `${h.dayChange > 0 ? '+' : ''}${h.dayChange.toFixed(2)}%`}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
