import { useState, useMemo } from 'react'
import { displaySymbol, formatCurrencyPrecise } from '../utils'
import { Logo, MarketBadge, Sparkline, sparklinePoints } from '../components/ui'

export function MarketsScreen({ enriched, onSelectHolding }) {
  const [filter, setFilter] = useState('ALL')
  const filters = ['ALL', 'US', 'IL', 'CRYPTO']

  const filtered = useMemo(() => {
    const list = [...enriched].sort((a, b) => {
      const va = a._metrics?.currentValue ?? 0
      const vb = b._metrics?.currentValue ?? 0
      return vb - va
    })
    return filter === 'ALL' ? list : list.filter(h => h.market === filter)
  }, [enriched, filter])

  const gainers = useMemo(
    () => [...enriched].filter(h => h.dayChange > 0).sort((a, b) => b.dayChange - a.dayChange).slice(0, 3),
    [enriched]
  )
  const losers = useMemo(
    () => [...enriched].filter(h => h.dayChange < 0).sort((a, b) => a.dayChange - b.dayChange).slice(0, 3),
    [enriched]
  )

  if (!enriched.length) {
    return (
      <div className="flex flex-col items-center justify-center" style={{
        height: '100%',
        paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
      }}>
        <div className="text-center px-8">
          <div className="mb-5 flex items-center justify-center">
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              border: '1px solid rgba(134,239,172,0.3)',
              background: 'rgba(134,239,172,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 17l4-4 4 4 7-7 3 3" stroke="#86efac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="iq-label mb-3">Markets</div>
          <div className="text-[16px] font-light text-white/70">No holdings yet</div>
          <div className="text-[12px] mt-2" style={{ color: '#52525b' }}>Add holdings to see market data</div>
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
      {(gainers.length > 0 || losers.length > 0) && (
        <div className="mx-5 mt-4 grid grid-cols-2 gap-3">
          {gainers.length > 0 && (
            <div className="glass-card-small p-3">
              <div className="iq-label mb-2">Top gainers</div>
              {gainers.map(h => (
                <button key={h.ticker} onClick={() => onSelectHolding(h)}
                  className="pressable w-full flex items-center gap-2 py-1.5 bg-transparent border-0 text-left cursor-pointer text-white">
                  <Logo ticker={h.ticker} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate">{displaySymbol(h.ticker)}</div>
                  </div>
                  <div className="text-[12px] font-bold tabular-nums" style={{ color: '#22c55e' }}>
                    +{h.dayChange.toFixed(2)}%
                  </div>
                </button>
              ))}
            </div>
          )}
          {losers.length > 0 && (
            <div className="glass-card-small p-3">
              <div className="iq-label mb-2">Top losers</div>
              {losers.map(h => (
                <button key={h.ticker} onClick={() => onSelectHolding(h)}
                  className="pressable w-full flex items-center gap-2 py-1.5 bg-transparent border-0 text-left cursor-pointer text-white">
                  <Logo ticker={h.ticker} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate">{displaySymbol(h.ticker)}</div>
                  </div>
                  <div className="text-[12px] font-bold tabular-nums" style={{ color: '#f43f5e' }}>
                    {h.dayChange.toFixed(2)}%
                  </div>
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
                style={filter === f ? { background: 'rgba(134,239,172,0.15)', color: '#86efac' } : { color: 'rgba(255,255,255,0.35)', background: 'transparent' }}>
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
                className="pressable w-full flex items-center gap-3 px-4 py-3 bg-transparent border-0 text-left hover:bg-white/3 transition-colors cursor-pointer text-white">
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
