function TabIcon({ type, active }) {
  const s = active ? '#86efac' : '#52525b'
  const p = { strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' }
  const st = { style: { transition: 'stroke 0.22s ease' } }
  if (type === 'networth') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <polyline points="3,17 7,11 11,14 17,7 21,10" stroke={s} {...p} {...st} />
      <line x1="3" y1="3" x2="3" y2="21" stroke={s} {...p} {...st} />
      <line x1="3" y1="21" x2="22" y2="21" stroke={s} {...p} {...st} />
    </svg>
  )
  if (type === 'cashflow') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={s} {...p} {...st} />
      <line x1="12" y1="7" x2="12" y2="8.5" stroke={s} {...p} {...st} />
      <line x1="12" y1="15.5" x2="12" y2="17" stroke={s} {...p} {...st} />
      <path d="M9.5 10a2.5 1.8 0 015 0c0 1.8-5 1.8-5 3.6a2.5 1.8 0 005 0" stroke={s} {...p} {...st} />
    </svg>
  )
  if (type === 'holdings') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2.5" stroke={s} {...p} {...st} />
      <circle cx="7" cy="9" r="1.3" fill={s} style={{ transition: 'fill 0.22s ease' }} />
      <circle cx="7" cy="14" r="1.3" fill={s} style={{ transition: 'fill 0.22s ease' }} />
      <line x1="11" y1="9" x2="18" y2="9" stroke={s} {...p} {...st} />
      <line x1="11" y1="14" x2="16" y2="14" stroke={s} {...p} {...st} />
    </svg>
  )
  if (type === 'settings') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.5" r="3.5" stroke={s} {...p} {...st} />
      <path d="M4 21c0-3.5 3.6-6 8-6s8 2.5 8 6" stroke={s} {...p} {...st} />
    </svg>
  )
  return null
}

function TabBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick}
      className="pressable flex-1 flex flex-col items-center gap-0.5 bg-transparent border-0 p-0 py-1 relative">
      {active && (
        <div style={{
          position: 'absolute', top: 0, left: '50%',
          width: 20, height: 2, borderRadius: 9999,
          background: '#86efac',
          boxShadow: '0 0 8px rgba(134,239,172,0.7)',
          animation: 'tabDotIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
          transformOrigin: 'center',
        }} />
      )}
      {icon}
      <span style={{
        fontSize: 7,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        fontWeight: 600,
        color: active ? '#86efac' : '#52525b',
        transition: 'color 0.22s ease',
      }}>{label}</span>
    </button>
  )
}

export function TabBar({ activeTab, onTabChange }) {
  const tabIcon = (key, active) => <TabIcon type={key} active={active} />
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center px-5 pt-2"
      style={{
        background: 'rgba(5,5,5,0.92)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderTop: '1px solid rgba(255,255,255,0.03)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
      }}>
      <TabBtn icon={tabIcon('networth', activeTab === 'networth')} label="Net Worth"
        active={activeTab === 'networth'} onClick={() => onTabChange('networth')} />
      <TabBtn icon={tabIcon('cashflow', activeTab === 'cashflow')} label="Cashflow"
        active={activeTab === 'cashflow'} onClick={() => onTabChange('cashflow')} />
      <TabBtn icon={tabIcon('holdings', activeTab === 'holdings')} label="Holdings"
        active={activeTab === 'holdings'} onClick={() => onTabChange('holdings')} />
      <TabBtn icon={tabIcon('settings', activeTab === 'settings')} label="Settings"
        active={activeTab === 'settings'} onClick={() => onTabChange('settings')} />
    </div>
  )
}
