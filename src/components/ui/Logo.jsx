import { isCrypto, displaySymbol } from '../../utils'

const LOGO_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#f97316','#14b8a6']

const CRYPTO_COLORS = {
  BTC:  '#f7931a',
  ETH:  '#8b5cf6',
  SOL:  '#d946ef',
  ADA:  '#3468dc',
  DOGE: '#c2a633',
  XRP:  '#00a4d3',
}

export function generateLogo(ticker) {
  const base = displaySymbol(ticker).replace('.TA', '').toUpperCase()
  if (isCrypto(ticker) && CRYPTO_COLORS[base]) {
    return { bg: CRYPTO_COLORS[base], char: base[0] }
  }
  return { bg: LOGO_COLORS[base.charCodeAt(0) % LOGO_COLORS.length], char: base[0] }
}

export function Logo({ ticker, size = 40 }) {
  const { bg, char } = generateLogo(ticker)
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.42 }}>
      {char}
    </div>
  )
}
