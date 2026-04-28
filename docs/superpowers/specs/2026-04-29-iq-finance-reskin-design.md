# IQ.FINANCE Reskin — Design Spec
**Date:** 2026-04-29  
**Status:** Approved

## Summary

Apply the IQ.FINANCE luxury visual aesthetic to `src/App.jsx` without changing tab structure, routing, or any business logic. All existing features (Yahoo Finance prices, Supabase sync, budgets, recurring transactions, CSV export, TASE/crypto detection) remain untouched. Two new AI features are added behind `VITE_GEMINI_KEY`.

---

## Color System

| Role | Current | New |
|------|---------|-----|
| UI chrome (active tabs, labels, borders, buttons) | `#22c55e` emerald | `#D4AF37` gold |
| Financial positive (gains, income, ROI up) | `#22c55e` emerald | `#22c55e` emerald — unchanged |
| Financial negative (losses, expenses) | `#ef4444` / `#f43f5e` rose | unchanged |
| Background | `#050505` | `#050505` — unchanged |
| Muted text | `rgba(255,255,255,0.45)` | `#71717a` zinc-500 |

---

## Typography

- Add Inter from Google Fonts: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap">` in `index.html`
- Large value numbers: `font-weight: 200` (extralight), tight letter-spacing
- Section labels: `text-[7-8px] uppercase tracking-[0.3-0.5em]` in gold or zinc-600
- Tab labels: `text-[7px] tracking-[0.2em] uppercase font-semibold`

---

## Component Changes

### Header (new sticky header)
Replace the per-screen headers with a single sticky app header:
- Left: gold dot glow + `IQ.FINANCE` wordmark (uppercase, tracking-wide, font-light)
- Right: currency toggle button (styled as small bordered pill in gold/zinc) + refresh icon
- Background: `bg-[#050505]/80 backdrop-blur-2xl border-b border-white/[0.03]`

### Tab Bar
Keep existing 4 tabs (Home / Markets / Activity / You) + center FAB. Restyle:
- Active tab: gold `#D4AF37`
- Inactive tab: `#52525b` zinc-600
- Labels: `text-[7px] tracking-[0.2em] uppercase font-semibold`
- Background: `bg-[#050505]/90 backdrop-blur-3xl border-t border-white/[0.03]`
- FAB: gold background `#D4AF37`, black `+` icon, gold glow shadow

### Glass Cards (`glass-card`, `glass-card-small`)
Update CSS utilities in `index.css`:
- `glass-card`: `background: rgba(255,255,255,0.01)`, `border: 1px solid rgba(255,255,255,0.03)`, `border-radius: 2rem`
- `glass-card-small`: same but `border-radius: 1.5rem`
- Add new `glass-panel`: `background: linear-gradient(135deg, rgba(255,255,255,0.03), transparent)`, `border: 1px solid rgba(255,255,255,0.04)`

### Portfolio Screen (Home tab)
- Header section: replace with sticky IQ header (shared across all tabs)
- Net worth display: centered, `text-5xl font-extralight tracking-tighter`, gold label above
- Stats row: replace current gain badges with income/expense grid cards (IQ style)
- Chart + allocation: keep as-is, update colors (gold glow instead of green on allocation bar active state)
- Holdings list: update `HoldingRow` — IQ card style per holding, gold icon ring, zinc currency badge

### Activity Screen
- Header: uses shared sticky header
- Month picker: restyle with `glass-panel rounded-3xl`, gold month name
- Summary card: 3-col income/expenses/net grid, gold net label
- Transaction rows: update `TransactionRow` — left accent bar (green income / rose expense), zinc note text
- Add **Scan button** to header: calls Gemini vision API with uploaded receipt/CSV → auto-creates transactions

### Bottom Sheets (AddHoldingSheet, AddTransactionSheet, BudgetSheet, RecurringSheet)
- Sheet background: `#0A0A0A`
- Drag handle: `bg-zinc-800`
- Title: gold overline label + white heading, font-light
- Inputs: borderless bottom-border style OR existing `sheet-input` class (keep functional, update colors)
- Submit button: gold background for primary actions, gold-bordered transparent for secondary
- Type toggle (Income/Expense): emerald for income active, rose for expense active — unchanged

### YouScreen / Settings
- Profile card: gold ring avatar
- Currency row: gold dropdown value
- Sign in button: gold background instead of green

### Holding Detail (HoldingDetail)
- Chart accent color: keep green for up, rose for down (financial signal — unchanged)
- Back button, range tabs, stats: minimal updates to border/text colors

---

## New Features

### AI Insights (Home tab)
- Button: `Get AI Insights` — gold gradient border, wand icon, only visible when `VITE_GEMINI_KEY` is set
- On click: sends portfolio + transactions summary to `gemini-2.5-flash` via `https://generativelanguage.googleapis.com/v1beta/...`
- Response: shown in collapsible panel below button, `whitespace-pre-wrap`, zinc-300 text
- Loading state: spinning wand icon, button disabled
- Error state: "Unable to fetch insights" in zinc-500
- If `VITE_GEMINI_KEY` not set: button hidden entirely

### Document Scan (Activity tab)
- Button: `Scan` in Activity header — gold bordered, document icon
- Triggers hidden `<input type="file" accept=".csv,.pdf,image/*">`
- CSV files: send as text to Gemini with schema prompt
- Images/PDFs: encode as base64, send as `inlineData` to Gemini vision
- Gemini returns JSON array of `{amount, category, note, currency, type}`
- Each parsed entry → `handleSaveTxn()` with today's date
- Loading state: spinner on Scan button, disabled
- Error: alert on parse failure
- If `VITE_GEMINI_KEY` not set: Scan button hidden

### Gemini helper (`src/gemini.js`)
New utility module:
```
callGemini(payload, isJson) → Promise<string | object>
```
- POST to Gemini REST endpoint with `VITE_GEMINI_KEY`
- Retry up to 3× with exponential backoff
- Throws on repeated failure

---

## CSS Updates (`src/index.css`)

- Update `glass-card`, `glass-card-small` border-radius and background to IQ values
- Add `.glass-panel` utility
- Add `.iq-label` utility: `font-size: 7px; letter-spacing: 0.4em; text-transform: uppercase; color: #D4AF37`
- Keep `.no-scrollbar`, `.sheet-input` unchanged

---

## Files Changed

| File | Change |
|------|--------|
| `index.html` | Add Inter font link |
| `src/index.css` | Update glass utilities, add `.glass-panel`, `.iq-label` |
| `src/App.jsx` | Restyle all components; add AI Insights + Scan features |
| `src/gemini.js` | New — Gemini API helper |

**No changes to:** `src/utils.js`, `src/api.js`, `vite.config.js`, `package.json`

---

## Out of Scope

- Tab renaming or restructuring
- Markets tab implementation
- Changing data model or localStorage schema
- Supabase schema changes
