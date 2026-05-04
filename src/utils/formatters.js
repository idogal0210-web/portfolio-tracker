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

export const formatCurrencyPrecise = (value, currency) => {
  if (value == null || !isFinite(value)) return '—'
  const abs = Math.abs(value)
  const decimals = abs < 1 ? 4 : abs < 10 ? 3 : 2
  const formatted = value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return currency === 'ILS' ? `₪${formatted}` : `$${formatted}`
}

export const convertAmount = (amount, fromCurrency, toCurrency, exchangeRate) => {
  if (!Number.isFinite(amount)) return 0
  if (fromCurrency === toCurrency) return amount
  if (!Number.isFinite(exchangeRate) || exchangeRate === 0) return 0
  if (fromCurrency === 'USD' && toCurrency === 'ILS') return amount * exchangeRate
  if (fromCurrency === 'ILS' && toCurrency === 'USD') return amount / exchangeRate
  return amount
}
