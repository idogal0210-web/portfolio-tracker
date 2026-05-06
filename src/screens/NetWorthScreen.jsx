import { useMemo } from 'react'
import {
  calculateTotals, calculateAllTimeReturn, calculateMonthlyTotals,
  convertAmount, formatCurrency
} from '../utils'

export function NetWorthScreen({ holdings, enriched, prices, exchangeRate, currency, stale, transactions, displayName }) {
  const { totalUSD, totalILS } = calculateTotals(holdings, prices, exchangeRate)
  const { pct: allTimePct } = calculateAllTimeReturn(holdings, prices, exchangeRate)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const periodTotals = useMemo(
    () => calculateMonthlyTotals(transactions, currentYear, currentMonth, currency, exchangeRate),
    [transactions, currentYear, currentMonth, currency, exchangeRate],
  )

  const cashBalance = useMemo(() => {
    return (transactions || []).reduce((sum, t) => {
      const amount = convertAmount(t.amount, t.currency, currency, exchangeRate)
      return t.type === 'INCOME' ? sum + amount : sum - amount
    }, 0)
  }, [transactions, currency, exchangeRate])

  const portfolioValue = currency === 'ILS' ? totalILS : totalUSD
  const netWorth = cashBalance + portfolioValue

  return (
    <div className="overflow-y-auto no-scrollbar" style={{
      height: '100%',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 90px)',
      paddingTop: 'calc(env(safe-area-inset-top) + 64px)',
    }}>

      {stale && (
        <div className="mx-5 mb-3 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-2xl px-4 py-2">
          ⚠ Could not fetch live prices — showing cached data.
        </div>
      )}

      <div className="text-center px-5 pt-2 pb-5">
        <div className="iq-label mb-2">Total Net Worth</div>
        <div className="flex items-baseline justify-center gap-2">
          <span className="tabular-nums leading-none"
            style={{ fontWeight: 200, letterSpacing: '-0.03em', fontSize: 'clamp(40px, 10vw, 64px)' }}>
            {formatCurrency(netWorth, currency).replace(/^[₪$]/, '')}
          </span>
          <span className="text-[18px] font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {currency}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mx-5 mb-4">
        <div className="glass-card-small p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M7 17L17 7M17 7H7M17 7v10" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="iq-label" style={{ color: '#22c55e' }}>Inflow</span>
          </div>
          <div className="text-[22px] font-semibold tabular-nums tracking-tight text-white">
            {formatCurrency(periodTotals.income, currency)}
          </div>
        </div>
        <div className="glass-card-small p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M17 7L7 17M7 17h10M7 17V7" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="iq-label" style={{ color: '#ef4444' }}>Outflow</span>
          </div>
          <div className="text-[22px] font-semibold tabular-nums tracking-tight text-white">
            {formatCurrency(Math.abs(periodTotals.expenses), currency)}
          </div>
        </div>
      </div>

      <div className="mx-5 mb-3">
        <span className="iq-label">Hi {(displayName || 'You').toUpperCase()}, Private Insights</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mx-5 mb-4">
        <div className="glass-card-small p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <polyline points="3,17 7,11 11,14 17,7 21,10" stroke="#86efac" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="iq-label mb-0.5">Portfolio Returns</div>
            <div className="text-[15px] font-bold tabular-nums"
              style={{ color: allTimePct >= 0 ? '#86efac' : '#ef4444' }}>
              {allTimePct >= 0 ? '+' : ''}{allTimePct.toFixed(2)}%{' '}
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>ALL-TIME</span>
            </div>
          </div>
        </div>

        <div className="glass-card-small p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#6366f1" strokeWidth="1.8" />
              <path d="M12 7v5l3 3" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="iq-label mb-0.5">Monthly Net Flow</div>
            <div className="text-[12px] font-semibold leading-snug"
              style={{ color: periodTotals.net >= 0 ? '#86efac' : '#f43f5e' }}>
              {periodTotals.net >= 0 ? 'SAVED ' : 'SPENT '}
              {formatCurrency(Math.abs(periodTotals.net), currency)}
              {' '}<span style={{ color: 'rgba(255,255,255,0.4)' }}>THIS MONTH</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
