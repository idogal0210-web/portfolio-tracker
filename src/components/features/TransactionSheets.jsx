import { useState } from 'react'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../../utils/constants'
import { formatCurrency } from '../../utils/formatters'
import { CategoryIcon } from './TransactionComponents'

function SheetField({ label, children }) {
  return (
    <div>
      <div className="iq-label mb-1.5">{label}</div>
      {children}
    </div>
  )
}

export function AddTransactionSheet({ initial, defaultCurrency, onClose, onSave, onDelete }) {
  const isEdit = Boolean(initial?.id)
  const [type, setType] = useState(initial?.type || 'EXPENSE')
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [currency, setCurrency] = useState(initial?.currency || defaultCurrency || 'USD')
  const todayIso = new Date().toISOString().slice(0, 10)
  const presetList = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const [category, setCategory] = useState(initial?.category || presetList[0])
  const [date, setDate] = useState(initial?.date || todayIso)
  const [note, setNote] = useState(initial?.note || '')
  const [error, setError] = useState('')

  function changeType(next) {
    setType(next)
    const list = next === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    if (!list.includes(category)) setCategory(list[0])
  }

  function handleSubmit() {
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) return setError('Enter a positive amount')
    if (!date) return setError('Pick a date')
    setError('')
    onSave({
      ...(initial || {}),
      type, amount: amt, currency, category, date, note: note.trim(),
    })
    onClose()
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative text-white rounded-t-[28px] p-5 max-h-[92dvh] overflow-y-auto sheet-enter"
        style={{
          background: '#0A0A0A',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.6)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#27272a' }} />
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="iq-label mb-1">Cash flow</div>
            <span className="text-[20px] font-light tracking-tight">{isEdit ? 'Edit transaction' : 'New transaction'}</span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg border-none cursor-pointer">×</button>
        </div>

        <div className="flex gap-1 p-1 rounded-2xl bg-white/5 mb-4">
          {['EXPENSE', 'INCOME'].map(t => (
            <button key={t} onClick={() => changeType(t)}
              className={`flex-1 h-10 rounded-xl text-[13px] font-bold tracking-tight transition-colors border-none cursor-pointer ${
                type === t
                  ? (t === 'INCOME' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/15 text-rose-300')
                  : 'text-white/45 bg-transparent'
              }`}>
              {t === 'INCOME' ? 'Income' : 'Expense'}
            </button>
          ))}
        </div>

        {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

        <div className="space-y-3">
          <SheetField label="Amount">
            <div className="flex gap-2">
              <input className="sheet-input flex-1" type="number" inputMode="decimal" placeholder="0.00"
                value={amount} onChange={e => setAmount(e.target.value)} />
              <div className="flex p-1 rounded-xl bg-white/5">
                {['USD', 'ILS'].map(c => (
                  <button key={c} type="button" onClick={() => setCurrency(c)}
                    className={`px-3 h-[38px] rounded-lg text-[12px] font-bold border-none cursor-pointer ${
                      currency === c ? 'bg-white/10 text-white' : 'text-white/45 bg-transparent'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </SheetField>

          <SheetField label="Category">
            <select className="sheet-input"
              value={category} onChange={e => setCategory(e.target.value)}>
              {presetList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </SheetField>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Date">
              <div className="relative">
                <input className="sheet-input sheet-input-date" type="date"
                  value={date} onChange={e => setDate(e.target.value)} />
                {!date && (
                  <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-white/30 text-[14px] pointer-events-none select-none">
                    Select date
                  </span>
                )}
              </div>
            </SheetField>
            <SheetField label="Note">
              <input className="sheet-input" type="text" placeholder="Optional"
                value={note} onChange={e => setNote(e.target.value)} />
            </SheetField>
          </div>
        </div>

        {isEdit && (
          <button type="button" onClick={() => { onDelete(initial.id); onClose() }}
            className="w-full h-[44px] mt-4 rounded-2xl font-semibold text-[13px] tracking-tight text-rose-300 bg-rose-500/10 border border-rose-500/30 cursor-pointer">
            Delete transaction
          </button>
        )}

        <button onClick={handleSubmit}
          className="w-full h-[52px] mt-4 rounded-2xl font-bold text-[15px] tracking-tight text-black border-none cursor-pointer"
          style={{ background: '#86efac', boxShadow: '0 10px 30px rgba(134,239,172,0.25)' }}>
          {isEdit ? 'Save changes' : 'Save transaction'}
        </button>
      </div>
    </div>
  )
}

export function BudgetSheet({ budgets, defaultCurrency, onClose, onSave, onDelete }) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(budgets.map(b => [b.category, { amount: String(b.amount), currency: b.currency }]))
  )
  const currency = defaultCurrency || 'USD'

  function patch(cat, key, val) {
    setDrafts(prev => ({ ...prev, [cat]: { ...(prev[cat] || { amount: '', currency }), [key]: val } }))
  }

  function handleSaveAll() {
    for (const [cat, d] of Object.entries(drafts)) {
      const amt = parseFloat(d.amount)
      if (!Number.isFinite(amt) || amt < 0) continue
      onSave({ category: cat, amount: amt, currency: d.currency || currency })
    }
    onClose()
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative text-white rounded-t-[28px] p-5 max-h-[88dvh] overflow-y-auto sheet-enter"
        style={{ background: '#0A0A0A', boxShadow: '0 -20px 40px rgba(0,0,0,0.6)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#27272a' }} />
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="iq-label mb-1">Activity</div>
            <span className="text-[20px] font-light tracking-tight">Monthly budgets</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg border-none cursor-pointer">×</button>
        </div>
        <div className="space-y-2">
          {EXPENSE_CATEGORIES.filter(c => c !== 'Other').map(cat => {
            const d = drafts[cat] || { amount: '', currency }
            return (
              <div key={cat} className="flex items-center gap-2">
                <CategoryIcon category={cat} type="EXPENSE" size={32} />
                <span className="flex-1 text-[13px] font-medium text-white/80">{cat}</span>
                <input type="number" inputMode="decimal" placeholder="0"
                  className="w-24 h-9 rounded-xl border border-white/8 bg-white/3 text-white text-[14px] px-3 outline-none font-tabular"
                  value={d.amount} onChange={e => patch(cat, 'amount', e.target.value)} />
                <button onClick={() => patch(cat, 'currency', d.currency === 'USD' ? 'ILS' : 'USD')}
                  className="w-11 h-9 rounded-xl border border-white/8 bg-white/3 text-[11px] font-bold text-white/60 cursor-pointer">
                  {d.currency || currency}
                </button>
                {budgets.find(b => b.category === cat) && (
                  <button onClick={() => onDelete(cat)} className="text-rose-400 text-[18px] leading-none px-1 border-none bg-transparent cursor-pointer">×</button>
                )}
              </div>
            )
          })}
        </div>
        <button onClick={handleSaveAll}
          className="w-full h-[52px] mt-5 rounded-2xl font-bold text-[15px] tracking-tight text-black border-none cursor-pointer"
          style={{ background: '#86efac', boxShadow: '0 10px 30px rgba(134,239,172,0.25)' }}>
          Save budgets
        </button>
      </div>
    </div>
  )
}

export function RecurringSheet({ templates, defaultCurrency, onClose, onSave, onDelete }) {
  const blank = { type: 'EXPENSE', amount: '', currency: defaultCurrency || 'USD', category: EXPENSE_CATEGORIES[0], note: '', cadence: 'MONTHLY', start_date: new Date().toISOString().slice(0, 10), active: true }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')

  function handleAdd() {
    const amt = parseFloat(form.amount)
    if (!Number.isFinite(amt) || amt <= 0) return setError('Enter a positive amount')
    if (!form.start_date) return setError('Pick a start date')
    setError('')
    onSave({ ...form, amount: amt })
    setAdding(false); setForm(blank)
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative text-white rounded-t-[28px] p-5 max-h-[92dvh] overflow-y-auto sheet-enter"
        style={{ background: '#0A0A0A', boxShadow: '0 -20px 40px rgba(0,0,0,0.6)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#27272a' }} />
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="iq-label mb-1">Activity</div>
            <span className="text-[20px] font-light tracking-tight">Recurring</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-lg border-none cursor-pointer">×</button>
        </div>
        {templates.length === 0 && !adding && (
          <p className="text-[13px] text-center py-6" style={{ color: '#52525b' }}>No recurring transactions yet.</p>
        )}
        {templates.map(t => (
          <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-white/5">
            <CategoryIcon category={t.category} type={t.type} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold">{t.category} · {formatCurrency(t.amount, t.currency)}</div>
              <div className="text-[11px]" style={{ color: '#71717a' }}>{t.cadence} from {t.start_date}</div>
            </div>
            <button onClick={() => onSave({ ...t, active: !t.active })}
              className={`text-[11px] font-bold px-2 py-1 rounded-lg border-none cursor-pointer ${t.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
              {t.active ? 'ON' : 'OFF'}
            </button>
            <button onClick={() => onDelete(t.id)} className="text-rose-400 text-[18px] px-1 border-none bg-transparent cursor-pointer">×</button>
          </div>
        ))}
        {adding ? (
          <div className="mt-4 space-y-3">
            <div className="flex gap-1 p-1 rounded-2xl bg-white/5">
              {['EXPENSE', 'INCOME'].map(t => (
                <button key={t} onClick={() => { setForm(f => ({ ...f, type: t, category: (t === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0] })) }}
                  className={`flex-1 h-9 rounded-xl text-[12px] font-bold border-none cursor-pointer ${form.type === t ? (t === 'INCOME' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/15 text-rose-300') : 'text-white/45 bg-transparent'}`}>
                  {t === 'INCOME' ? 'Income' : 'Expense'}
                </button>
              ))}
            </div>
            {error && <p className="text-rose-400 text-xs">{error}</p>}
            <SheetField label="Amount">
              <div className="flex gap-2">
                <input className="sheet-input flex-1" type="number" inputMode="decimal" placeholder="0.00"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                <button onClick={() => setForm(f => ({ ...f, currency: f.currency === 'USD' ? 'ILS' : 'USD' }))}
                  className="px-3 h-[46px] rounded-xl border border-white/8 bg-white/3 text-[12px] font-bold text-white/70 cursor-pointer">
                  {form.currency}
                </button>
              </div>
            </SheetField>
            <SheetField label="Category">
              <select className="sheet-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {(form.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </SheetField>
            <div className="grid grid-cols-2 gap-3">
              <SheetField label="Cadence">
                <select className="sheet-input" value={form.cadence} onChange={e => setForm(f => ({ ...f, cadence: e.target.value }))}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </SheetField>
              <SheetField label="Start date">
                <div className="relative">
                  <input className="sheet-input sheet-input-date" type="date"
                    value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
              </SheetField>
            </div>
            <SheetField label="Note (optional)">
              <input className="sheet-input" placeholder="e.g. Monthly rent"
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </SheetField>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setAdding(false)} className="flex-1 h-11 rounded-2xl bg-white/5 text-white/70 font-semibold text-[13px] border-none cursor-pointer">Cancel</button>
              <button onClick={handleAdd} className="flex-1 h-11 rounded-2xl font-bold text-[13px] text-black border-none cursor-pointer" style={{ background: '#86efac' }}>Add</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full h-11 mt-4 rounded-2xl border border-white/10 bg-white/3 text-white/70 font-semibold text-[13px] cursor-pointer">
            + Add recurring
          </button>
        )}
      </div>
    </div>
  )
}
