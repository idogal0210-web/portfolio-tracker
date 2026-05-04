import { useMemo } from 'react'
import { displaySymbol, formatCurrency } from '../../utils'
import { Logo, Sparkline, MarketBadge, sparklinePoints } from '../ui'

export function HoldingRow({ h, onClick }) {
  const currency = h.market === 'IL' ? 'ILS' : 'USD'
  const metrics = h._metrics
  const spark = useMemo(() => sparklinePoints(h.ticker.charCodeAt(0) * 7 + h.ticker.length * 3), [h.ticker])
  const pl = metrics ? metrics.totalReturn : 0
  const isUp = pl >= 0
  const sparkColor = isUp ? '#22c55e' : '#ef4444'
  const dayColor = h.dayChange > 0 ? '#22c55e' : h.dayChange < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)'
  const display = displaySymbol(h.ticker)

  return (
    <button onClick={onClick}
      className="pressable w-full flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] text-left border-none bg-transparent m-0 appearance-none">
      <div style={{ padding: 2, borderRadius: '50%', border: '1px solid rgba(134,239,172,0.3)', display: 'inline-flex' }}>
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
    </button>
  )
}
