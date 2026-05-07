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
        <div style={{
          margin: '0 20px 12px',
          fontSize: '11px',
          color: '#fbbf24',
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: '16px',
          padding: '8px 16px',
        }}>
          ⚠ Could not fetch live prices — showing cached data.
        </div>
      )}

      {/* Net Worth */}
      <section style={{ textAlign: 'center', padding: '8px 20px 20px' }}>
        <h2 style={{
          fontSize: '8px', textTransform: 'uppercase',
          letterSpacing: '0.5em', color: '#D4AF37', marginBottom: '10px',
        }}>Total Net Worth</h2>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
          <span style={{
            fontWeight: 200, letterSpacing: '-0.03em',
            fontSize: 'clamp(40px, 10vw, 56px)', color: '#fff', lineHeight: 1,
          }}>
            {formatCurrency(netWorth, currency).replace(/^[₪$]/, '')}
          </span>
          <span style={{ fontSize: '16px', fontWeight: 300, color: 'rgba(255,255,255,0.35)', marginLeft: '4px' }}>
            {currency}
          </span>
        </div>
      </section>

      {/* Inflow / Outflow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '0 20px 16px' }}>
        {/* Inflow */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '28px', padding: '18px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '60px', height: '60px',
            background: 'rgba(34,197,94,0.05)',
            borderRadius: '50%', filter: 'blur(18px)',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M7 17L17 7M17 7H7M17 7v10" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)' }}>Inflow</span>
          </div>
          <div style={{ fontSize: '18px', color: '#fff', fontWeight: 300, letterSpacing: '-0.5px' }}>
            {formatCurrency(periodTotals.income, currency)}
          </div>
        </div>

        {/* Outflow */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '28px', padding: '18px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '60px', height: '60px',
            background: 'rgba(239,68,68,0.05)',
            borderRadius: '50%', filter: 'blur(18px)',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M17 7L7 17M7 17h10M7 17V7" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)' }}>Outflow</span>
          </div>
          <div style={{ fontSize: '18px', color: '#fff', fontWeight: 300, letterSpacing: '-0.5px' }}>
            {formatCurrency(Math.abs(periodTotals.expenses), currency)}
          </div>
        </div>
      </div>

      {/* Private Insights */}
      <section style={{ margin: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <h2 style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.22)' }}>
            Hi {(displayName || 'You').toUpperCase()}, Private Insights
          </h2>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="2" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8"/>
            <rect x="14" y="2" width="8" height="8" rx="2" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8"/>
            <rect x="2" y="14" width="8" height="8" rx="2" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8"/>
            <rect x="14" y="14" width="8" height="8" rx="2" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8"/>
          </svg>
        </div>

        {/* Portfolio Returns */}
        <div style={{
          padding: '16px 18px',
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,255,255,0.03)',
          borderRadius: '16px',
          display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
            border: '1px solid rgba(212,175,55,0.2)',
            background: 'rgba(212,175,55,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <polyline points="3,17 7,11 11,14 17,7 21,10" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', display: 'block', textTransform: 'uppercase', marginBottom: '3px' }}>
              Portfolio Returns
            </span>
            <span style={{
              fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em',
              fontWeight: 600, color: allTimePct >= 0 ? '#22c55e' : '#f43f5e',
            }}>
              {allTimePct >= 0 ? '+' : ''}{allTimePct.toFixed(2)}%{' '}
              <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>ALL-TIME</span>
            </span>
          </div>
        </div>

        {/* Monthly Net Flow */}
        <div style={{
          padding: '16px 18px',
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,255,255,0.03)',
          borderRadius: '16px',
          display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
            border: '1px solid rgba(34,197,94,0.2)',
            background: 'rgba(34,197,94,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#22c55e" strokeWidth="1.8" />
              <path d="M9 12l2 2 4-4" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', display: 'block', textTransform: 'uppercase', marginBottom: '3px' }}>
              Monthly Net Flow
            </span>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              {periodTotals.net >= 0 ? 'Saved ' : 'Spent '}
              {formatCurrency(Math.abs(periodTotals.net), currency)} this month
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
