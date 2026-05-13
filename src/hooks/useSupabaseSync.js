import { useEffect, useRef, useState } from 'react'
import {
  fetchHoldings, fetchTransactions, fetchBudgets, fetchRecurring,
  bulkUpsertHoldings, bulkInsertTransactions, bulkUpsertBudgets, bulkUpsertRecurring
} from '../api'
import {
  loadHoldings, saveHoldings,
  loadTransactions, saveTransactions,
  loadBudgets, saveBudgets,
  loadRecurring, saveRecurring
} from '../utils'

export function useSupabaseSync(userId, { setHoldings, setTransactions, setBudgets, setRecurring }) {
  const [syncing, setSyncing] = useState(false)
  const syncedForUser = useRef(null)

  useEffect(() => {
    if (!userId || syncedForUser.current === userId) return
    syncedForUser.current = userId
    setSyncing(true)
    ;(async () => {
      try {
        const [cloudH, cloudT, cloudB, cloudR] = await Promise.all([
          fetchHoldings(), fetchTransactions(), fetchBudgets(), fetchRecurring(),
        ])
        const localH = loadHoldings()
        const localT = loadTransactions()
        const localB = loadBudgets()
        const localR = loadRecurring()

        const cloudSymbols = new Set(cloudH.map(h => h.symbol))
        const localOnlyH = localH.filter(h => !cloudSymbols.has(h.symbol))
        const cloudTxnIds = new Set(cloudT.map(t => t.id))
        const localOnlyT = localT.filter(t => t.id && !cloudTxnIds.has(t.id))
        const cloudCats = new Set(cloudB.map(b => b.category))
        const localOnlyB = localB.filter(b => !cloudCats.has(b.category))
        const cloudRIds = new Set(cloudR.map(r => r.id))
        const localOnlyR = localR.filter(r => r.id && !cloudRIds.has(r.id))

        await Promise.all([
          localOnlyH.length ? bulkUpsertHoldings(localOnlyH, userId) : null,
          localOnlyT.length ? bulkInsertTransactions(localOnlyT, userId) : null,
          localOnlyB.length ? bulkUpsertBudgets(localOnlyB, userId) : null,
          localOnlyR.length ? bulkUpsertRecurring(localOnlyR, userId) : null,
        ].filter(Boolean))

        const [finalH, finalT, finalB, finalR] = await Promise.all([
          fetchHoldings(), fetchTransactions(), fetchBudgets(), fetchRecurring(),
        ])
        setHoldings(finalH); saveHoldings(finalH)
        setTransactions(finalT); saveTransactions(finalT)
        setBudgets(finalB); saveBudgets(finalB)
        setRecurring(finalR); saveRecurring(finalR)
      } catch (err) {
        console.error('Initial sync failed:', err)
      } finally {
        setSyncing(false)
      }
    })()
  }, [userId, setHoldings, setTransactions, setBudgets, setRecurring])

  return { syncing, syncedForUser }
}
