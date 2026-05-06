const HOLDINGS_KEY = 'mystock_holdings'
const PRICES_CACHE_KEY = 'mystock_prices_cache'
const TRANSACTIONS_KEY = 'mystock_transactions'
const BUDGETS_KEY = 'mystock_budgets'
const RECURRING_KEY = 'mystock_recurring'
const BANK_BALANCE_KEY = 'mystock_bank_balance'
const EXCHANGE_RATE_KEY = 'mystock_exchange_rate'

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
  try { localStorage.setItem(HOLDINGS_KEY, JSON.stringify(holdings)) } catch (_) { /* storage unavailable */ }
}

export const clearLegacyHoldings = () => {
  localStorage.removeItem(HOLDINGS_KEY)
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
  try { localStorage.setItem(PRICES_CACHE_KEY, JSON.stringify(prices)) } catch (_) { /* storage unavailable */ }
}

export const loadExchangeRate = () => {
  try { const v = parseFloat(localStorage.getItem(EXCHANGE_RATE_KEY)); return v > 0 ? v : 3.7 } catch { return 3.7 }
}

export const saveExchangeRate = (rate) => {
  try { localStorage.setItem(EXCHANGE_RATE_KEY, String(rate)) } catch (_) { /* storage unavailable */ }
}

const lsLoad = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const lsSave = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch (_) { /* storage unavailable */ }
}

export const loadTransactions = () => lsLoad(TRANSACTIONS_KEY, [])
export const saveTransactions = (data) => lsSave(TRANSACTIONS_KEY, data)

export const loadBudgets = () => lsLoad(BUDGETS_KEY, [])
export const saveBudgets = (data) => lsSave(BUDGETS_KEY, data)

export const loadRecurring = () => lsLoad(RECURRING_KEY, [])
export const saveRecurring = (data) => lsSave(RECURRING_KEY, data)

export const loadBankBalance = () => {
  try { const v = parseFloat(localStorage.getItem(BANK_BALANCE_KEY)); return Number.isFinite(v) ? v : 0 } catch { return 0 }
}

export const saveBankBalance = (v) => {
  try { localStorage.setItem(BANK_BALANCE_KEY, String(v)) } catch (_) { /* storage unavailable */ }
}

export function loadDisplayName() {
  try { return localStorage.getItem('mystock_display_name') || '' } catch { return '' }
}

export function saveDisplayName(name) {
  try { localStorage.setItem('mystock_display_name', name) } catch {}
}
