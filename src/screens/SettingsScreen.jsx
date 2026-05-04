import { useState } from 'react'

export function SettingsScreen({
  currency, onToggleCurrency, onExportCsv,
  cloudAvailable, session, syncing,
  onSignIn, onSignOut,
  holdingsCount, transactionsCount,
  displayName, onSaveDisplayName,
}) {
  const email = session?.user?.email
  const emailDisplayName = email ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : 'You'
  const profileLabel = displayName || emailDisplayName
  const initial = profileLabel[0]?.toUpperCase() || 'U'
  const [notificationsOn, setNotificationsOn] = useState(() => localStorage.getItem('iq_notifications') !== 'false')

  function toggleNotifications() {
    const next = !notificationsOn
    setNotificationsOn(next)
    localStorage.setItem('iq_notifications', String(next))
  }

  return (
    <div className="overflow-y-auto no-scrollbar" style={{
      height: '100%',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 128px)',
      paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
    }}>
      <div className="mx-5 space-y-3 pt-3">

        <div className="glass-card p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-[24px] font-bold shrink-0"
              style={{ background: 'rgba(134,239,172,0.12)', border: '1.5px solid rgba(134,239,172,0.4)', color: '#86efac' }}>
              {initial}
            </div>
            <div>
              <div className="text-[20px] font-semibold tracking-tight">{profileLabel}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#86efac' }} />
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#86efac' }}>Premium Member</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card-small p-4">
          <div className="iq-label mb-3">Profile</div>
          <div className="text-[12px] text-white/50 mb-1.5">First Name (shown in greeting)</div>
          <input
            type="text"
            value={displayName || ''}
            onChange={e => onSaveDisplayName(e.target.value)}
            placeholder="Your first name"
            maxLength={32}
            className="glass-input w-full rounded-xl px-3 py-2 text-[14px] text-white outline-none"
          />
        </div>

        <div className="glass-card-small p-4">
          <div className="iq-label mb-3">Preferences</div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium">Base Currency</span>
              <button onClick={onToggleCurrency}
                className="pressable h-9 px-4 rounded-xl font-bold text-[13px] border-none cursor-pointer"
                style={{ border: '1px solid rgba(134,239,172,0.4)', color: '#86efac', background: 'rgba(134,239,172,0.06)' }}>
                {currency === 'ILS' ? 'ILS ₪' : 'USD $'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium">Notifications</span>
              <button onClick={toggleNotifications}
                className="pressable w-12 h-6 rounded-full relative transition-colors border-none cursor-pointer"
                style={{ background: notificationsOn ? '#86efac' : 'rgba(255,255,255,0.1)' }}>
                <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: notificationsOn ? '26px' : '2px' }} />
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card-small p-4">
          <div className="iq-label mb-3">Portfolio stats</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/3 rounded-2xl p-3">
              <div className="text-[11px] text-white/40 mb-1">Holdings</div>
              <div className="text-[24px] font-bold tracking-tight">{holdingsCount ?? 0}</div>
              <div className="text-[10px] text-white/30 mt-0.5">active positions</div>
            </div>
            <div className="bg-white/3 rounded-2xl p-3">
              <div className="text-[11px] text-white/40 mb-1">Transactions</div>
              <div className="text-[24px] font-bold tracking-tight">{transactionsCount ?? 0}</div>
              <div className="text-[10px] text-white/30 mt-0.5">all time</div>
            </div>
          </div>
        </div>

        <div className="glass-card-small p-4">
          <div className="iq-label mb-3">Data &amp; Security</div>
          <button onClick={onExportCsv}
            className="pressable w-full flex items-center justify-between h-11 px-1 border-none bg-transparent cursor-pointer text-white">
            <span className="text-[14px] font-medium">Export Ledger CSV</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {cloudAvailable && (
          <div className="glass-card-small p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="iq-label">Cloud sync</div>
              {syncing && <div className="text-[10px] text-emerald-400">Syncing…</div>}
            </div>
            {session ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[14px]"
                    style={{ background: 'rgba(134,239,172,0.1)', border: '1.5px solid rgba(134,239,172,0.5)', color: '#86efac' }}>
                    {email?.[0]?.toUpperCase() || '·'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{email}</div>
                    <div className="text-[11px] text-emerald-400">Synced across devices</div>
                  </div>
                </div>
                <button onClick={onSignOut}
                  className="pressable w-full h-10 rounded-xl border border-white/8 bg-white/4 text-white/80 font-semibold text-[12px] cursor-pointer">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div className="text-[12px] leading-relaxed mb-3" style={{ color: '#71717a' }}>
                  Optional: sign in to sync holdings, transactions, and budgets across all your devices.
                </div>
                <button onClick={onSignIn}
                  className="pressable w-full h-10 rounded-xl text-black font-bold text-[12px] border-none cursor-pointer"
                  style={{ background: '#86efac' }}>
                  Sign in / Create account
                </button>
              </>
            )}
          </div>
        )}

        <div className="pt-2 pb-1 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#86efac', boxShadow: '0 0 6px rgba(134,239,172,0.6)' }} />
            <span style={{ fontWeight: 300, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>IQ.FINANCE</span>
          </div>
          <div className="text-[10px]" style={{ color: '#3f3f46' }}>Luxury portfolio intelligence</div>
        </div>
      </div>
    </div>
  )
}
