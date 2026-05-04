export function Sparkline({ data, color = '#22c55e', width = 52, height = 24 }) {
  if (!data?.length) return <div style={{ width, height }} />
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / range) * height
  ])
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function makeRand(seed) {
  let s = seed
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

export function sparklinePoints(seed, n = 40) {
  const rand = makeRand(seed)
  const pts = []
  let v = 100
  for (let i = 0; i < n; i++) {
    v += (rand() - 0.5) * 4
    pts.push(v)
  }
  return pts
}
