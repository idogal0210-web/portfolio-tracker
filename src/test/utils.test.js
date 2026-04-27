import { describe, it, test, expect, beforeEach } from 'vitest'
import {
  isILStock,
  isCrypto,
  getMarket,
  displaySymbol,
  formatCurrency,
  calculateTotals,
  calculateAllTimeReturn,
  loadHoldings,
  saveHoldings,
  loadPricesCache,
  savePricesCache,
  calculateHoldingMetrics,
  convertAmount,
  calculateMonthlyTotals,
  aggregateByCategory,
  groupTransactionsByDate,
  calculateMonthlyTrend,
  budgetProgress,
  materializeRecurring,
  toCSV,
  cacheLoad,
  cacheSave,
  cacheClearAll,
  newId,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
} from '../utils'

describe('isILStock', () => {
  it('returns true for .TA suffix', () => {
    expect(isILStock('TEVA.TA')).toBe(true)
  })
  it('returns true for lowercase .ta suffix', () => {
    expect(isILStock('teva.ta')).toBe(true)
  })
  it('returns false for US stock', () => {
    expect(isILStock('AAPL')).toBe(false)
  })
  it('returns false for empty string', () => {
    expect(isILStock('')).toBe(false)
  })
})

describe('isCrypto', () => {
  it('returns true for -USD suffix', () => {
    expect(isCrypto('BTC-USD')).toBe(true)
  })
  it('returns true for lowercase -usd suffix', () => {
    expect(isCrypto('eth-usd')).toBe(true)
  })
  it('returns false for plain US stock', () => {
    expect(isCrypto('AAPL')).toBe(false)
  })
})

describe('getMarket', () => {
  it('classifies crypto', () => {
    expect(getMarket('BTC-USD')).toBe('CRYPTO')
  })
  it('classifies IL', () => {
    expect(getMarket('ELBT.TA')).toBe('IL')
  })
  it('defaults to US', () => {
    expect(getMarket('AAPL')).toBe('US')
  })
})

describe('displaySymbol', () => {
  it('strips -USD suffix', () => {
    expect(displaySymbol('BTC-USD')).toBe('BTC')
  })
  it('leaves plain tickers unchanged', () => {
    expect(displaySymbol('AAPL')).toBe('AAPL')
    expect(displaySymbol('ELBT.TA')).toBe('ELBT.TA')
  })
})

describe('formatCurrency', () => {
  it('formats USD amounts with $ prefix', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,235')
  })
  it('formats ILS amounts with ₪ prefix', () => {
    expect(formatCurrency(45678, 'ILS')).toBe('₪45,678')
  })
  it('formats zero correctly', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0')
  })
})

describe('calculateTotals', () => {
  const exchangeRate = 3.7

  const holdings = [
    { symbol: 'AAPL', shares: 10, avgPrice: 180 },
    { symbol: 'TEVA.TA', shares: 100, avgPrice: 80 },
  ]

  const prices = {
    AAPL: { regularMarketPrice: 190, regularMarketChangePercent: 1.0, longName: 'Apple Inc.' },
    'TEVA.TA': { regularMarketPrice: 90, regularMarketChangePercent: -0.5, longName: 'Teva Pharmaceutical' },
  }

  it('calculates total USD correctly', () => {
    const result = calculateTotals(holdings, prices, exchangeRate)
    // AAPL: 10 * 190 = 1900 USD
    // TEVA.TA: 100 * 90 = 9000 ILS → 9000 / 3.7 ≈ 2432.43 USD
    expect(result.totalUSD).toBeCloseTo(1900 + 9000 / 3.7, 1)
  })

  it('calculates total ILS as totalUSD * exchangeRate', () => {
    const result = calculateTotals(holdings, prices, exchangeRate)
    expect(result.totalILS).toBeCloseTo(result.totalUSD * exchangeRate, 1)
  })

  it('calculates US and IL percentages that sum to 100', () => {
    const result = calculateTotals(holdings, prices, exchangeRate)
    expect(result.usPct + result.ilPct).toBeCloseTo(100, 0)
  })

  it('classifies crypto holdings into cryptoValueUSD', () => {
    const mixed = [
      { symbol: 'AAPL', shares: 10, purchasePrice: 150 },
      { symbol: 'BTC-USD', shares: 0.5, purchasePrice: 40000 },
    ]
    const mixedPrices = {
      AAPL: { regularMarketPrice: 200, regularMarketChangePercent: 0 },
      'BTC-USD': { regularMarketPrice: 60000, regularMarketChangePercent: 0 },
    }
    const result = calculateTotals(mixed, mixedPrices, exchangeRate)
    expect(result.usValueUSD).toBeCloseTo(2000)
    expect(result.cryptoValueUSD).toBeCloseTo(30000)
    expect(result.cryptoPct + result.usPct + result.ilPct).toBeCloseTo(100, 0)
  })

  it('calculates gainUSD from today change', () => {
    const result = calculateTotals(holdings, prices, exchangeRate)
    // AAPL gain: 10 * 190 * 0.01 = 19 USD
    // TEVA gain: 100 * 90 * (-0.005) / 3.7 ≈ -1.216 USD
    expect(result.gainUSD).toBeCloseTo(19 + (100 * 90 * -0.005) / 3.7, 1)
  })

  it('returns zeros when prices map is empty', () => {
    const result = calculateTotals(holdings, {}, exchangeRate)
    expect(result.totalUSD).toBe(0)
    expect(result.gainUSD).toBe(0)
  })
})

describe('LocalStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loadHoldings returns [] when nothing stored', () => {
    expect(loadHoldings()).toEqual([])
  })

  it('saveHoldings + loadHoldings round-trips data', () => {
    const data = [{ symbol: 'AAPL', shares: 5, avgPrice: 150 }]
    saveHoldings(data)
    expect(loadHoldings()).toEqual([{
      symbol: 'AAPL',
      shares: 5,
      purchasePrice: 150,
      fees: 0,
      dividends: 0,
      purchaseDate: '',
    }])
  })

  it('loadHoldings returns [] on corrupt JSON', () => {
    localStorage.setItem('mystock_holdings', 'not-json')
    expect(loadHoldings()).toEqual([])
  })

  it('loadPricesCache returns null when nothing stored', () => {
    expect(loadPricesCache()).toBeNull()
  })

  it('savePricesCache + loadPricesCache round-trips data', () => {
    const cache = { AAPL: { regularMarketPrice: 190 } }
    savePricesCache(cache)
    expect(loadPricesCache()).toEqual(cache)
  })
})

describe('calculateHoldingMetrics', () => {
  const baseHolding = {
    symbol: 'AAPL',
    shares: 10,
    purchasePrice: 150,
    fees: 5,
    dividends: 20,
    purchaseDate: '2024-01-01',
  }

  it('calculates adjustedCostBasis as (purchasePrice * shares) + fees', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    expect(result.adjustedCostBasis).toBeCloseTo(1505)
  })

  it('calculates currentValue as currentPrice * shares', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    expect(result.currentValue).toBeCloseTo(1900)
  })

  it('calculates totalReturn as currentValue + dividends - adjustedCostBasis', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    expect(result.totalReturn).toBeCloseTo(415)
  })

  it('calculates roiPct as (totalReturn / adjustedCostBasis) * 100', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    expect(result.roiPct).toBeCloseTo(415 / 1505 * 100, 1)
  })

  it('calculates breakEven as (adjustedCostBasis - dividends) / shares', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    expect(result.breakEven).toBeCloseTo(148.5)
  })

  it('divides both currentPrice and purchasePrice by 100 for .TA stocks', () => {
    const taseHolding = { ...baseHolding, symbol: 'ELBT.TA', purchasePrice: 15000 }
    const result = calculateHoldingMetrics(taseHolding, 19000)
    expect(result.adjustedCostBasis).toBeCloseTo(1505)
    expect(result.currentValue).toBeCloseTo(1900)
  })

  it('returns roiPct = 0 when adjustedCostBasis is 0', () => {
    const zeroCost = { ...baseHolding, purchasePrice: 0, fees: 0, dividends: 0 }
    const result = calculateHoldingMetrics(zeroCost, 190)
    expect(result.roiPct).toBe(0)
  })

  it('defaults fees and dividends to 0 if missing', () => {
    const minimal = { symbol: 'AAPL', shares: 10, purchasePrice: 150 }
    const result = calculateHoldingMetrics(minimal, 190)
    expect(result.adjustedCostBasis).toBeCloseTo(1500)
    expect(result.totalReturn).toBeCloseTo(400)
  })

  test('returns zeros when shares is missing', () => {
    const noShares = { symbol: 'AAPL', purchasePrice: 150 }
    const result = calculateHoldingMetrics(noShares, 190)
    expect(result.currentValue).toBe(0)
    expect(result.adjustedCostBasis).toBe(0)
  })
})

describe('calculateAllTimeReturn', () => {
  const exchangeRate = 3.7
  const holdings = [
    { symbol: 'AAPL', shares: 10, purchasePrice: 150, fees: 0, dividends: 0 },
  ]
  const prices = {
    AAPL: { regularMarketPrice: 200, regularMarketChangePercent: 0 },
  }

  it('computes total return and % from cost basis', () => {
    const result = calculateAllTimeReturn(holdings, prices, exchangeRate)
    expect(result.totalReturnUSD).toBeCloseTo(500)
    expect(result.pct).toBeCloseTo((500 / 1500) * 100, 1)
  })

  it('returns 0% when cost basis is 0', () => {
    const result = calculateAllTimeReturn([], {}, exchangeRate)
    expect(result.pct).toBe(0)
    expect(result.totalReturnUSD).toBe(0)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Income / Expense feature
// ────────────────────────────────────────────────────────────────────────────

describe('convertAmount', () => {
  it('passes through when currencies match', () => {
    expect(convertAmount(100, 'USD', 'USD', 3.7)).toBe(100)
    expect(convertAmount(100, 'ILS', 'ILS', 3.7)).toBe(100)
  })
  it('USD → ILS multiplies by rate', () => {
    expect(convertAmount(100, 'USD', 'ILS', 3.7)).toBeCloseTo(370)
  })
  it('ILS → USD divides by rate', () => {
    expect(convertAmount(370, 'ILS', 'USD', 3.7)).toBeCloseTo(100)
  })
  it('returns 0 when rate is 0', () => {
    expect(convertAmount(100, 'USD', 'ILS', 0)).toBe(0)
  })
  it('returns 0 for non-finite amount', () => {
    expect(convertAmount(NaN, 'USD', 'ILS', 3.7)).toBe(0)
  })
})

describe('newId', () => {
  it('returns a non-empty string', () => {
    const id = newId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(5)
  })
  it('returns unique values across calls', () => {
    expect(newId()).not.toBe(newId())
  })
})

describe('Categories', () => {
  it('INCOME_CATEGORIES contains Salary and Other', () => {
    expect(INCOME_CATEGORIES).toContain('Salary')
    expect(INCOME_CATEGORIES).toContain('Other')
  })
  it('EXPENSE_CATEGORIES contains Housing and Other', () => {
    expect(EXPENSE_CATEGORIES).toContain('Housing')
    expect(EXPENSE_CATEGORIES).toContain('Other')
  })
  it('arrays are frozen', () => {
    expect(Object.isFrozen(INCOME_CATEGORIES)).toBe(true)
    expect(Object.isFrozen(EXPENSE_CATEGORIES)).toBe(true)
  })
})

describe('calculateMonthlyTotals', () => {
  const rate = 3.7
  const txns = [
    { type: 'INCOME',  amount: 100, currency: 'USD', category: 'Salary',     date: '2026-04-15' },
    { type: 'EXPENSE', amount: 200, currency: 'USD', category: 'Food',       date: '2026-04-20' },
    { type: 'EXPENSE', amount: 370, currency: 'ILS', category: 'Transport',  date: '2026-04-25' },
    { type: 'INCOME',  amount: 50,  currency: 'USD', category: 'Bonus',      date: '2026-03-15' },
  ]

  it('filters by year/month and converts to USD', () => {
    const r = calculateMonthlyTotals(txns, 2026, 4, 'USD', rate)
    expect(r.income).toBeCloseTo(100)
    expect(r.expenses).toBeCloseTo(200 + 100)
    expect(r.net).toBeCloseTo(100 - 300)
    expect(r.count).toBe(3)
  })
  it('converts to ILS correctly', () => {
    const r = calculateMonthlyTotals(txns, 2026, 4, 'ILS', rate)
    expect(r.income).toBeCloseTo(370)
    expect(r.expenses).toBeCloseTo(740 + 370)
  })
  it('returns zeros for an empty month', () => {
    const r = calculateMonthlyTotals(txns, 2025, 1, 'USD', rate)
    expect(r.income).toBe(0)
    expect(r.expenses).toBe(0)
    expect(r.net).toBe(0)
    expect(r.count).toBe(0)
  })
  it('handles empty input', () => {
    const r = calculateMonthlyTotals([], 2026, 4, 'USD', rate)
    expect(r.net).toBe(0)
  })
  it('zero-pads month for prefix match', () => {
    const r = calculateMonthlyTotals(
      [{ type: 'INCOME', amount: 10, currency: 'USD', date: '2026-09-01' }],
      2026, 9, 'USD', rate,
    )
    expect(r.income).toBe(10)
  })
})

describe('aggregateByCategory', () => {
  const rate = 3.7
  const txns = [
    { type: 'EXPENSE', amount: 100, currency: 'USD', category: 'Food',     date: '2026-04-01' },
    { type: 'EXPENSE', amount: 200, currency: 'USD', category: 'Food',     date: '2026-04-02' },
    { type: 'EXPENSE', amount: 50,  currency: 'USD', category: 'Housing',  date: '2026-04-03' },
    { type: 'INCOME',  amount: 999, currency: 'USD', category: 'Salary',   date: '2026-04-04' },
  ]

  it('sums by category and sorts desc', () => {
    const r = aggregateByCategory(txns, 'EXPENSE', 'USD', rate)
    expect(r).toHaveLength(2)
    expect(r[0].category).toBe('Food')
    expect(r[0].total).toBe(300)
    expect(r[1].category).toBe('Housing')
  })
  it('computes percentages summing to 100', () => {
    const r = aggregateByCategory(txns, 'EXPENSE', 'USD', rate)
    const sumPct = r.reduce((s, x) => s + x.pct, 0)
    expect(sumPct).toBeCloseTo(100)
  })
  it('only includes the requested type', () => {
    const r = aggregateByCategory(txns, 'INCOME', 'USD', rate)
    expect(r).toHaveLength(1)
    expect(r[0].category).toBe('Salary')
  })
  it('returns [] for empty input', () => {
    expect(aggregateByCategory([], 'EXPENSE', 'USD', rate)).toEqual([])
  })
})

describe('groupTransactionsByDate', () => {
  it('groups by date with desc order', () => {
    const txns = [
      { id: 'a', date: '2026-04-10', createdAt: 1 },
      { id: 'b', date: '2026-04-11', createdAt: 2 },
      { id: 'c', date: '2026-04-10', createdAt: 5 },
    ]
    const r = groupTransactionsByDate(txns)
    expect(r).toHaveLength(2)
    expect(r[0].date).toBe('2026-04-11')
    expect(r[1].date).toBe('2026-04-10')
    expect(r[1].items.map(t => t.id)).toEqual(['c', 'a'])
  })
  it('handles empty input', () => {
    expect(groupTransactionsByDate([])).toEqual([])
  })
})

describe('calculateMonthlyTrend', () => {
  const rate = 3.7
  const today = new Date(2026, 3, 15) // April 15, 2026
  const txns = [
    { type: 'INCOME',  amount: 100, currency: 'USD', date: '2026-04-01' },
    { type: 'EXPENSE', amount: 30,  currency: 'USD', date: '2026-04-05' },
    { type: 'INCOME',  amount: 50,  currency: 'USD', date: '2026-02-10' },
  ]

  it('returns N entries in chronological order', () => {
    const r = calculateMonthlyTrend(txns, 6, 'USD', rate, today)
    expect(r).toHaveLength(6)
    expect(r[r.length - 1]).toMatchObject({ year: 2026, month: 4 })
    expect(r[0]).toMatchObject({ year: 2025, month: 11 })
  })
  it('correctly computes net per month', () => {
    const r = calculateMonthlyTrend(txns, 6, 'USD', rate, today)
    const apr = r.find(x => x.month === 4)
    expect(apr.net).toBeCloseTo(70)
    const feb = r.find(x => x.month === 2)
    expect(feb.net).toBeCloseTo(50)
  })
})

describe('budgetProgress', () => {
  const rate = 3.7
  const txns = [
    { type: 'EXPENSE', amount: 100, currency: 'USD', category: 'Food', date: '2026-04-01' },
    { type: 'EXPENSE', amount: 50,  currency: 'USD', category: 'Food', date: '2026-04-15' },
    { type: 'EXPENSE', amount: 80,  currency: 'USD', category: 'Food', date: '2026-03-10' },
  ]

  it('counts only the target month and category', () => {
    const r = budgetProgress(
      { category: 'Food', amount: 200, currency: 'USD' },
      txns, 2026, 4, 'USD', rate,
    )
    expect(r.spent).toBeCloseTo(150)
    expect(r.limit).toBe(200)
    expect(r.remaining).toBeCloseTo(50)
    expect(r.pct).toBeCloseTo(75)
    expect(r.over).toBe(false)
  })
  it('flags over when spent > limit', () => {
    const r = budgetProgress(
      { category: 'Food', amount: 100, currency: 'USD' },
      txns, 2026, 4, 'USD', rate,
    )
    expect(r.over).toBe(true)
  })
  it('returns 0% when limit is 0', () => {
    const r = budgetProgress(
      { category: 'Food', amount: 0, currency: 'USD' },
      txns, 2026, 4, 'USD', rate,
    )
    expect(r.pct).toBe(0)
    expect(r.over).toBe(false)
  })
})

describe('materializeRecurring', () => {
  const baseTpl = {
    id: 't1',
    user_id: 'u1',
    type: 'EXPENSE',
    amount: 1000,
    currency: 'ILS',
    category: 'Housing',
    note: 'Rent',
    cadence: 'MONTHLY',
    start_date: '2026-01-15',
    last_materialized_date: null,
    active: true,
  }

  it('emits one txn per month from start through today', () => {
    const r = materializeRecurring([baseTpl], '2026-04-20')
    expect(r.newTxns).toHaveLength(4)
    expect(r.newTxns.map(t => t.date)).toEqual([
      '2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15',
    ])
    expect(r.updatedTemplates).toHaveLength(1)
    expect(r.updatedTemplates[0].last_materialized_date).toBe('2026-04-15')
  })

  it('is idempotent — second run produces no new txns', () => {
    const r1 = materializeRecurring([baseTpl], '2026-04-20')
    const updatedTpl = r1.updatedTemplates[0]
    const r2 = materializeRecurring([updatedTpl], '2026-04-20')
    expect(r2.newTxns).toHaveLength(0)
    expect(r2.updatedTemplates).toHaveLength(0)
  })

  it('continues from last_materialized_date', () => {
    const tpl = { ...baseTpl, last_materialized_date: '2026-02-15' }
    const r = materializeRecurring([tpl], '2026-04-20')
    expect(r.newTxns.map(t => t.date)).toEqual(['2026-03-15', '2026-04-15'])
  })

  it('skips inactive templates', () => {
    const tpl = { ...baseTpl, active: false }
    const r = materializeRecurring([tpl], '2026-04-20')
    expect(r.newTxns).toHaveLength(0)
  })

  it('handles YEARLY cadence', () => {
    const tpl = { ...baseTpl, cadence: 'YEARLY', start_date: '2024-03-10', amount: 500 }
    const r = materializeRecurring([tpl], '2026-04-20')
    expect(r.newTxns.map(t => t.date)).toEqual(['2024-03-10', '2025-03-10', '2026-03-10'])
  })

  it('clamps day-of-month for shorter months without drifting', () => {
    const tpl = { ...baseTpl, start_date: '2026-01-31' }
    const r = materializeRecurring([tpl], '2026-05-15')
    // Feb has 28 days in 2026 (not leap); subsequent months re-anchor to day 31.
    expect(r.newTxns.map(t => t.date)).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
    ])
  })

  it('emits transactions tagged with template id', () => {
    const r = materializeRecurring([baseTpl], '2026-01-20')
    expect(r.newTxns[0].recurring_template_id).toBe('t1')
    expect(r.newTxns[0].note).toContain('(recurring)')
  })
})

describe('toCSV', () => {
  const rate = 3.7
  const txns = [
    { type: 'INCOME',  amount: 100, currency: 'USD', category: 'Salary', date: '2026-04-01', note: 'paycheck' },
    { type: 'EXPENSE', amount: 50,  currency: 'USD', category: 'Food',   date: '2026-04-02', note: 'pizza, soda' },
  ]

  it('emits a header row and one row per transaction', () => {
    const csv = toCSV(txns, 'USD', rate)
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('date')
    expect(lines[0]).toContain('amount_usd')
  })
  it('quotes fields containing commas', () => {
    const csv = toCSV(txns, 'USD', rate)
    expect(csv).toContain('"pizza, soda"')
  })
  it('signs expenses negative in the converted column', () => {
    const csv = toCSV(txns, 'USD', rate)
    expect(csv).toContain(',-50.00,')
    expect(csv).toContain(',100.00,')
  })
  it('handles empty input — header only', () => {
    const csv = toCSV([], 'USD', rate)
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(1)
  })
})

describe('Namespaced cache helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('cacheLoad returns fallback when nothing stored', () => {
    expect(cacheLoad('u1', 'transactions', [])).toEqual([])
  })

  it('cacheSave + cacheLoad round-trips data', () => {
    cacheSave('u1', 'transactions', [{ id: 'a', amount: 5 }])
    expect(cacheLoad('u1', 'transactions', [])).toEqual([{ id: 'a', amount: 5 }])
  })

  it('isolates data per user', () => {
    cacheSave('u1', 'transactions', [{ id: 'a' }])
    cacheSave('u2', 'transactions', [{ id: 'b' }])
    expect(cacheLoad('u1', 'transactions', [])).toEqual([{ id: 'a' }])
    expect(cacheLoad('u2', 'transactions', [])).toEqual([{ id: 'b' }])
  })

  it('returns fallback when userId is missing', () => {
    cacheSave(null, 'transactions', [{ id: 'a' }])
    expect(cacheLoad(null, 'transactions', [])).toEqual([])
  })

  it('cacheClearAll wipes all kinds for a user', () => {
    cacheSave('u1', 'transactions', [{ id: 'a' }])
    cacheSave('u1', 'budgets', [{ category: 'Food' }])
    cacheClearAll('u1')
    expect(cacheLoad('u1', 'transactions', null)).toBeNull()
    expect(cacheLoad('u1', 'budgets', null)).toBeNull()
  })

  it('cacheLoad survives corrupt JSON', () => {
    localStorage.setItem('mystock_u_u1_transactions', 'not-json')
    expect(cacheLoad('u1', 'transactions', [])).toEqual([])
  })
})
