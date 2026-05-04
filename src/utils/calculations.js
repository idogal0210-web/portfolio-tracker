import { isILStock, getMarket, convertAmount } from './formatters.js'
import { newId } from './helpers.js'

export const calculateTotals = (holdings, prices, exchangeRate) => {
  let usValueUSD = 0
  let ilValueUSD = 0
  let cryptoValueUSD = 0
  let gainUSD = 0

  for (const holding of holdings) {
    const price = prices[holding.symbol]
    if (!price) continue

    const changeRatio = price.regularMarketChangePercent / 100
    const market = getMarket(holding.symbol)

    if (market === 'IL') {
      const valueILS = holding.shares * price.regularMarketPrice
      const valueUSD = valueILS / exchangeRate
      ilValueUSD += valueUSD
      gainUSD += (holding.shares * price.regularMarketPrice * changeRatio) / exchangeRate
    } else if (market === 'CRYPTO') {
      const valueUSD = holding.shares * price.regularMarketPrice
      cryptoValueUSD += valueUSD
      gainUSD += holding.shares * price.regularMarketPrice * changeRatio
    } else {
      const valueUSD = holding.shares * price.regularMarketPrice
      usValueUSD += valueUSD
      gainUSD += holding.shares * price.regularMarketPrice * changeRatio
    }
  }

  const totalUSD = usValueUSD + ilValueUSD + cryptoValueUSD
  const totalILS = totalUSD * exchangeRate
  const usPct = totalUSD > 0 ? (usValueUSD / totalUSD) * 100 : 0
  const ilPct = totalUSD > 0 ? (ilValueUSD / totalUSD) * 100 : 0
  const cryptoPct = totalUSD > 0 ? (cryptoValueUSD / totalUSD) * 100 : 0

  return {
    totalUSD, totalILS,
    usValueUSD, ilValueUSD, cryptoValueUSD,
    usPct, ilPct, cryptoPct,
    gainUSD,
  }
}

export const calculateAllTimeReturn = (holdings, prices, exchangeRate) => {
  let costBasisUSD = 0
  let currentValueUSD = 0
  let dividendsUSD = 0

  for (const holding of holdings) {
    const price = prices[holding.symbol]
    if (!price) continue
    const metrics = calculateHoldingMetrics(holding, price.regularMarketPrice)
    const market = getMarket(holding.symbol)
    if (market === 'IL') {
      costBasisUSD += metrics.adjustedCostBasis / exchangeRate
      currentValueUSD += metrics.currentValue / exchangeRate
      dividendsUSD += (holding.dividends || 0) / exchangeRate
    } else {
      costBasisUSD += metrics.adjustedCostBasis
      currentValueUSD += metrics.currentValue
      dividendsUSD += holding.dividends || 0
    }
  }

  const totalReturnUSD = currentValueUSD + dividendsUSD - costBasisUSD
  const pct = costBasisUSD > 0 ? (totalReturnUSD / costBasisUSD) * 100 : 0
  return { totalReturnUSD, pct, costBasisUSD }
}

export const calculateHoldingMetrics = (holding, currentApiPrice) => {
  const isTASE = isILStock(holding.symbol)
  const effectiveCurrentPrice = isTASE ? currentApiPrice / 100 : currentApiPrice
  const effectivePurchasePrice = isTASE ? (holding.purchasePrice || 0) / 100 : (holding.purchasePrice || 0)

  const fees = holding.fees || 0
  const dividends = holding.dividends || 0
  const shares = holding.shares || 0

  const adjustedCostBasis = effectivePurchasePrice * shares + fees
  const currentValue = effectiveCurrentPrice * shares
  const totalReturn = currentValue + dividends - adjustedCostBasis
  const roiPct = adjustedCostBasis > 0 ? (totalReturn / adjustedCostBasis) * 100 : 0
  const breakEven = shares > 0 ? (adjustedCostBasis - dividends) / shares : 0

  return { adjustedCostBasis, currentValue, totalReturn, roiPct, breakEven, effectiveCurrentPrice }
}

const monthPrefix = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}-`

export const calculateMonthlyTotals = (
  transactions, year, month, displayCurrency, exchangeRate,
) => {
  const prefix = monthPrefix(year, month)
  let income = 0, expenses = 0, count = 0
  for (const t of transactions || []) {
    if (!t?.date || !t.date.startsWith(prefix)) continue
    const v = convertAmount(t.amount || 0, t.currency, displayCurrency, exchangeRate)
    if (t.type === 'INCOME') income += v
    else if (t.type === 'EXPENSE') expenses += v
    count++
  }
  return { income, expenses, net: income - expenses, count }
}

export const aggregateByCategory = (
  transactions, type, displayCurrency, exchangeRate,
) => {
  const sums = new Map()
  for (const t of transactions || []) {
    if (t?.type !== type) continue
    const v = convertAmount(t.amount || 0, t.currency, displayCurrency, exchangeRate)
    sums.set(t.category, (sums.get(t.category) || 0) + v)
  }
  const total = Array.from(sums.values()).reduce((a, b) => a + b, 0)
  return Array.from(sums.entries())
    .map(([category, sum]) => ({
      category,
      total: sum,
      pct: total > 0 ? (sum / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export const groupTransactionsByDate = (transactions) => {
  const sorted = [...(transactions || [])].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
  const groups = []
  for (const t of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  }
  return groups
}

export const calculateMonthlyTrend = (
  transactions, monthsBack, displayCurrency, exchangeRate, today = new Date(),
) => {
  const result = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const totals = calculateMonthlyTotals(transactions, y, m, displayCurrency, exchangeRate)
    result.push({ year: y, month: m, net: totals.net })
  }
  return result
}

export const budgetProgress = (
  budget, transactions, year, month, displayCurrency, exchangeRate,
) => {
  const prefix = monthPrefix(year, month)
  let spent = 0
  for (const t of transactions || []) {
    if (t?.type !== 'EXPENSE') continue
    if (t.category !== budget.category) continue
    if (!t.date?.startsWith(prefix)) continue
    spent += convertAmount(t.amount || 0, t.currency, displayCurrency, exchangeRate)
  }
  const limit = convertAmount(budget.amount || 0, budget.currency, displayCurrency, exchangeRate)
  const remaining = limit - spent
  const pct = limit > 0 ? (spent / limit) * 100 : 0
  return { spent, remaining, pct, over: spent > limit && limit > 0, limit }
}

const lastDayOfMonth = (year, month) => new Date(year, month, 0).getDate()

const formatIsoDate = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const occurrenceAt = (startIso, cadence, stepIndex) => {
  const [sy, sm, sd] = startIso.split('-').map(Number)
  const stepMonths = cadence === 'YEARLY' ? 12 : 1
  const totalMonths = (sm - 1) + stepIndex * stepMonths
  const ny = sy + Math.floor(totalMonths / 12)
  const nm = (((totalMonths % 12) + 12) % 12) + 1
  const last = lastDayOfMonth(ny, nm)
  return formatIsoDate(ny, nm, Math.min(sd, last))
}

const stepsBetween = (startIso, endIso, cadence) => {
  const [sy, sm] = startIso.split('-').map(Number)
  const [ey, em] = endIso.split('-').map(Number)
  const months = (ey - sy) * 12 + (em - sm)
  return cadence === 'YEARLY' ? Math.floor(months / 12) : months
}

export const materializeRecurring = (templates, todayIso) => {
  const newTxns = []
  const updatedTemplates = []

  for (const t of templates || []) {
    if (!t || t.active === false) continue
    if (!t.start_date || !t.cadence) continue

    const anchor = t.last_materialized_date || null
    let stepIndex = anchor ? stepsBetween(t.start_date, anchor, t.cadence) + 1 : 0
    let lastEmitted = anchor

    while (true) {
      const cursor = occurrenceAt(t.start_date, t.cadence, stepIndex)
      if (cursor > todayIso) break
      newTxns.push({
        id: newId(),
        user_id: t.user_id,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        category: t.category,
        note: t.note ? `${t.note} (recurring)` : '(recurring)',
        date: cursor,
        createdAt: Date.now(),
        recurring_template_id: t.id,
      })
      lastEmitted = cursor
      stepIndex++
    }

    if (lastEmitted && lastEmitted !== anchor) {
      updatedTemplates.push({ ...t, last_materialized_date: lastEmitted })
    }
  }

  return { newTxns, updatedTemplates }
}

export const summarizeMonth = (transactions, ref = new Date()) => {
  const y = ref.getFullYear(), m = ref.getMonth()
  let income = 0, expense = 0
  for (const t of transactions) {
    const d = new Date(t.date)
    if (d.getFullYear() !== y || d.getMonth() !== m) continue
    const amt = Number(t.amount) || 0
    if (t.type === 'income') income += amt
    else if (t.type === 'expense') expense += amt
  }
  return { income, expense, net: income - expense }
}
