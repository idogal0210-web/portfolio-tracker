export function AllocationBar({ slices }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  return (
    <div className="flex w-full h-2 rounded-full overflow-hidden bg-white/5 bar-enter">
      {slices.map((s, i) => (
        <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
      ))}
    </div>
  )
}
