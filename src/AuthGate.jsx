import { useEffect, useState } from 'react'
import {
  getSession, signInWithPassword, signUp, onAuthChange, supabaseConfigured,
} from './api'

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured) {
      setChecked(true)
      return
    }
    let mounted = true
    getSession().then(s => {
      if (!mounted) return
      setSession(s)
      setChecked(true)
    })
    const unsub = onAuthChange(s => {
      if (!mounted) return
      setSession(s)
    })
    return () => { mounted = false; unsub() }
  }, [])

  if (!supabaseConfigured) {
    return <ConfigMissingScreen />
  }

  if (!checked) {
    return <LoadingScreen />
  }

  if (!session) {
    return <LoginScreen onSignedIn={setSession} />
  }

  return children
}

function LoadingScreen() {
  return (
    <div className="bg-[#050505] text-white flex items-center justify-center"
      style={{ minHeight: '100dvh' }}>
      <div className="text-white/50 text-[13px]">Loading…</div>
    </div>
  )
}

function ConfigMissingScreen() {
  return (
    <div className="bg-[#050505] text-white flex items-center justify-center px-6"
      style={{ minHeight: '100dvh' }}>
      <div className="max-w-sm">
        <div className="text-[20px] font-bold tracking-tight mb-2">Setup required</div>
        <div className="text-white/60 text-[13px] leading-relaxed">
          Set <code className="text-white/85">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-white/85">VITE_SUPABASE_ANON_KEY</code> in your environment to enable login.
        </div>
      </div>
    </div>
  )
}

function LoginScreen({ onSignedIn }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setInfo('')
    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const session = await signUp(email, password)
        if (session) onSignedIn(session)
        else setInfo('Check your inbox to confirm your email, then sign in.')
      } else {
        const session = await signInWithPassword(email, password)
        onSignedIn(session)
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-[#050505] text-white flex items-center justify-center px-5"
      style={{
        minHeight: '100dvh',
        backgroundImage: 'radial-gradient(at 85% 15%, rgba(99,102,241,0.10), transparent 55%), radial-gradient(at 10% 85%, rgba(37,99,235,0.06), transparent 60%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="text-[12px] font-medium text-white/45 mb-1">Portfolio</div>
        <div className="text-[28px] font-bold tracking-tight mb-6">
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">Email</div>
            <input className="sheet-input" type="email" autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">Password</div>
            <input className="sheet-input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>

        {error && <p className="text-rose-400 text-xs mt-3">{error}</p>}
        {info && <p className="text-emerald-400 text-xs mt-3">{info}</p>}

        <button type="submit" disabled={busy}
          className="w-full h-[52px] mt-5 rounded-2xl font-bold text-[15px] tracking-tight text-black disabled:opacity-50"
          style={{ background: '#22c55e', boxShadow: '0 10px 30px rgba(34,197,94,0.3)' }}>
          {busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>

        <div className="mt-4 text-center text-[12px] text-white/50">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="text-emerald-400 font-semibold"
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setInfo('') }}>
            {mode === 'signup' ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </form>

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
        }
        .sheet-input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  )
}
