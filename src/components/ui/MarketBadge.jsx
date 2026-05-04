export function MarketBadge({ market }) {
  const styles = {
    IL: 'bg-blue-500/15 text-blue-400',
    US: 'bg-white/8 text-white/55',
    CRYPTO: 'bg-orange-500/15 text-orange-400',
  }
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${styles[market] ?? styles.US}`}>
      {market}
    </span>
  )
}
