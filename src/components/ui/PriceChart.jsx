import { useState, useEffect } from 'react'

export function PriceChart({ data, color = '#22c55e', width = 360, height = 120, formatValue }) {
  const [tooltip, setTooltip] = useState(null)
  
  useEffect(() => {
    setTooltip(null)
  }, [data])

  if (!data?.length) return <div style={{ width, height }} />
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pad = 6
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    pad + (1 - (v - min) / range) * (height - pad * 2)
  ])
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i]
    const mx = (px + cx) / 2
    d += ` Q${px.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${((py + cy) / 2).toFixed(1)} T${cx.toFixed(1)} ${cy.toFixed(1)}`
  }
  const area = `${d} L${width} ${height} L0 ${height} Z`
  const id = `pc${color.replace(/[^a-z0-9]/gi, '')}`

  const fmt = formatValue ?? (v => `$${v < 1 ? v.toFixed(4) : v.toFixed(2)}`)

  const handleMove = (e) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const relX = Math.max(0, Math.min(clientX - rect.left, width))
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((relX / width) * (data.length - 1))))
    setTooltip({ x: pts[idx][0], y: pts[idx][1], value: data[idx] })
  }

  const tipW = 82
  const tipH = 26
  const tipX = tooltip ? Math.max(4, Math.min(tooltip.x - tipW / 2, width - tipW - 4)) : 0
  const tipY = tooltip ? (tooltip.y < 44 ? tooltip.y + 10 : tooltip.y - tipH - 8) : 0

  return (
    <svg width={width} height={height} style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
      onMouseMove={handleMove} onMouseLeave={() => setTooltip(null)}
      onTouchMove={handleMove} onTouchEnd={() => setTooltip(null)}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {tooltip && (
        <>
          <line x1={tooltip.x.toFixed(1)} y1={0} x2={tooltip.x.toFixed(1)} y2={height}
            stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="4,3" />
          <circle cx={tooltip.x.toFixed(1)} cy={tooltip.y.toFixed(1)} r={4.5}
            fill={color} stroke="#000" strokeWidth="2" />
          <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={8}
            fill="rgba(10,10,15,0.88)" stroke={`${color}55`} strokeWidth="1" />
          <text x={tipX + tipW / 2} y={tipY + 17} fill="white" fontSize={11} fontWeight="700"
            textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif">
            {fmt(tooltip.value)}
          </text>
        </>
      )}
    </svg>
  )
}
