export const isILStock = (symbol) =>
  typeof symbol === 'string' && symbol.toUpperCase().endsWith('.TA')

export const isCrypto = (symbol) =>
  typeof symbol === 'string' && symbol.toUpperCase().endsWith('-USD')

export const getMarket = (symbol) => {
  if (isCrypto(symbol)) return 'CRYPTO'
  if (isILStock(symbol)) return 'IL'
  return 'US'
}

export const displaySymbol = (symbol) =>
  typeof symbol === 'string' ? symbol.replace(/-USD$/i, '') : symbol

export const formatCurrency = (amount, currency) => {
  const rounded = Math.round(amount)
  const formatted = rounded.toLocaleString('en-US')
  return currency === 'ILS' ? `₪${formatted}` : `$${formatted}`
}

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

const HOLDINGS_KEY = 'mystock_holdings'
const PRICES_CACHE_KEY = 'mystock_prices_cache'

export const loadHoldings = () => {
  try {
    const raw = localStorage.getItem(HOLDINGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return parsed.map(h => ({
      symbol: h.symbol,
      shares: h.shares,
      purchasePrice: h.purchasePrice ?? h.avgPrice ?? 0,
      fees: h.fees ?? 0,
      dividends: h.dividends ?? 0,
      purchaseDate: h.purchaseDate ?? '',
    }))
  } catch {
    return []
  }
}

export const saveHoldings = (holdings) => {
  try { localStorage.setItem(HOLDINGS_KEY, JSON.stringify(holdings)) } catch {}
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
  try { localStorage.setItem(PRICES_CACHE_KEY, JSON.stringify(prices)) } catch {}
}

const EXCHANGE_RATE_KEY = 'mystock_exchange_rate'

export const loadExchangeRate = () => {
  try { const v = parseFloat(localStorage.getItem(EXCHANGE_RATE_KEY)); return v > 0 ? v : 3.7 } catch { return 3.7 }
}

export const saveExchangeRate = (rate) => {
  try { localStorage.setItem(EXCHANGE_RATE_KEY, String(rate)) } catch {}
}

// Prices for .TA symbols must be passed in agorot (API convention); conversion to shekels is done internally.
// Crypto (-USD) and US stocks are passed through as-is.
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
