export function FloatingActionButton({ onClick }) {
  return (
    <button onClick={onClick}
      className="pressable absolute z-20 w-[52px] h-[52px] rounded-full flex items-center justify-center"
      style={{
        right: '20px',
        bottom: 'calc(env(safe-area-inset-bottom) + 72px)',
        background: '#86efac',
        boxShadow: '0 6px 24px rgba(134,239,172,0.45)',
      }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </button>
  )
}
