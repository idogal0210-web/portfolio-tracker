import { useState, useCallback, useRef, useEffect } from 'react'

import {
  loadHoldings, saveHoldings,
  loadTransactions, saveTransactions,
  loadBudgets, saveBudgets,
  loadRecurring, saveRecurring,
  loadDisplayName, saveDisplayName,
  newId, materializeRecurring,
} from '../utils'

import {
  upsertHolding, deleteHoldingBySymbol,
  upsertTransaction, deleteTransaction,
  upsertBudget, deleteBudget,
  upsertRecurring, deleteRecurring,
} from '../api'

export function usePortfolioState(userId) {
  const [holdings, setHoldings] = useState(() => loadHoldings())
  const holdingsRef = useRef(holdings)
  useEffect(() => { holdingsRef.current = holdings }, [holdings])

  const [transactions, setTransactions] = useState(() => {
    const txns = loadTransactions()
    const templates = loadRecurring()
    const todayIso = new Date().toISOString().slice(0, 10)
    const { newTxns } = materializeRecurring(templates, todayIso)
    if (newTxns.length > 0) {
      const next = [...txns, ...newTxns]
      saveTransactions(next)
      return next
    }
    return txns
  })

  const [budgets, setBudgets] = useState(() => loadBudgets())
  
  const [recurring, setRecurring] = useState(() => {
    const templates = loadRecurring()
    const todayIso = new Date().toISOString().slice(0, 10)
    const { updatedTemplates } = materializeRecurring(templates, todayIso)
    if (updatedTemplates.length > 0) {
      const next = templates.map(t => updatedTemplates.find(u => u.id === t.id) ?? t)
      saveRecurring(next)
      return next
    }
    return templates
  })

  const [displayName, setDisplayName] = useState(() => loadDisplayName())

  function handleSaveDisplayName(name) {
    setDisplayName(name)
    saveDisplayName(name)
  }

  const handleAdd = useCallback((holding) => {
    if (holdings.find(h => h.symbol === holding.symbol)) return
    const withId = { ...holding, id: newId() }
    setHoldings(prev => {
      const next = [...prev, withId]
      saveHoldings(next)
      return next
    })
    if (userId) upsertHolding(withId, userId).catch(console.error)
  }, [holdings, userId])

  const handleDelete = useCallback((symbol) => {
    setHoldings(prev => {
      const next = prev.filter(h => h.symbol !== symbol)
      saveHoldings(next)
      return next
    })
    if (userId) deleteHoldingBySymbol(symbol, userId).catch(console.error)
  }, [userId])

  const handleMoveHolding = useCallback((symbol, direction) => {
    setHoldings(prev => {
      const idx = prev.findIndex(h => h.symbol === symbol)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = direction === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      saveHoldings(next)
      return next
    })
  }, [])

  const handleSaveTxn = useCallback((txn) => {
    const isNew = !txn.id
    const withId = isNew ? { ...txn, id: newId(), createdAt: Date.now() } : txn
    setTransactions(prev => {
      const next = isNew ? [...prev, withId] : prev.map(t => t.id === withId.id ? withId : t)
      saveTransactions(next)
      return next
    })
    if (userId) upsertTransaction(withId, userId).catch(console.error)
  }, [userId])

  const handleDeleteTxn = useCallback((id) => {
    setTransactions(prev => {
      const next = prev.filter(t => t.id !== id)
      saveTransactions(next)
      return next
    })
    if (userId) deleteTransaction(id).catch(console.error)
  }, [userId])

  const handleSaveBudget = useCallback((budget) => {
    const withId = budget.id ? budget : { id: newId(), ...budget }
    setBudgets(prev => {
      const next = prev.find(b => b.category === withId.category)
        ? prev.map(b => b.category === withId.category ? { ...b, ...withId } : b)
        : [...prev, withId]
      saveBudgets(next)
      return next
    })
    if (userId) upsertBudget(withId, userId).catch(console.error)
  }, [userId])

  const handleDeleteBudget = useCallback((category) => {
    setBudgets(prev => {
      const next = prev.filter(b => b.category !== category)
      saveBudgets(next)
      return next
    })
    if (userId) deleteBudget(category, userId).catch(console.error)
  }, [userId])

  const handleSaveRecurring = useCallback((template) => {
    const isNew = !template.id
    const withId = isNew ? { ...template, id: newId() } : template
    setRecurring(prev => {
      const next = isNew ? [...prev, withId] : prev.map(t => t.id === withId.id ? withId : t)
      saveRecurring(next)
      return next
    })
    if (userId) upsertRecurring(withId, userId).catch(console.error)
  }, [userId])

  const handleDeleteRecurring = useCallback((id) => {
    setRecurring(prev => {
      const next = prev.filter(t => t.id !== id)
      saveRecurring(next)
      return next
    })
    if (userId) deleteRecurring(id).catch(console.error)
  }, [userId])

  return {
    holdings, setHoldings, holdingsRef,
    transactions, setTransactions,
    budgets, setBudgets,
    recurring, setRecurring,
    displayName, handleSaveDisplayName,
    handleAdd, handleDelete, handleMoveHolding,
    handleSaveTxn, handleDeleteTxn,
    handleSaveBudget, handleDeleteBudget,
    handleSaveRecurring, handleDeleteRecurring
  }
}
