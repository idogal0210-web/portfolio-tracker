import { convertAmount } from './formatters.js'

export const newId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const csvField = (value) => {
  const s = value == null ? '' : String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export const toCSV = (transactions, displayCurrency, exchangeRate) => {
  const header = ['date', 'type', 'category', 'amount', 'currency',
    `amount_${displayCurrency.toLowerCase()}`, 'note']
  const rows = [header.join(',')]
  for (const t of transactions || []) {
    const converted = convertAmount(t.amount || 0, t.currency, displayCurrency, exchangeRate)
    const signed = t.type === 'EXPENSE' ? -converted : converted
    rows.push([
      csvField(t.date),
      csvField(t.type),
      csvField(t.category),
      csvField(t.amount),
      csvField(t.currency),
      csvField(signed.toFixed(2)),
      csvField(t.note || ''),
    ].join(','))
  }
  return rows.join('\r\n') + '\r\n'
}
