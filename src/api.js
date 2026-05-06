// Re-export barrel — consumers import from here unchanged.
// Implementation is split into financeApi.js (Yahoo/RapidAPI) and dbService.js (Supabase).
export { fetchPrices, fetchHistory } from './financeApi'
export {
  supabaseConfigured,
  getSession, signInWithPassword, signUp, signOut, onAuthChange,
  fetchHoldings, upsertHolding, deleteHoldingBySymbol, bulkUpsertHoldings,
  fetchTransactions, upsertTransaction, bulkInsertTransactions, deleteTransaction,
  fetchBudgets, upsertBudget, bulkUpsertBudgets, deleteBudget,
  fetchRecurring, upsertRecurring, bulkUpsertRecurring, deleteRecurring,
} from './dbService'
