# 📊 MyStock Portfolio Tracker

A modern personal stock portfolio tracking application with support for US stocks, Israeli TASE stocks, and cryptocurrency. Built with **React 19 + Vite + Tailwind CSS v4** and **Supabase** for cloud sync.

**Live:** https://idogal0210-web.github.io/portfolio-tracker

## ✨ Features

- 📈 **Multi-market tracking**: US stocks (Yahoo Finance), Israeli TASE (.TA), Crypto (-USD)
- 🔄 **Cloud sync**: Real-time data sync via Supabase
- 💱 **Dual currency**: Display in USD or ILS with live exchange rates
- 📊 **Portfolio analytics**: ROI, allocation charts, holding metrics
- 💰 **Cash flow tracking**: Income/expense transactions, budgets, recurring templates
- 📱 **Mobile-first design**: Dark glassmorphism UI for iPhone
- 🔐 **Secure auth**: Email/password authentication with Supabase
- 📤 **Export**: CSV export for transactions

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Supabase account (free tier works)
- RapidAPI account (free tier for Yahoo Finance)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/idogal0210-web/portfolio-tracker.git
   cd portfolio-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your keys:
   ```
   VITE_RAPIDAPI_KEY=your_key_from_rapidapi
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Copy your project URL and anon key
   - Go to SQL Editor and run the setup script below

5. **Create Supabase tables** (SQL Editor)
   ```sql
   -- Create profiles table
   CREATE TABLE profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     currency TEXT DEFAULT 'USD',
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Create holdings table
   CREATE TABLE holdings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     symbol TEXT NOT NULL,
     shares DECIMAL NOT NULL,
     purchase_price DECIMAL DEFAULT 0,
     fees DECIMAL DEFAULT 0,
     dividends DECIMAL DEFAULT 0,
     purchase_date DATE,
     created_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(user_id, symbol)
   );
   
   -- Create transactions table
   CREATE TABLE transactions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
     amount DECIMAL NOT NULL,
     currency TEXT DEFAULT 'USD',
     category TEXT NOT NULL,
     note TEXT,
     date DATE NOT NULL,
     recurring_template_id UUID,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Create budgets table
   CREATE TABLE budgets (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     category TEXT NOT NULL,
     amount DECIMAL NOT NULL,
     currency TEXT DEFAULT 'USD',
     created_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(user_id, category)
   );
   
   -- Create recurring_templates table
   CREATE TABLE recurring_templates (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
     amount DECIMAL NOT NULL,
     currency TEXT DEFAULT 'USD',
     category TEXT NOT NULL,
     note TEXT,
     cadence TEXT NOT NULL CHECK (cadence IN ('MONTHLY', 'YEARLY')),
     start_date DATE NOT NULL,
     last_materialized_date DATE,
     active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Create indexes
   CREATE INDEX idx_holdings_user ON holdings(user_id);
   CREATE INDEX idx_transactions_user ON transactions(user_id);
   CREATE INDEX idx_transactions_date ON transactions(date);
   CREATE INDEX idx_budgets_user ON budgets(user_id);
   CREATE INDEX idx_recurring_user ON recurring_templates(user_id);
   
   -- Enable RLS (Row Level Security)
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
   ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
   ALTER TABLE recurring_templates ENABLE ROW LEVEL SECURITY;
   
   -- Create RLS policies
   CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
   CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
   CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
   
   CREATE POLICY "Users can read own holdings" ON holdings FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own holdings" ON holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update own holdings" ON holdings FOR UPDATE USING (auth.uid() = user_id);
   CREATE POLICY "Users can delete own holdings" ON holdings FOR DELETE USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can read own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
   CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can read own budgets" ON budgets FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own budgets" ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update own budgets" ON budgets FOR UPDATE USING (auth.uid() = user_id);
   CREATE POLICY "Users can delete own budgets" ON budgets FOR DELETE USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can read own recurring templates" ON recurring_templates FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own recurring templates" ON recurring_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update own recurring templates" ON recurring_templates FOR UPDATE USING (auth.uid() = user_id);
   CREATE POLICY "Users can delete own recurring templates" ON recurring_templates FOR DELETE USING (auth.uid() = user_id);
   ```

6. **Get RapidAPI key**
   - Go to [rapidapi.com](https://rapidapi.com)
   - Search for "Yahoo Finance" API
   - Subscribe to the free tier
   - Copy your API key

7. **Start development server**
   ```bash
   npm run dev
   ```
   Open http://localhost:5173

## 📝 Available Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run preview    # Preview production build locally
npm test           # Run Vitest suite
npm run lint       # Run ESLint
```

## 🏗️ Project Structure

```
src/
├── App.jsx           # Main component (all UI in one file)
├── api.js            # Supabase & RapidAPI integrations
├── utils.js          # Core calculation logic
├── supabase.js       # Supabase client setup
├── index.css         # Tailwind + custom utilities
├── main.jsx          # App entry point
└── test/
    ├── setup.js      # Vitest configuration
    └── utils.test.js # Unit tests
```

## 🔐 GitHub Actions Deployment

The app auto-deploys to GitHub Pages on every push to `main`:

1. **Set GitHub Secrets** (Settings → Secrets and variables → Actions):
   ```
   RAPIDAPI_KEY=your_rapidapi_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

2. **Workflow** (`.github/workflows/deploy.yml`):
   - Install dependencies
   - Build with Vite
   - Deploy to `gh-pages` branch
   - Served via GitHub Pages

## 📊 Data Schema

### Holdings
```javascript
{
  id: UUID,
  user_id: UUID,
  symbol: string,           // e.g., "AAPL", "TEVA.TA", "BTC-USD"
  shares: number,
  purchase_price: number,   // For TASE: in agorot (÷100 = ₪)
  fees: number,
  dividends: number,
  purchase_date: date
}
```

### Transactions
```javascript
{
  id: UUID,
  user_id: UUID,
  type: "INCOME" | "EXPENSE",
  amount: number,
  currency: "USD" | "ILS",
  category: string,
  note: string,
  date: date,
  recurring_template_id: UUID?
}
```

### Budgets & Recurring Templates
Similar structure with category, amount, currency, cadence (MONTHLY/YEARLY).

## 🎨 Design System

- **Colors**: Dark glassmorphism with emerald accents
- **Typography**: System fonts (-apple-system, BlinkMacSystemFont)
- **Layout**: Mobile-first, 390px centered viewport
- **Components**: Reusable SVG charts, allocation bars, badges

## 🧪 Testing

Tests are located in `src/test/` and focus on core utilities:
```bash
npm test                          # Run all tests
npm run test -- src/test/file.js  # Run specific file
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Supabase not configured" | Check `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |
| "Could not fetch prices" | Check RapidAPI key is valid and has quota remaining |
| "Cannot read property of undefined" | Ensure Supabase tables are created with correct schema |
| Tests fail | Run `npm install` and ensure `src/test/setup.js` exists |
| Deployment fails | Verify all three GitHub Secrets are set correctly |

## 📚 API Reference

### Market Detection
- **US stocks**: Default (AAPL, MSFT, etc.)
- **Israeli stocks**: End with `.TA` (TEVA.TA, ICL.TA)
- **Crypto**: End with `-USD` (BTC-USD, ETH-USD)

### Price Caching
Prices are cached in Supabase with a 5-minute TTL. Fallback to localStorage on API failure.

### Exchange Rate
USD→ILS rate fetched daily. Fallback: 3.7

## 🔗 Links

- [Live App](https://idogal0210-web.github.io/portfolio-tracker)
- [GitHub Repo](https://github.com/idogal0210-web/portfolio-tracker)
- [Supabase Docs](https://supabase.com/docs)
- [React 19 Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)

## 📄 License

MIT

---

**Made with ❤️ by idogal0210**
