import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

import {
  loadHoldings, saveHoldings,
  loadPricesCache, savePricesCache,
  loadTransactions, saveTransactions,
  loadBudgets, saveBudgets,
  loadRecurring, saveRecurring,
  loadDisplayName, saveDisplayName,
  newId, toCSV, materializeRecurring,
  getMarket, calculateHoldingMetrics, displaySymbol
} from './utils'

import {
  supabaseConfigured, getSession, onAuthChange, signOut,
  fetchHoldings, fetchTransactions, fetchBudgets, fetchRecurring,
  bulkUpsertHoldings, bulkInsertTransactions, bulkUpsertBudgets, bulkUpsertRecurring,
  upsertHolding, deleteHoldingBySymbol,
  upsertTransaction, deleteTransaction,
  upsertBudget, deleteBudget,
  upsertRecurring, deleteRecurring
} from './supabase'

import { fetchPrices } from './api'

import { AppHeader, TabBar, FloatingActionButton } from './components/ui'
import { HoldingDetail, AddHoldingSheet, AddTransactionSheet, BudgetSheet, RecurringSheet, AuthSheet } from './components/features'
import { NetWorthScreen, ActivityScreen, HoldingsScreen, SettingsScreen } from './screens'

export default function App() {
  const [holdings, setHoldings] = useState(() => loadHoldings())
  const holdingsRef = useRef(holdings)
  useEffect(() => { holdingsRef.current = holdings }, [holdings])
  const [prices, setPrices] = useState(() => loadPricesCache() ?? {})
  const [exchangeRate, setExchangeRate] = useState(3.7)
  const [loading, setLoading] = useState(false)
  const [stale, setStale] = useState(false)

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

  const [currency, setCurrency] = useState('USD')
  const [activeTab, setActiveTab] = useState('networth')
  const [displayName, setDisplayName] = useState(() => loadDisplayName())
  function handleSaveDisplayName(name) {
    setDisplayName(name)
    saveDisplayName(name)
  }
  const [selected, setSelected] = useState(null)
  const [adding, setAdding] = useState(false)
  const [addingTxn, setAddingTxn] = useState(false)
  const [editingTxn, setEditingTxn] = useState(null)
  const [managingBudgets, setManagingBudgets] = useState(false)
  const [managingRecurring, setManagingRecurring] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  const [session, setSession] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const userId = session?.user?.id ?? null
  const syncedForUser = useRef(null)

  const apiKey = import.meta.env.VITE_RAPIDAPI_KEY

  useEffect(() => {
    if (!supabaseConfigured) return
    getSession().then(setSession).catch(console.error)
    return onAuthChange(setSession)
  }, [])

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
  }, [userId])

  const refresh = useCallback(async () => {
    setLoading(true); setStale(false)
    try {
      let currentHoldings = holdingsRef.current
      if (userId) {
        const cloudH = await fetchHoldings()
        if (cloudH.length > 0 || currentHoldings.length === 0) {
          currentHoldings = cloudH
          setHoldings(cloudH)
          saveHoldings(cloudH)
        }
      }
      if (!currentHoldings.length) return
      const { priceMap, exchangeRate: rate } = await fetchPrices(currentHoldings.map(h => h.symbol), apiKey)
      setPrices(priceMap)
      setExchangeRate(rate)
      savePricesCache(priceMap)
    } catch {
      setStale(true)
    } finally {
      setLoading(false)
    }
  }, [apiKey, userId])

  useEffect(() => { refresh() }, [refresh])

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
    setPrices(prev => { const next = { ...prev }; delete next[symbol]; return next })
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

  const toggleCurrency = useCallback(() => {
    setCurrency(c => c === 'USD' ? 'ILS' : 'USD')
  }, [])

  const handleSignOut = useCallback(async () => {
    try { await signOut() } catch (e) { console.error(e) }
    syncedForUser.current = null
    setSession(null)
  }, [])

  const handleExportCsv = useCallback(() => {
    const csv = toCSV(transactions, currency, exchangeRate)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }, [transactions, currency, exchangeRate])

  const handleFab = useCallback(() => {
    if (activeTab === 'cashflow') setAddingTxn(true)
    else setAdding(true)
  }, [activeTab])

  const enriched = useMemo(() => holdings.map(holding => {
    const priceData = prices[holding.symbol] ?? null
    const market = getMarket(holding.symbol)
    const apiPrice = priceData?.regularMarketPrice ?? 0
    const metrics = apiPrice ? calculateHoldingMetrics(holding, apiPrice) : null
    return {
      ticker: holding.symbol,
      name: priceData?.longName ?? displaySymbol(holding.symbol),
      qty: holding.shares,
      avgCost: holding.purchasePrice,
      price: apiPrice,
      dayChange: priceData?.regularMarketChangePercent ?? 0,
      market,
      _holding: holding,
      _metrics: metrics,
    }
  }), [holdings, prices])

  return (
    <div className="bg-[#050505] text-white" style={{
      height: '100dvh',
      overflow: 'hidden',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
      WebkitFontSmoothing: 'antialiased',
      backgroundImage: 'radial-gradient(at 80% 10%, rgba(134,239,172,0.05), transparent 55%), radial-gradient(at 15% 90%, rgba(134,239,172,0.03), transparent 60%)',
    }}>
      <div className="max-w-[430px] md:max-w-4xl mx-auto relative" style={{ height: '100dvh', overflow: 'hidden' }}>
        <AppHeader
          currency={currency}
          onToggleCurrency={toggleCurrency}
          onRefresh={refresh}
          loading={loading}
        />
        <div key={activeTab} className="absolute inset-0 screen-enter">
          {activeTab === 'networth' && (
            <NetWorthScreen
              holdings={holdings} enriched={enriched} prices={prices}
              exchangeRate={exchangeRate} currency={currency}
              stale={stale}
              transactions={transactions}
              displayName={displayName}
            />
          )}
          {activeTab === 'cashflow' && (
            <ActivityScreen
              transactions={transactions} budgets={budgets}
              currency={currency} exchangeRate={exchangeRate}
              onOpenBudgets={() => setManagingBudgets(true)}
              onOpenRecurring={() => setManagingRecurring(true)}
              onEditTxn={setEditingTxn}
              onSaveTxn={handleSaveTxn}
              onExportCsv={handleExportCsv}
            />
          )}
          {activeTab === 'holdings' && (
            <HoldingsScreen
              holdings={holdings} enriched={enriched} prices={prices}
              exchangeRate={exchangeRate} currency={currency}
              onSelectHolding={setSelected}
              onDeleteHolding={handleDelete}
              onMoveHolding={handleMoveHolding}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsScreen
              currency={currency} onToggleCurrency={toggleCurrency}
              onExportCsv={handleExportCsv}
              cloudAvailable={supabaseConfigured}
              session={session} syncing={syncing}
              onSignIn={() => setShowAuth(true)}
              onSignOut={handleSignOut}
              holdingsCount={holdings.length}
              transactionsCount={transactions.length}
              displayName={displayName}
              onSaveDisplayName={handleSaveDisplayName}
            />
          )}
        </div>

        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        <FloatingActionButton onClick={handleFab} />

        {selected && <HoldingDetail h={selected} onBack={() => setSelected(null)} onDelete={handleDelete} apiKey={apiKey} />}

        {adding && <AddHoldingSheet onClose={() => setAdding(false)} onAdd={handleAdd} />}

        {(addingTxn || editingTxn) && (
          <AddTransactionSheet
            initial={editingTxn}
            defaultCurrency={currency}
            onClose={() => { setAddingTxn(false); setEditingTxn(null) }}
            onSave={handleSaveTxn}
            onDelete={handleDeleteTxn}
          />
        )}

        {managingBudgets && (
          <BudgetSheet
            budgets={budgets}
            defaultCurrency={currency}
            onClose={() => setManagingBudgets(false)}
            onSave={handleSaveBudget}
            onDelete={handleDeleteBudget}
          />
        )}

        {managingRecurring && (
          <RecurringSheet
            templates={recurring}
            defaultCurrency={currency}
            onClose={() => setManagingRecurring(false)}
            onSave={handleSaveRecurring}
            onDelete={handleDeleteRecurring}
          />
        )}

        {showAuth && (
          <AuthSheet
            onClose={() => setShowAuth(false)}
            onSignedIn={setSession}
          />
        )}
      </div>

      <style>{`
        .sheet-input {
          width: 100%;
          height: 46px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: white;
          padding: 0 14px;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
          -webkit-appearance: none;
          appearance: none;
        }
        .sheet-input::placeholder { color: rgba(255,255,255,0.2); }
        .sheet-input[type="date"] { color: rgba(255,255,255,0.85); font-size: 14px; min-height: 46px; }
        .sheet-input-date::-webkit-date-and-time-value { text-align: left; }
        .sheet-input-date::-webkit-calendar-picker-indicator { opacity: 0.6; cursor: pointer; }
        select.sheet-input { padding-right: 32px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M6 9l6 6 6-6' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
        select.sheet-input option { background: #1a1a1c; color: white; }
      `}</style>
    </div>
  )
}
