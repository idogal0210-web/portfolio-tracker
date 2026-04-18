import { describe, it, expect, beforeEach } from 'vitest'
import {
  isILStock,
  formatCurrency,
  calculateTotals,
  loadHoldings,
  saveHoldings,
  loadPricesCache,
  savePricesCache,
  calculateHoldingMetrics,
} from '../utils'

describe('isILStock', () => {
  it('returns true for .TA suffix', () => {
    expect(isILStock('TEVA.TA')).toBe(true)
  })
  it('returns true for lowercase .ta suffix', () => {
    expect(isILStock('teva.ta')).toBe(true)
  })
  it('returns false for US stock', () => {
    expect(isILStock('AAPL')).toBe(false)
  })
  it('returns false for empty string', () => {
    expect(isILStock('')).toBe(false)
  })
})

describe('formatCurrency', () => {
  it('formats USD amounts with $ prefix', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,235')
  })
  it('formats ILS amounts with ₪ prefix', () => {
    expect(formatCurrency(45678, 'ILS')).toBe('₪45,678')
  })
  it('formats zero correctly', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0')
  })
})

describe('calculateTotals', () => {
  const exchangeRate = 3.7

  const holdings = [
    { symbol: 'AAPL', shares: 10, avgPrice: 180 },
    { symbol: 'TEVA.TA', shares: 100, avgPrice: 80 },
  ]

  const prices = {
    AAPL: { regularMarketPrice: 190, regularMarketChangePercent: 1.0, longName: 'Apple Inc.' },
    'TEVA.TA': { regularMarketPrice: 90, regularMarketChangePercent: -0.5, longName: 'Teva Pharmaceutical' },
  }

  it('calculates total USD correctly', () => {
    const result = calculateTotals(holdings, prices, exchangeRate)
    // AAPL: 10 * 190 = 1900 USD
    // TEVA.TA: 100 * 90 = 9000 ILS → 9000 / 3.7 ≈ 2432.43 USD
    expect(result.totalUSD).toBeCloseTo(1900 + 9000 / 3.7, 1)
  })

  it('calculates total ILS as totalUSD * exchangeRate', () => {
    const result = calculateTotals(holdings, prices, exchangeRate)
    expect(result.totalILS).toBeCloseTo(result.totalUSD * exchangeRate, 1)
  })

  it('calculates US and IL percentages that sum to 100', () => {
    const result = calculateTotals(holdings, prices, exchangeRate)
    expect(result.usPct + result.ilPct).toBeCloseTo(100, 0)
  })

  it('calculates gainUSD from today change', () => {
    const result = calculateTotals(holdings, prices, exchangeRate)
    // AAPL gain: 10 * 190 * 0.01 = 19 USD
    // TEVA gain: 100 * 90 * (-0.005) / 3.7 ≈ -1.216 USD
    expect(result.gainUSD).toBeCloseTo(19 + (100 * 90 * -0.005) / 3.7, 1)
  })

  it('returns zeros when prices map is empty', () => {
    const result = calculateTotals(holdings, {}, exchangeRate)
    expect(result.totalUSD).toBe(0)
    expect(result.gainUSD).toBe(0)
  })
})

describe('LocalStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loadHoldings returns [] when nothing stored', () => {
    expect(loadHoldings()).toEqual([])
  })

  it('saveHoldings + loadHoldings round-trips data', () => {
    const data = [{ symbol: 'AAPL', shares: 5, avgPrice: 150 }]
    saveHoldings(data)
    expect(loadHoldings()).toEqual(data)
  })

  it('loadHoldings returns [] on corrupt JSON', () => {
    localStorage.setItem('mystock_holdings', 'not-json')
    expect(loadHoldings()).toEqual([])
  })

  it('loadPricesCache returns null when nothing stored', () => {
    expect(loadPricesCache()).toBeNull()
  })

  it('savePricesCache + loadPricesCache round-trips data', () => {
    const cache = { AAPL: { regularMarketPrice: 190 } }
    savePricesCache(cache)
    expect(loadPricesCache()).toEqual(cache)
  })
})

describe('calculateHoldingMetrics', () => {
  const baseHolding = {
    symbol: 'AAPL',
    shares: 10,
    purchasePrice: 150,
    fees: 5,
    dividends: 20,
    purchaseDate: '2024-01-01',
  }

  it('calculates adjustedCostBasis as (purchasePrice * shares) + fees', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    expect(result.adjustedCostBasis).toBeCloseTo(1505)
  })

  it('calculates currentValue as currentPrice * shares', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    expect(result.currentValue).toBeCloseTo(1900)
  })

  it('calculates totalReturn as currentValue + dividends - adjustedCostBasis', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    expect(result.totalReturn).toBeCloseTo(415)
  })

  it('calculates roiPct as (totalReturn / adjustedCostBasis) * 100', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    expect(result.roiPct).toBeCloseTo(415 / 1505 * 100, 1)
  })

  it('calculates breakEven as (adjustedCostBasis - dividends) / shares', () => {
    const result = calculateHoldingMetrics(baseHolding, 190)
    expect(result.breakEven).toBeCloseTo(148.5)
  })

  it('divides both currentPrice and purchasePrice by 100 for .TA stocks', () => {
    const taseHolding = { ...baseHolding, symbol: 'ELBT.TA', purchasePrice: 15000 }
    const result = calculateHoldingMetrics(taseHolding, 19000)
    expect(result.adjustedCostBasis).toBeCloseTo(1505)
    expect(result.currentValue).toBeCloseTo(1900)
  })

  it('returns roiPct = 0 when adjustedCostBasis is 0', () => {
    const zeroCost = { ...baseHolding, purchasePrice: 0, fees: 0, dividends: 0 }
    const result = calculateHoldingMetrics(zeroCost, 190)
    expect(result.roiPct).toBe(0)
  })

  it('defaults fees and dividends to 0 if missing', () => {
    const minimal = { symbol: 'AAPL', shares: 10, purchasePrice: 150 }
    const result = calculateHoldingMetrics(minimal, 190)
    expect(result.adjustedCostBasis).toBeCloseTo(1500)
    expect(result.totalReturn).toBeCloseTo(400)
  })

  test('returns zeros when shares is missing', () => {
    const noShares = { symbol: 'AAPL', purchasePrice: 150 }
    const result = calculateHoldingMetrics(noShares, 190)
    expect(result.currentValue).toBe(0)
    expect(result.adjustedCostBasis).toBe(0)
  })
})
