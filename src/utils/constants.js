export const INCOME_CATEGORIES = Object.freeze([
  'Salary', 'Dividends', 'Interest', 'Bonus', 'Gift', 'Refund', 'Other',
])

export const EXPENSE_CATEGORIES = Object.freeze([
  'Housing', 'Food', 'Transport', 'Utilities', 'Health', 'Entertainment',
  'Subscriptions', 'Insurance', 'Education', 'Travel', 'Shopping', 'Tax', 'Other',
])

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const CATEGORY_EMOJI = {
  Salary: '💰', Dividends: '📈', Interest: '🏦', Bonus: '🎁',
  Gift: '🎀', Refund: '↩', Other: '✨',
  Housing: '🏠', Food: '🍽', Transport: '🚗', Utilities: '💡',
  Health: '🩺', Entertainment: '🎬', Subscriptions: '🔁',
  Insurance: '🛡', Education: '🎓', Travel: '✈', Shopping: '🛍', Tax: '🧾',
}

export function categoryColor(name) {
  const LOGO_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#f97316','#14b8a6']
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return LOGO_COLORS[Math.abs(h) % LOGO_COLORS.length]
}

export function formatDateLabel(isoDate) {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (isoDate === today) return 'Today'
  if (isoDate === yesterday) return 'Yesterday'
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`
}
