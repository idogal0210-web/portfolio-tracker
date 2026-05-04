import { useState } from 'react'
import { signUp, signInWithPassword } from '../../api'

export function AuthSheet({ onClose, onSignedIn }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setInfo('')
    if (!email || !password) return setError('Email and password are required')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const session = await signUp(email, password)
        if (session) { onSignedIn(session); onClose() }
        else setInfo('Check your inbox to confirm your email, then sign in.')
      } else {
        const session = await signInWithPassword(email, password)
        onSignedIn(session)
        onClose()
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative text-white rounded-t-[28px] p-5 max-h-[92dvh] overflow-y-auto sheet-enter"
        style={{
          background: '#0A0A0A',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.6)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#27272a' }} />
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="iq-label mb-1">Account</div>
            <span className="text-[20px] font-light tracking-tight">
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </span>
          </div>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg border-none cursor-pointer">×</button>
        </div>
        <div className="text-[12px] leading-relaxed mb-4" style={{ color: '#71717a' }}>
          Your local data will be merged with the cloud on first sign-in.
        </div>

        <div className="space-y-3">
          <div>
            <div className="iq-label mb-1.5">Email</div>
            <input className="sheet-input" type="email" autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <div className="iq-label mb-1.5">Password</div>
            <input className="sheet-input" type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>

        {error && <p className="text-rose-400 text-xs mt-3">{error}</p>}
        {info && <p className="text-emerald-400 text-xs mt-3">{info}</p>}

        <button type="submit" disabled={busy}
          className="w-full h-[48px] mt-5 rounded-2xl font-bold text-[14px] tracking-tight text-black disabled:opacity-50 border-none cursor-pointer"
          style={{ background: '#86efac' }}>
          {busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>

        <div className="mt-4 text-center text-[12px] text-white/50">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" style={{ color: '#86efac' }} className="font-semibold border-none bg-transparent cursor-pointer"
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setInfo('') }}>
            {mode === 'signup' ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </form>
    </div>
  )
}
