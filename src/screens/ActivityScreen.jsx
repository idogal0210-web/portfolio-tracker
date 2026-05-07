import { useState, useMemo } from 'react'
import {
  calculateMonthlyTotals, aggregateByCategory, groupTransactionsByDate,
  calculateMonthlyTrend, budgetProgress, convertAmount, formatCurrency,
  formatDateLabel, MONTH_NAMES, EXPENSE_CATEGORIES, INCOME_CATEGORIES
} from '../utils'
import { AllocationBar } from '../components/ui'
import { MonthSparkline, TransactionRow } from '../components/features'

export function ActivityScreen({
  transactions, budgets, currency, exchangeRate,
  onOpenBudgets, onOpenRecurring, onEditTxn, onSaveTxn, onExportCsv,
}) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [catTab, setCatTab] = useState('EXPENSE')
  const [showOverflow, setShowOverflow] = useState(false)

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

      {/* Header */}
      <div style={{ padding: '12px 20px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '-0.5px', textTransform: 'uppercase', color: '#fff' }}>
              CASHFLOW
            </div>
            <div style={{ fontSize: '7px', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginTop: '3px' }}>
              Income &amp; Expenses
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowOverflow(v => !v)}
                className="pressable"
                style={{
                  width: '32px', height: '32px', borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.4)', fontSize: '16px', cursor: 'pointer',
                }}
              >
                ⋯
              </button>
              {showOverflow && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowOverflow(false)} />
                  <div style={{
                    position: 'absolute', right: 0, top: '40px', zIndex: 20,
                    background: '#1a1a1c', borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                    overflow: 'hidden', minWidth: '160px',
                  }}>
                    {[['Manage budgets', onOpenBudgets], ['Recurring', onOpenRecurring], ['Export CSV', onExportCsv]].map(([lbl, fn]) => (
                      <button key={lbl} onClick={() => { fn(); setShowOverflow(false) }}
                        style={{
                          width: '100%', padding: '12px 16px', textAlign: 'left',
                          fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.75)',
                          background: 'transparent', border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Month selector */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: '14px',
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,255,255,0.03)',
          borderRadius: '20px', padding: '10px 14px',
        }}>
          <button onClick={prevMonth} className="pressable" style={{
            width: '30px', height: '30px', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.3)',
          }}>
            <svg width="8" height="14" viewBox="0 0 10 18" fill="none">
              <path d="M8 2L2 9l6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '7px', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: '3px' }}>
              Fiscal Period
            </span>
            <span style={{ fontSize: '10px', color: '#fff', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 300 }}>
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
          </div>
          <button onClick={nextMonth} className="pressable" style={{
            width: '30px', height: '30px', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.3)',
          }}>
            <svg width="8" height="14" viewBox="0 0 10 18" fill="none">
              <path d="M2 2l6 7-6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sparkline */}
      {trend.some(t => t.net !== 0) && (
        <div style={{ margin: '0 20px 12px' }}>
          <div className="glass-card-small" style={{ padding: '16px' }}>
            <div className="iq-label" style={{ marginBottom: '8px' }}>6-month net flow</div>
            <MonthSparkline trend={trend} width={310} height={52} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              {trend.map(p => (
                <span key={`${p.year}-${p.month}`} style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>
                  {MONTH_NAMES[p.month - 1]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Totals card */}
      <div style={{ margin: '0 20px 12px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
            {[
              ['Income', totals.income, '#22c55e'],
              ['Expenses', totals.expenses, '#f43f5e'],
              ['Net', totals.net, netColor],
            ].map(([lbl, val, clr], i) => (
              <div key={lbl} style={i > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '12px' } : {}}>
                <div className="iq-label" style={{ marginBottom: '4px', color: lbl !== 'Net' ? '#52525b' : undefined }}>{lbl}</div>
                <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.5px', color: clr }}>
                  {lbl === 'Expenses' ? '−' : ''}{formatCurrency(Math.abs(val), currency)}
                </div>
              </div>
            ))}
          </div>
          {totals.income > 0 && (() => {
            const savingsRate = ((totals.income - Math.abs(totals.expenses)) / totals.income) * 100
            const srColor = savingsRate >= 20 ? '#22c55e' : savingsRate >= 0 ? '#f59e0b' : '#f43f5e'
            return (
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="iq-label" style={{ marginBottom: '2px', color: '#52525b' }}>Savings rate</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                    {savingsRate >= 20 ? 'On track' : savingsRate >= 0 ? 'Could improve' : 'Over budget'}
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-1px', color: srColor }}>
                  {savingsRate.toFixed(0)}%
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Category breakdown */}
      {catSlices.length > 0 && (
        <div style={{ margin: '0 20px 12px' }}>
          <div className="glass-card-small" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', marginBottom: '12px' }}>
              {['EXPENSE', 'INCOME'].map(t => (
                <button key={t} onClick={() => setCatTab(t)} className="pressable"
                  style={{
                    flex: 1, height: '32px', borderRadius: '10px',
                    fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: catTab === t ? 'rgba(134,239,172,0.12)' : 'transparent',
                    color: catTab === t ? '#86efac' : 'rgba(255,255,255,0.3)',
                  }}>
                  {t === 'EXPENSE' ? 'Expenses' : 'Income'}
                </button>
              ))}
            </div>
            <AllocationBar slices={catSlices.map((s, i) => ({ value: s.pct, color: catColors[i % catColors.length] }))} />
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {catSlices.map((s, i) => {
                const budget = budgets.find(b => b.category === s.category && catTab === 'EXPENSE')
                const progress = budget
                  ? budgetProgress(budget, monthTxns, viewYear, viewMonth, currency, exchangeRate)
                  : null
                return (
                  <div key={s.category}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: catColors[i % catColors.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', flex: 1 }}>{s.category}</span>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{s.pct.toFixed(0)}%</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{formatCurrency(s.total, currency)}</span>
                    </div>
                    {progress && (
                      <div style={{ marginLeft: '16px', marginTop: '4px' }}>
                        <div style={{ height: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '4px', transition: 'width 0.3s',
                            width: `${Math.min(progress.pct, 100)}%`,
                            background: progress.over ? '#f43f5e' : '#22c55e',
                          }} />
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                          {formatCurrency(progress.spent, currency)} of {formatCurrency(progress.limit, currency)}
                          {progress.over && <span style={{ color: '#f43f5e' }}> · over budget</span>}
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
        <div style={{ margin: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="stagger">
          {grouped.map(g => (
            <div key={g.date}>
              <div style={{
                fontSize: '8px', fontWeight: 600, color: 'rgba(255,255,255,0.2)',
                textTransform: 'uppercase', letterSpacing: '0.15em',
                marginBottom: '8px', padding: '0 4px',
              }}>
                {formatDateLabel(g.date)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {g.items.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onEditTxn(t)}
                    className="pressable"
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '13px 15px', borderRadius: '18px',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
                      border: '1px solid rgba(255,255,255,0.03)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
                      <div style={{
                        width: '2px', height: '24px', borderRadius: '2px', flexShrink: 0,
                        background: t.type === 'INCOME' ? '#22c55e' : '#f43f5e',
                      }} />
                      <div>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 500, letterSpacing: '0.03em' }}>
                          {t.category}
                        </div>
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', marginTop: '2px' }}>
                          {t.note || (t.type === 'INCOME' ? 'Income' : 'Expense')}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em',
                      color: t.type === 'INCOME' ? '#22c55e' : '#f43f5e',
                    }}>
                      {t.type === 'INCOME' ? '+' : '−'}{formatCurrency(t.amount, t.currency)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          margin: '0 20px', marginTop: '32px', padding: '24px',
          borderRadius: '22px', border: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.02)', textAlign: 'center',
        }}>
          <div className="iq-label" style={{ color: '#52525b', marginBottom: '8px' }}>Activity</div>
          <div style={{ fontSize: '14px', fontWeight: 300, color: 'rgba(255,255,255,0.5)' }}>No transactions this month</div>
          <div style={{ fontSize: '12px', marginTop: '4px', color: '#52525b' }}>Tap + to add your first</div>
        </div>
      )}
    </div>
  )
}
