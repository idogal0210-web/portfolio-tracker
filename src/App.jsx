import { useState, useEffect, useCallback, useMemo } from 'react'

import { toCSV, getMarket, calculateHoldingMetrics, displaySymbol } from './utils'
import { supabaseConfigured, getSession, onAuthChange, signOut } from './api'

import { AppHeader, TabBar, FloatingActionButton } from './components/ui'
import { HoldingDetail, AddHoldingSheet, AddTransactionSheet, BudgetSheet, RecurringSheet, AuthSheet } from './components/features'
import { NetWorthScreen, ActivityScreen, HoldingsScreen, SettingsScreen } from './screens'

import { usePortfolioState } from './hooks/usePortfolioState'
import { usePriceFetching } from './hooks/usePriceFetching'
import { useSupabaseSync } from './hooks/useSupabaseSync'

export default function App() {
  const [currency, setCurrency] = useState('USD')
  const [activeTab, setActiveTab] = useState('networth')
  const [selected, setSelected] = useState(null)
  const [adding, setAdding] = useState(false)
  const [addingTxn, setAddingTxn] = useState(false)
  const [editingTxn, setEditingTxn] = useState(null)
  const [managingBudgets, setManagingBudgets] = useState(false)
  const [managingRecurring, setManagingRecurring] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  const [session, setSession] = useState(null)
  const userId = session?.user?.id ?? null

  const apiKey = import.meta.env.VITE_RAPIDAPI_KEY

  useEffect(() => {
    if (!supabaseConfigured) return
    getSession().then(setSession).catch(console.error)
    return onAuthChange(setSession)
  }, [])

  const {
    holdings, setHoldings, holdingsRef,
    transactions, setTransactions,
    budgets, setBudgets,
    recurring, setRecurring,
    displayName, handleSaveDisplayName,
    handleAdd, handleDelete, handleMoveHolding,
    handleSaveTxn, handleDeleteTxn,
    handleSaveBudget, handleDeleteBudget,
    handleSaveRecurring, handleDeleteRecurring
  } = usePortfolioState(userId)

  const { syncing } = useSupabaseSync(userId, {
    setHoldings, setTransactions, setBudgets, setRecurring
  })

  const { prices, exchangeRate, loading, stale, refresh, deletePrice } = usePriceFetching(apiKey, userId)

  useEffect(() => { refresh(holdingsRef.current, setHoldings) }, [refresh, holdingsRef, setHoldings])

  const handleDeleteWithPrice = useCallback((symbol) => {
    handleDelete(symbol)
    deletePrice(symbol)
  }, [handleDelete, deletePrice])

  const toggleCurrency = useCallback(() => {
    setCurrency(c => c === 'USD' ? 'ILS' : 'USD')
  }, [])

  const handleSignOut = useCallback(async () => {
    try { await signOut() } catch (e) { console.error(e) }
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
          onRefresh={() => refresh(holdingsRef.current, setHoldings)}
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
              onDeleteHolding={handleDeleteWithPrice}
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

        {selected && <HoldingDetail h={selected} onBack={() => setSelected(null)} onDelete={handleDeleteWithPrice} apiKey={apiKey} />}

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
    </div>
  )
}
