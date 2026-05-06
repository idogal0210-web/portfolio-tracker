import { supabase, supabaseConfigured } from './supabase'

export { supabaseConfigured }

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  return supabase
}

// ────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ────────────────────────────────────────────────────────────────────────────

const VALID_TYPES = new Set(['INCOME', 'EXPENSE'])
const VALID_CADENCES = new Set(['daily', 'weekly', 'monthly', 'yearly'])

function validateTransaction(t) {
  if (!t || typeof t !== 'object') throw new Error('Transaction must be an object')
  if (!VALID_TYPES.has(t.type)) throw new Error(`Transaction type must be INCOME or EXPENSE, got: ${t.type}`)
  if (typeof t.amount !== 'number' || !isFinite(t.amount) || t.amount <= 0)
    throw new Error(`Transaction amount must be a positive number, got: ${t.amount}`)
  if (!t.currency || typeof t.currency !== 'string') throw new Error('Transaction currency is required')
  if (!t.category || typeof t.category !== 'string') throw new Error('Transaction category is required')
  if (!t.date || typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date))
    throw new Error(`Transaction date must be YYYY-MM-DD, got: ${t.date}`)
}

function validateBudget(b) {
  if (!b || typeof b !== 'object') throw new Error('Budget must be an object')
  if (!b.category || typeof b.category !== 'string') throw new Error('Budget category is required')
  if (typeof b.amount !== 'number' || !isFinite(b.amount) || b.amount < 0)
    throw new Error(`Budget amount must be a non-negative number, got: ${b.amount}`)
  if (!b.currency || typeof b.currency !== 'string') throw new Error('Budget currency is required')
}

function validateHolding(h) {
  if (!h || typeof h !== 'object') throw new Error('Holding must be an object')
  if (!h.symbol || typeof h.symbol !== 'string') throw new Error('Holding symbol is required')
  if (typeof h.shares !== 'number' || !isFinite(h.shares) || h.shares <= 0)
    throw new Error(`Holding shares must be a positive number, got: ${h.shares}`)
}

function validateRecurring(t) {
  if (!t || typeof t !== 'object') throw new Error('Recurring template must be an object')
  if (!VALID_TYPES.has(t.type)) throw new Error(`Recurring type must be INCOME or EXPENSE, got: ${t.type}`)
  if (typeof t.amount !== 'number' || !isFinite(t.amount) || t.amount <= 0)
    throw new Error(`Recurring amount must be a positive number, got: ${t.amount}`)
  if (!VALID_CADENCES.has(t.cadence)) throw new Error(`Recurring cadence must be one of: ${[...VALID_CADENCES].join(', ')}`)
  if (!t.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(t.start_date))
    throw new Error(`Recurring start_date must be YYYY-MM-DD, got: ${t.start_date}`)
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
  validateHolding(holding)
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
  holdings.forEach(validateHolding)
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
  validateTransaction(txn)
  const payload = toDbTransaction(txn, userId)
  const { data, error } = await requireClient()
    .from('transactions').upsert(payload).select().single()
  if (error) throw error
  return fromDbTransaction(data)
}

export async function bulkInsertTransactions(txns, userId) {
  if (!txns?.length) return []
  txns.forEach(validateTransaction)
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
  validateBudget(budget)
  const { data, error } = await requireClient()
    .from('budgets')
    .upsert(toDbBudget(budget, userId), { onConflict: 'user_id,category' })
    .select().single()
  if (error) throw error
  return fromDbBudget(data)
}

export async function bulkUpsertBudgets(budgets, userId) {
  if (!budgets?.length) return []
  budgets.forEach(validateBudget)
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
  validateRecurring(template)
  const { data, error } = await requireClient()
    .from('recurring_templates').upsert(toDbRecurring(template, userId)).select().single()
  if (error) throw error
  return fromDbRecurring(data)
}

export async function bulkUpsertRecurring(templates, userId) {
  if (!templates?.length) return []
  templates.forEach(validateRecurring)
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
