import { useState } from 'react'
import { isILStock, isCrypto } from '../../utils'

function SheetField({ label, children }) {
  return (
    <div>
      <div className="iq-label mb-1.5">{label}</div>
      {children}
    </div>
  )
}

export function AddHoldingSheet({ onClose, onAdd }) {
  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [fees, setFees] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [error, setError] = useState('')

  const sym = symbol.trim().toUpperCase()
  const isTASE = isILStock(sym)
  const isCryptoSym = isCrypto(sym)
  const marketLabel = isTASE ? 'Israeli stock (TASE)' : isCryptoSym ? 'Cryptocurrency' : 'US stock'
  const marketColor = isTASE ? '#6366f1' : isCryptoSym ? '#f59e0b' : 'rgba(255,255,255,0.35)'
  const priceLabel = isTASE ? 'Price (agorot)' : isCryptoSym ? 'Price (USD)' : 'Price (USD)'
  const feesLabel = isTASE ? 'Fees (₪)' : 'Fees ($)'

  function handleSubmit() {
    const cleanSym = sym
    if (!cleanSym) return setError('Ticker is required')
    const qty = parseFloat(shares)
    if (!qty || qty <= 0) return setError('Enter a valid quantity')
    const fmtRegex = /^[A-Z0-9]+(\.[A-Z]{2,4}|-USD)?$/
    if (!fmtRegex.test(cleanSym)) return setError('Invalid ticker format (e.g. AAPL, TEVA.TA, BTC-USD)')
    setError('')
    onAdd({
      symbol: cleanSym,
      shares: qty,
      purchasePrice: parseFloat(purchasePrice) || 0,
      fees: parseFloat(fees) || 0,
      dividends: 0,
      purchaseDate,
    })
    onClose()
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative text-white rounded-t-[28px] p-5 sheet-enter"
        style={{
          background: '#0A0A0A',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.6)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#27272a' }} />
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="iq-label mb-1">Portfolio</div>
            <span className="text-[20px] font-light tracking-tight">Add holding</span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg border-none cursor-pointer">×</button>
        </div>

        {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

        <div className="space-y-3">
          <SheetField label="Ticker symbol">
            <input className="sheet-input" placeholder="e.g. AAPL, TEVA.TA, BTC-USD"
              value={symbol} onChange={e => setSymbol(e.target.value)} autoCapitalize="characters" />
            {sym && (
              <p className="text-[10px] mt-1 font-semibold" style={{ color: marketColor }}>
                {marketLabel}
              </p>
            )}
          </SheetField>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Quantity">
              <input className="sheet-input" type="number" placeholder="0.00" inputMode="decimal"
                value={shares} onChange={e => setShares(e.target.value)} />
            </SheetField>
            <SheetField label={priceLabel}>
              <input className="sheet-input" type="number" placeholder="0.00" inputMode="decimal"
                value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
              {isTASE && <p className="text-[10px] text-white/30 mt-1">100 agorot = ₪1</p>}
            </SheetField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label={feesLabel}>
              <input className="sheet-input" type="number" placeholder="0.00" inputMode="decimal"
                value={fees} onChange={e => setFees(e.target.value)} />
            </SheetField>
            <SheetField label="Date">
              <div className="relative">
                <input className="sheet-input sheet-input-date" type="date"
                  value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                {!purchaseDate && (
                  <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-white/30 text-[14px] pointer-events-none select-none">
                    Select date
                  </span>
                )}
              </div>
            </SheetField>
          </div>
        </div>

        <button onClick={handleSubmit}
          className="pressable w-full h-[52px] mt-5 rounded-2xl font-bold text-[15px] tracking-tight text-black border-none cursor-pointer"
          style={{ background: '#86efac', boxShadow: '0 10px 30px rgba(134,239,172,0.25)' }}>
          Save investment
        </button>
      </div>
    </div>
  )
}
