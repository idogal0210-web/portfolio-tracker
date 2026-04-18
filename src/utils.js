export const isILStock = (symbol) =>
  typeof symbol === 'string' && symbol.toUpperCase().endsWith('.TA')

export const formatCurrency = (amount, currency) => {
  const rounded = Math.round(amount)
  const formatted = rounded.toLocaleString('en-US')
  return currency === 'ILS' ? `₪${formatted}` : `$${formatted}`
}

export const calculateTotals = (holdings, prices, exchangeRate) => {
  let usValueUSD = 0
  let ilValueUSD = 0
  let gainUSD = 0

  for (const holding of holdings) {
    const price = prices[holding.symbol]
    if (!price) continue

    const changeRatio = price.regularMarketChangePercent / 100

    if (isILStock(holding.symbol)) {
      const valueILS = holding.shares * price.regularMarketPrice
      const valueUSD = valueILS / exchangeRate
      ilValueUSD += valueUSD
      gainUSD += (holding.shares * price.regularMarketPrice * changeRatio) / exchangeRate
    } else {
      const valueUSD = holding.shares * price.regularMarketPrice
      usValueUSD += valueUSD
      gainUSD += holding.shares * price.regularMarketPrice * changeRatio
    }
  }

  const totalUSD = usValueUSD + ilValueUSD
  const totalILS = totalUSD * exchangeRate
  const usPct = totalUSD > 0 ? (usValueUSD / totalUSD) * 100 : 0
  const ilPct = totalUSD > 0 ? (ilValueUSD / totalUSD) * 100 : 0

  return { totalUSD, totalILS, usValueUSD, ilValueUSD, usPct, ilPct, gainUSD }
}

const HOLDINGS_KEY = 'mystock_holdings'
const PRICES_CACHE_KEY = 'mystock_prices_cache'

export const loadHoldings = () => {
  try {
    return JSON.parse(localStorage.getItem(HOLDINGS_KEY) || '[]')
  } catch {
    return []
  }
}

export const saveHoldings = (holdings) => {
  localStorage.setItem(HOLDINGS_KEY, JSON.stringify(holdings))
}

export const loadPricesCache = () => {
  try {
    const raw = localStorage.getItem(PRICES_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const savePricesCache = (prices) => {
  localStorage.setItem(PRICES_CACHE_KEY, JSON.stringify(prices))
}

// Prices for .TA symbols must be passed in agorot (API convention); conversion to shekels is done internally.
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
