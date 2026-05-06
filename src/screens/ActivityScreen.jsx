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
      <div className="px-5 pt-3 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[26px] font-bold tracking-tight leading-none">CASHFLOW</div>
            <div className="text-[13px] mt-0.5" style={{ color: '#71717a' }}>INCOME &amp; EXPENSES</div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="relative">
              <button onClick={() => setShowOverflow(v => !v)}
                className="pressable w-8 h-8 rounded-xl border border-white/8 bg-white/4 flex items-center justify-center text-white/50 text-[16px] cursor-pointer">
                ⋯
              </button>
              {showOverflow && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowOverflow(false)} />
                  <div className="absolute right-0 top-10 z-20 bg-[#1a1a1c] rounded-2xl border border-white/10 shadow-xl overflow-hidden min-w-[160px]">
                    {[['Manage budgets', onOpenBudgets], ['Recurring', onOpenRecurring], ['Export CSV', onExportCsv]].map(([lbl, fn]) => (
                      <button key={lbl} onClick={() => { fn(); setShowOverflow(false) }}
                        className="w-full px-4 py-3 text-left text-[13px] font-medium text-white/80 hover:bg-white/5 border-b border-white/5 border-x-0 border-t-0 last:border-0 bg-transparent cursor-pointer">
                        {lbl}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <button onClick={prevMonth} className="pressable w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60 border-none cursor-pointer">
            <svg width="8" height="14" viewBox="0 0 10 18" fill="none"><path d="M8 2L2 9l6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="text-[13px] font-bold tracking-widest uppercase" style={{ color: '#86efac' }}>
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </span>
          <button onClick={nextMonth} className="pressable w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60 border-none cursor-pointer">
            <svg width="8" height="14" viewBox="0 0 10 18" fill="none"><path d="M2 2l6 7-6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {trend.some(t => t.net !== 0) && (
        <div className="mx-5 mt-2">
          <div className="glass-card-small p-4">
            <div className="iq-label mb-2">6-month net flow</div>
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

      <div className="mx-5 mt-3">
        <div className="glass-card p-5">
          <div className="grid grid-cols-3 gap-0">
            {[
              ['Income', totals.income, '#22c55e'],
              ['Expenses', totals.expenses, '#f43f5e'],
              ['Net', totals.net, netColor],
            ].map(([lbl, val, clr]) => (
              <div key={lbl} className={lbl !== 'Income' ? 'border-l border-white/5 pl-3' : ''}>
                <div className="iq-label mb-1" style={lbl !== 'Net' ? { color: '#52525b' } : {}}>{lbl}</div>
                <div className="text-[17px] font-bold tabular-nums tracking-tight" style={{ color: clr }}>
                  {lbl === 'Expenses' ? '−' : ''}{formatCurrency(Math.abs(val), currency)}
                </div>
              </div>
            ))}
          </div>
          {totals.income > 0 && (() => {
            const savingsRate = ((totals.income - Math.abs(totals.expenses)) / totals.income) * 100
            const srColor = savingsRate >= 20 ? '#22c55e' : savingsRate >= 0 ? '#f59e0b' : '#f43f5e'
            return (
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <div>
                  <div className="iq-label mb-0.5" style={{ color: '#52525b' }}>Savings rate</div>
                  <div className="text-[11px] text-white/35">
                    {savingsRate >= 20 ? 'On track' : savingsRate >= 0 ? 'Could improve' : 'Over budget'}
                  </div>
                </div>
                <div className="text-[28px] font-bold tabular-nums tracking-tight" style={{ color: srColor }}>
                  {savingsRate.toFixed(0)}%
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {catSlices.length > 0 && (
        <div className="mx-5 mt-3">
          <div className="glass-card-small p-4">
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-3">
              {['EXPENSE', 'INCOME'].map(t => (
                <button key={t} onClick={() => setCatTab(t)}
                  className="pressable flex-1 h-8 rounded-lg text-[11px] font-bold transition-colors border-none cursor-pointer"
                  style={catTab === t ? { background: 'rgba(134,239,172,0.15)', color: '#86efac' } : { color: 'rgba(255,255,255,0.35)', background: 'transparent' }}>
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

      {grouped.length > 0 ? (
        <div className="mx-5 mt-4 space-y-3 stagger">
          {grouped.map(g => (
            <div key={g.date}>
              <div className="iq-label mb-1.5 px-1" style={{ color: '#52525b' }}>
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
          <div className="iq-label mb-2" style={{ color: '#52525b' }}>Activity</div>
          <div className="text-[14px] font-light text-white/60">No transactions this month</div>
          <div className="text-[12px] mt-1" style={{ color: '#52525b' }}>Tap + to add your first</div>
        </div>
      )}
    </div>
  )
}
