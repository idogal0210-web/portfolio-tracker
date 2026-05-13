import { useState, useCallback } from 'react'
import { loadPricesCache, savePricesCache, saveHoldings, DEFAULT_EXCHANGE_RATE } from '../utils'
import { fetchPrices, fetchHoldings } from '../api'

export function usePriceFetching(apiKey, userId) {
  const [prices, setPrices] = useState(() => loadPricesCache() ?? {})
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE)
  const [loading, setLoading] = useState(false)
  const [stale, setStale] = useState(false)

  const refresh = useCallback(async (currentHoldings, setHoldings) => {
    setLoading(true); setStale(false)
    try {
      let activeHoldings = currentHoldings
      if (userId) {
        const cloudH = await fetchHoldings()
        if (cloudH.length > 0 || activeHoldings.length === 0) {
          activeHoldings = cloudH
          setHoldings(cloudH)
          saveHoldings(cloudH)
        }
      }
      if (!activeHoldings.length) return
      const { priceMap, exchangeRate: rate } = await fetchPrices(activeHoldings.map(h => h.symbol), apiKey)
      setPrices(priceMap)
      setExchangeRate(rate)
      savePricesCache(priceMap)
    } catch (err) {
      console.error('Price refresh failed:', err)
      setStale(true)
    } finally {
      setLoading(false)
    }
  }, [apiKey, userId])

  const deletePrice = useCallback((symbol) => {
    setPrices(prev => { const next = { ...prev }; delete next[symbol]; return next })
  }, [])

  return { prices, exchangeRate, loading, stale, refresh, deletePrice }
}
