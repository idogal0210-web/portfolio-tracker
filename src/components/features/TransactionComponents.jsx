import { convertAmount, formatCurrency } from '../../utils/formatters'
import { categoryColor, CATEGORY_EMOJI } from '../../utils/constants'

export function CategoryIcon({ category, type, size = 40 }) {
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

export function MonthSparkline({ trend, width = 350, height = 60 }) {
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

export function TransactionRow({ txn, displayCurrency, exchangeRate, onClick }) {
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
