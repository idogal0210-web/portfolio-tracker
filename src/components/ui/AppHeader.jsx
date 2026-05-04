export function AppHeader({ currency, onToggleCurrency, onRefresh, loading }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
        paddingBottom: '12px',
        background: 'rgba(5,5,5,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
      }}>
      <div className="flex items-center gap-2.5">
        <div className="accent-glow" style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#86efac',
        }} />
        <span style={{
          fontWeight: 300,
          fontSize: 13,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'white',
        }}>IQ.FINANCE</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onToggleCurrency}
          className="pressable h-7 px-3 rounded-full text-[10px] font-semibold"
          style={{ border: '1px solid rgba(134,239,172,0.4)', color: '#86efac', background: 'rgba(134,239,172,0.06)' }}>
          {currency}
        </button>
        <button onClick={onRefresh} disabled={loading}
          className="pressable w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={loading ? 'animate-spin' : ''}>
            <path d="M21 12a9 9 0 11-3.5-7.1M21 3v6h-6" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
