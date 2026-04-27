import { supabase, supabaseConfigured } from './supabase'

// ────────────────────────────────────────────────────────────────────────────
// External: RapidAPI Yahoo Finance
// ────────────────────────────────────────────────────────────────────────────

const API_HOST = 'apidojo-yahoo-finance-v1.p.rapidapi.com'
const API_URL = `https://${API_HOST}/market/v2/get-quotes`

export async function fetchPrices(symbols, apiKey) {
  const allSymbols = [...symbols, 'USDILS=X'].join(',')
  const response = await fetch(`${API_URL}?symbols=${allSymbols}&region=US`, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': API_HOST,
    },
  })
  if (!response.ok) throw new Error(`API error: ${response.status}`)

  const data = await response.json()
  const quotes = data?.quoteResponse?.result ?? []
  const priceMap = {}
  let exchangeRate = 3.7
  for (const quote of quotes) {
    if (quote.symbol === 'USDILS=X') {
      exchangeRate = quote.regularMarketPrice
    } else {
      priceMap[quote.symbol] = {
        regularMarketPrice: quote.regularMarketPrice,
        regularMarketChangePercent: quote.regularMarketChangePercent,
        longName: quote.longName || quote.shortName || quote.symbol,
      }
    }
  }
  return { priceMap, exchangeRate }
}

const HISTORY_URL = `https://${API_HOST}/stock/v3/get-chart`

const RANGE_MAP = {
  '1D': { range: '1d',  interval: '5m'  },
  '1W': { range: '5d',  interval: '60m' },
  '1M': { range: '1mo', interval: '1d'  },
  '3M': { range: '3mo', interval: '1d'  },
  '1Y': { range: '1y',  interval: '1wk' },
  'ALL': { range: 'max', interval: '1mo' },
}

export async function fetchHistory(symbol, rangeKey = '1M', apiKey) {
  const { range, interval } = RANGE_MAP[rangeKey] ?? RANGE_MAP['1M']
  const url = `${HISTORY_URL}?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}&region=US`
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': API_HOST,
    },
  })
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  const data = await response.json()
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
  return closes.filter(v => v != null && isFinite(v))
}

export { supabaseConfigured }

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  return supabase
}

// ────────────────────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────────────────────

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session ?? null
}

export async function signInWithPassword(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signUp(email, password) {
  const { data, error } = await requireClient().auth.signUp({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export function onAuthChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

// ────────────────────────────────────────────────────────────────────────────
// Holdings
// ────────────────────────────────────────────────────────────────────────────

const fromDbHolding = (row) => ({
  id: row.id,
  symbol: row.symbol,
  shares: Number(row.shares),
  purchasePrice: Number(row.purchase_price ?? 0),
  fees: Number(row.fees ?? 0),
  dividends: Number(row.dividends ?? 0),
  purchaseDate: row.purchase_date ?? '',
})

const toDbHolding = (h, userId) => ({
  user_id: userId,
  symbol: h.symbol,
  shares: h.shares,
  purchase_price: h.purchasePrice ?? 0,
  fees: h.fees ?? 0,
  dividends: h.dividends ?? 0,
  purchase_date: h.purchaseDate || null,
})

export async function fetchHoldings() {
  const { data, error } = await requireClient()
    .from('holdings').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(fromDbHolding)
}

export async function upsertHolding(holding, userId) {
  const payload = toDbHolding(holding, userId)
  const { data, error } = await requireClient()
    .from('holdings')
    .upsert(payload, { onConflict: 'user_id,symbol' })
    .select().single()
  if (error) throw error
  return fromDbHolding(data)
}

export async function deleteHoldingBySymbol(symbol, userId) {
  const { error } = await requireClient()
    .from('holdings').delete()
    .eq('user_id', userId).eq('symbol', symbol)
  if (error) throw error
}

export async function bulkUpsertHoldings(holdings, userId) {
  if (!holdings?.length) return []
  const payload = holdings.map(h => toDbHolding(h, userId))
  const { data, error } = await requireClient()
    .from('holdings')
    .upsert(payload, { onConflict: 'user_id,symbol' })
    .select()
  if (error) throw error
  return (data ?? []).map(fromDbHolding)
}

// ────────────────────────────────────────────────────────────────────────────
// Transactions
// ────────────────────────────────────────────────────────────────────────────

const fromDbTransaction = (row) => ({
  id: row.id,
  type: row.type,
  amount: Number(row.amount),
  currency: row.currency,
  category: row.category,
  note: row.note ?? '',
  date: row.date,
  recurring_template_id: row.recurring_template_id ?? null,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
})

const toDbTransaction = (t, userId) => {
  const out = {
    user_id: userId,
    type: t.type,
    amount: t.amount,
    currency: t.currency,
    category: t.category,
    note: t.note ?? '',
    date: t.date,
  }
  if (t.id) out.id = t.id
  if (t.recurring_template_id) out.recurring_template_id = t.recurring_template_id
  return out
}

export async function fetchTransactions() {
  const { data, error } = await requireClient()
    .from('transactions').select('*').order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromDbTransaction)
}

export async function upsertTransaction(txn, userId) {
  const payload = toDbTransaction(txn, userId)
  const { data, error } = await requireClient()
    .from('transactions').upsert(payload).select().single()
  if (error) throw error
  return fromDbTransaction(data)
}

export async function bulkInsertTransactions(txns, userId) {
  if (!txns?.length) return []
  const payload = txns.map(t => toDbTransaction(t, userId))
  const { data, error } = await requireClient()
    .from('transactions').upsert(payload).select()
  if (error) throw error
  return (data ?? []).map(fromDbTransaction)
}

export async function deleteTransaction(id) {
  const { error } = await requireClient().from('transactions').delete().eq('id', id)
  if (error) throw error
}

// ────────────────────────────────────────────────────────────────────────────
// Budgets
// ────────────────────────────────────────────────────────────────────────────

const fromDbBudget = (row) => ({
  id: row.id,
  category: row.category,
  amount: Number(row.amount),
  currency: row.currency,
})

const toDbBudget = (b, userId) => ({
  user_id: userId,
  category: b.category,
  amount: b.amount,
  currency: b.currency,
})

export async function fetchBudgets() {
  const { data, error } = await requireClient()
    .from('budgets').select('*').order('category', { ascending: true })
  if (error) throw error
  return (data ?? []).map(fromDbBudget)
}

export async function upsertBudget(budget, userId) {
  const { data, error } = await requireClient()
    .from('budgets')
    .upsert(toDbBudget(budget, userId), { onConflict: 'user_id,category' })
    .select().single()
  if (error) throw error
  return fromDbBudget(data)
}

export async function bulkUpsertBudgets(budgets, userId) {
  if (!budgets?.length) return []
  const payload = budgets.map(b => toDbBudget(b, userId))
  const { data, error } = await requireClient()
    .from('budgets')
    .upsert(payload, { onConflict: 'user_id,category' })
    .select()
  if (error) throw error
  return (data ?? []).map(fromDbBudget)
}

export async function deleteBudget(category, userId) {
  const { error } = await requireClient()
    .from('budgets').delete()
    .eq('user_id', userId).eq('category', category)
  if (error) throw error
}

// ────────────────────────────────────────────────────────────────────────────
// Recurring templates
// ────────────────────────────────────────────────────────────────────────────

const fromDbRecurring = (row) => ({
  id: row.id,
  user_id: row.user_id,
  type: row.type,
  amount: Number(row.amount),
  currency: row.currency,
  category: row.category,
  note: row.note ?? '',
  cadence: row.cadence,
  start_date: row.start_date,
  last_materialized_date: row.last_materialized_date ?? null,
  active: row.active !== false,
})

const toDbRecurring = (t, userId) => {
  const out = {
    user_id: userId,
    type: t.type,
    amount: t.amount,
    currency: t.currency,
    category: t.category,
    note: t.note ?? '',
    cadence: t.cadence,
    start_date: t.start_date,
    last_materialized_date: t.last_materialized_date ?? null,
    active: t.active !== false,
  }
  if (t.id) out.id = t.id
  return out
}

export async function fetchRecurring() {
  const { data, error } = await requireClient()
    .from('recurring_templates').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(fromDbRecurring)
}

export async function upsertRecurring(template, userId) {
  const { data, error } = await requireClient()
    .from('recurring_templates').upsert(toDbRecurring(template, userId)).select().single()
  if (error) throw error
  return fromDbRecurring(data)
}

export async function bulkUpsertRecurring(templates, userId) {
  if (!templates?.length) return []
  const payload = templates.map(t => toDbRecurring(t, userId))
  const { data, error } = await requireClient()
    .from('recurring_templates').upsert(payload).select()
  if (error) throw error
  return (data ?? []).map(fromDbRecurring)
}

export async function deleteRecurring(id) {
  const { error } = await requireClient()
    .from('recurring_templates').delete().eq('id', id)
  if (error) throw error
}
