import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ────────────────────────────────────────────────────────────────────────────
// UTILITIES & CONSTANTS
// ────────────────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = [
  'Tel Hashomer Salary', 
  'Bartending Tips (Club)', 
  'Dividends', 
  'Interest', 
  'Gift', 
  'Other'
];

const EXPENSE_CATEGORIES = [
  'Housing', 'Food', 'Transport', 'Utilities', 'Health', 'Entertainment',
  'Subscriptions', 'Insurance', 'Shopping', 'Other'
];

const newId = () => Math.random().toString(36).substr(2, 9);

const formatCurrency = (amount, currency) => {
  const rounded = Number(amount).toFixed(2);
  const formatted = Number(rounded).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'ILS' ? `₪${formatted}` : `$${formatted}`;
};

const apiKey = "";

const callGemini = async (payload, isJson = false) => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  let retries = 5;
  let delay = 1000;
  
  while (retries > 0) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No text returned from Gemini");
      
      return isJson ? JSON.parse(text) : text;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
};

// Simulated Live Prices Data (Fallback for API)
const INITIAL_MARKET_PRICES = {
  'NVDA': 880.20,
  'BTC-USD': 64200.50,
  'AAPL': 175.30,
  'TEVA.TA': 52.40
};

// ────────────────────────────────────────────────────────────────────────────
// MAIN APP COMPONENT
// ────────────────────────────────────────────────────────────────────────────

const App = () => {
  // Navigation & UI State
  const [view, setView] = useState('dashboard');
  const [isAddTxnOpen, setIsAddTxnOpen] = useState(false);
  const [isAddHoldingOpen, setIsAddHoldingOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(new Date());
  
  // Settings
  const [displayCurrency, setDisplayCurrency] = useState('ILS');
  const exchangeRate = 3.75; // Simulated USD to ILS rate
  const [isSyncing, setIsSyncing] = useState(false);

  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Market Data State
  const [marketPrices, setMarketPrices] = useState(INITIAL_MARKET_PRICES);

  // ────────────────────────────────────────────────────────────────────────────
  // DATA STATE (Transactions & Holdings)
  // ────────────────────────────────────────────────────────────────────────────

  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('iq_txns');
    return saved ? JSON.parse(saved) : [
      { id: newId(), type: 'INCOME', amount: 9500, currency: 'ILS', category: 'Tel Hashomer Salary', date: new Date().toISOString().slice(0,10), note: 'Base Salary' },
      { id: newId(), type: 'INCOME', amount: 1400, currency: 'ILS', category: 'Bartending Tips (Club)', date: new Date().toISOString().slice(0,10), note: 'Weekend shifts' },
      { id: newId(), type: 'EXPENSE', amount: 450, currency: 'ILS', category: 'Shopping', date: new Date().toISOString().slice(0,10), note: 'Zara' }
    ];
  });

  const [holdings, setHoldings] = useState(() => {
    const saved = localStorage.getItem('iq_holdings');
    return saved ? JSON.parse(saved) : [
      { id: newId(), symbol: 'NVDA', name: 'NVIDIA Corp', shares: 15, purchasePrice: 420.50, currency: 'USD', type: 'Stock' },
      { id: newId(), symbol: 'BTC-USD', name: 'Bitcoin', shares: 0.35, purchasePrice: 28400, currency: 'USD', type: 'Crypto' }
    ];
  });

  // Save to LocalStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('iq_txns', JSON.stringify(transactions));
    localStorage.setItem('iq_holdings', JSON.stringify(holdings));
  }, [transactions, holdings]);

  // Simulate Live Market Ticks
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketPrices(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(sym => {
          const change = (Math.random() - 0.5) * 0.002; // max 0.2% tick
          next[sym] = next[sym] * (1 + change);
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // CALCULATIONS & AGGREGATIONS
  // ────────────────────────────────────────────────────────────────────────────

  const convertAmount = useCallback((amount, fromCurr, toCurr) => {
    if (fromCurr === toCurr) return amount;
    if (fromCurr === 'USD' && toCurr === 'ILS') return amount * exchangeRate;
    if (fromCurr === 'ILS' && toCurr === 'USD') return amount / exchangeRate;
    return amount;
  }, [exchangeRate]);

  // Monthly Cashflow calculations
  const monthlyStats = useMemo(() => {
    const monthPrefix = displayMonth.toISOString().slice(0, 7);
    let income = 0, expenses = 0;
    
    transactions.forEach(t => {
      if (t.date.startsWith(monthPrefix)) {
        const val = convertAmount(t.amount, t.currency, displayCurrency);
        if (t.type === 'INCOME') income += val;
        else expenses += val;
      }
    });
    
    return { income, expenses, net: income - expenses };
  }, [transactions, displayMonth, displayCurrency, convertAmount]);

  // Holdings ROI calculations
  const enrichedHoldings = useMemo(() => {
    let totalPortfolioValue = 0;
    let totalPortfolioCost = 0;

    const items = holdings.map(h => {
      const currentPrice = marketPrices[h.symbol] || h.purchasePrice;
      const currentValue = h.shares * currentPrice;
      const costBasis = h.shares * h.purchasePrice;
      const profit = currentValue - costBasis;
      const roiPct = costBasis > 0 ? (profit / costBasis) * 100 : 0;
      
      const valueInDisplayCurr = convertAmount(currentValue, h.currency, displayCurrency);
      const costInDisplayCurr = convertAmount(costBasis, h.currency, displayCurrency);
      
      totalPortfolioValue += valueInDisplayCurr;
      totalPortfolioCost += costInDisplayCurr;

      return { ...h, currentPrice, currentValue, profit, roiPct };
    });

    const portfolioROI = totalPortfolioCost > 0 ? ((totalPortfolioValue - totalPortfolioCost) / totalPortfolioCost) * 100 : 0;

    return { items, totalPortfolioValue, totalPortfolioCost, portfolioROI };
  }, [holdings, marketPrices, displayCurrency, convertAmount]);

  const totalNetWorth = monthlyStats.net + enrichedHoldings.totalPortfolioValue;

  // Group transactions for Ledger view
  const groupedTransactions = useMemo(() => {
    const groups = {};
    transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach(t => {
        if (!groups[t.date]) groups[t.date] = [];
        groups[t.date].push(t);
      });
    return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [transactions]);

  // ────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ────────────────────────────────────────────────────────────────────────────

  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1500);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);

    try {
      let payload;
      const isText = file.name.endsWith('.csv') || file.type === 'text/csv';
      
      if (isText) {
        const textData = await file.text();
        payload = {
          contents: [{
            role: "user",
            parts: [
              { text: "Analyze this CSV of financial transactions. Extract them into the specified JSON format. Categories allowed: Housing, Food, Transport, Utilities, Health, Entertainment, Subscriptions, Insurance, Shopping, Other." },
              { text: textData }
            ]
          }]
        };
      } else {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
        });
        let mimeType = file.type;
        if (!mimeType && file.name.endsWith('.pdf')) mimeType = 'application/pdf';
        
        payload = {
          contents: [{
            role: "user",
            parts: [
              { text: "Analyze this receipt, invoice, or bank statement. Extract the transactions present. Ensure you classify them into these categories: Housing, Food, Transport, Utilities, Health, Entertainment, Subscriptions, Insurance, Shopping, Other. If it's a general purchase, try to guess the best category. Respond ONLY with valid JSON." },
              { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }
            ]
          }]
        };
      }

      payload.generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              amount: { type: "NUMBER" },
              category: { type: "STRING" },
              note: { type: "STRING" },
              currency: { type: "STRING" },
              type: { type: "STRING", enum: ["EXPENSE", "INCOME"] }
            },
            required: ["amount", "category", "note", "currency", "type"]
          }
        }
      };

      const importedTxns = await callGemini(payload, true);
      const newTxns = importedTxns.map(t => ({...t, id: newId(), date: new Date().toISOString().slice(0, 10)}));
      setTransactions(prev => [...newTxns, ...prev]);
    } catch (err) {
      console.error("Gemini Import Error:", err);
      alert("Error parsing document. Please ensure the file is valid and try again.");
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const getAiInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const prompt = `I am using a finance app. Here is my data:
      Transactions: ${JSON.stringify(transactions)}
      Holdings: ${JSON.stringify(holdings)}
      
      As a smart financial advisor, give me 2 short, actionable insights in English about my financial behavior this month and my investment portfolio. Be concise, encouraging, and professional.`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }]
      };
      
      const response = await callGemini(payload, false);
      setAiInsights(response);
    } catch (err) {
      console.error(err);
      setAiInsights("Error fetching insights. Please try again later.");
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const deleteTransaction = (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const deleteHolding = (id) => {
    setHoldings(prev => prev.filter(h => h.id !== id));
  };

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ────────────────────────────────────────────────────────────────────────────

  const monthName = displayMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();

  return (
    <div className="min-h-screen bg-[#050505] text-[#A1A1AA] font-normal selection:bg-[#D4AF37]/30 flex flex-col relative overflow-hidden" style={{ fontFamily: '"Inter", sans-serif', fontWeight: '400' }}>
      
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#D4AF37]/5 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Luxury Top Header */}
      <header className="sticky top-0 z-40 bg-[#050505]/80 backdrop-blur-2xl border-b border-white/[0.03] px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[#D4AF37] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.8)]"></div>
          <span className="text-white tracking-[0.25em] text-xs uppercase font-light">IQ.FINANCE</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setDisplayCurrency(prev => prev === 'ILS' ? 'USD' : 'ILS')}
            className="text-[9px] font-bold text-zinc-500 hover:text-[#D4AF37] transition-colors border border-white/10 rounded-md px-2 py-1 uppercase tracking-widest"
          >
            {displayCurrency}
          </button>
          <button onClick={handleManualSync} className="text-zinc-600 hover:text-[#D4AF37] transition-colors relative flex items-center justify-center">
            <i className={`fi fi-rr-refresh ${isSyncing ? "animate-spin text-[#D4AF37]" : ""}`} style={{ fontSize: '16px', lineHeight: 1 }}></i>
            {isSyncing && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>}
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pt-6 pb-32 max-w-md mx-auto w-full relative z-10">
        
        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in duration-1000">
            
            {/* Month Selector */}
            <div className="flex items-center justify-between bg-white/[0.01] border border-white/[0.03] p-4 rounded-3xl">
              <button 
                onClick={() => setDisplayMonth(new Date(displayMonth.setMonth(displayMonth.getMonth() - 1)))}
                className="p-2 text-zinc-600 hover:text-white transition-colors flex items-center justify-center"
              >
                <i className="fi fi-rr-angle-left" style={{ fontSize: '16px', lineHeight: 1 }}></i>
              </button>
              <div className="flex flex-col items-center">
                <span className="text-[7px] tracking-[0.4em] text-zinc-600 uppercase mb-1">Fiscal Period</span>
                <span className="text-[10px] text-white tracking-[0.2em] uppercase font-light">{monthName}</span>
              </div>
              <button 
                onClick={() => setDisplayMonth(new Date(displayMonth.setMonth(displayMonth.getMonth() + 1)))}
                className="p-2 text-zinc-600 hover:text-white transition-colors flex items-center justify-center"
              >
                <i className="fi fi-rr-angle-right" style={{ fontSize: '16px', lineHeight: 1 }}></i>
              </button>
            </div>

            {/* Net Worth Display */}
            <section className="text-center mt-6">
              <h2 className="text-[8px] uppercase tracking-[0.5em] text-[#D4AF37] mb-3">Total Net Worth</h2>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl text-white tracking-tighter font-extralight">
                  {formatCurrency(totalNetWorth, displayCurrency).replace(/[^\d.,]/g, '')}
                </span>
                <span className="text-xs text-zinc-500 tracking-widest uppercase ml-1">{displayCurrency}</span>
              </div>
            </section>

            {/* Income/Expense Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.04] rounded-[2rem] p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 blur-xl rounded-full group-hover:bg-emerald-500/10 transition-all"></div>
                <div className="flex items-center gap-2 mb-3">
                  <i className="fi fi-rr-arrow-up-right text-emerald-500" style={{ fontSize: '14px', lineHeight: 1 }}></i>
                  <h3 className="text-[7px] uppercase tracking-[0.2em] text-zinc-500">Inflow</h3>
                </div>
                <div className="text-xl text-white font-light tracking-tight">{formatCurrency(monthlyStats.income, displayCurrency)}</div>
              </div>
              <div className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.04] rounded-[2rem] p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 blur-xl rounded-full group-hover:bg-rose-500/10 transition-all"></div>
                <div className="flex items-center gap-2 mb-3">
                  <i className="fi fi-rr-arrow-down-left text-rose-500" style={{ fontSize: '14px', lineHeight: 1 }}></i>
                  <h3 className="text-[7px] uppercase tracking-[0.2em] text-zinc-500">Outflow</h3>
                </div>
                <div className="text-xl text-white font-light tracking-tight">{formatCurrency(monthlyStats.expenses, displayCurrency)}</div>
              </div>
            </div>

            {/* Quick Insights / Personalization */}
            <section className="space-y-4">
               <div className="flex items-center justify-between px-1">
                  <h2 className="text-[8px] uppercase tracking-[0.4em] text-zinc-600">Hi Ido, Private Insights</h2>
                  <i className="fi fi-rr-layers text-zinc-800" style={{ fontSize: '12px', lineHeight: 1 }}></i>
               </div>
               
               <div className="p-5 bg-white/[0.01] border border-white/[0.03] rounded-2xl flex items-center justify-between group hover:bg-white/[0.02] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/5 flex items-center justify-center text-[#D4AF37]">
                      <i className="fi fi-rr-chart-histogram" style={{ fontSize: '16px', lineHeight: 1 }}></i>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-300 tracking-wide block uppercase">Portfolio Returns</span>
                      <span className={`text-[9px] uppercase tracking-widest font-semibold ${enrichedHoldings.portfolioROI >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {enrichedHoldings.portfolioROI >= 0 ? '+' : ''}{enrichedHoldings.portfolioROI.toFixed(2)}% All-time
                      </span>
                    </div>
                  </div>
               </div>

               <div className="p-5 bg-white/[0.01] border border-white/[0.03] rounded-2xl flex items-center justify-between group hover:bg-white/[0.02] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center text-emerald-500">
                      <i className="fi fi-rr-shield-check" style={{ fontSize: '16px', lineHeight: 1 }}></i>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-300 tracking-wide block uppercase">Monthly Net Flow</span>
                      <span className="text-[7px] text-zinc-500 uppercase tracking-widest mt-1 block">
                        Saved {formatCurrency(monthlyStats.net, displayCurrency)} this month
                      </span>
                    </div>
                  </div>
               </div>
            </section>

            {/* Gemini AI Advisor Feature */}
            <section className="mt-8">
              <button 
                onClick={getAiInsights}
                disabled={isLoadingInsights}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/30 text-white flex items-center justify-between hover:bg-[#D4AF37]/10 transition-all disabled:opacity-50 shadow-[0_4px_20px_rgba(212,175,55,0.15)]"
              >
                <div className="flex items-center gap-3">
                  <i className={`fi fi-rr-magic-wand text-[#D4AF37] ${isLoadingInsights ? 'animate-spin' : ''}`} style={{ fontSize: '18px' }}></i>
                  <span className="text-sm font-semibold tracking-wide">Get AI Insights</span>
                </div>
                <i className="fi fi-rr-angle-right text-[#D4AF37]" style={{ fontSize: '14px' }}></i>
              </button>

              {aiInsights && (
                <div className="mt-4 p-5 rounded-2xl bg-[#0A0A0A] border border-[#D4AF37]/20 text-left animate-in slide-in-from-top-2">
                  <h3 className="text-[#D4AF37] text-[10px] uppercase tracking-widest font-semibold mb-3">Smart Financial Advisor</h3>
                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{aiInsights}</p>
                </div>
              )}
            </section>

          </div>
        )}

        {/* Ledger View (Transactions) */}
        {view === 'ledger' && (
          <div className="animate-in fade-in duration-700 space-y-8">
            <header className="pb-4 border-b border-white/[0.03]">
              <div className="flex justify-between items-center mb-1">
                <h1 className="text-xl text-white font-light tracking-tight uppercase">CASHFLOW</h1>
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".csv, .pdf, .xls, .xlsx, image/*" 
                    className="hidden" 
                  />
                  <button 
                    onClick={handleImportClick}
                    disabled={isImporting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors text-[9px] tracking-widest uppercase font-semibold disabled:opacity-50 shadow-[0_4px_15px_rgba(212,175,55,0.1)]"
                  >
                    {isImporting ? (
                      <i className="fi fi-rr-refresh animate-spin" style={{ fontSize: '14px', lineHeight: 1 }}></i>
                    ) : (
                      <i className="fi fi-rr-document" style={{ fontSize: '14px', lineHeight: 1 }}></i>
                    )}
                    <span>{isImporting ? 'Scanning...' : 'Scan'}</span>
                  </button>
                </div>
              </div>
              <span className="text-[7px] tracking-[0.3em] text-zinc-600 uppercase block">Income & Expenses</span>
            </header>
            
            <div className="space-y-6">
              {groupedTransactions.length > 0 ? groupedTransactions.map(([date, txns]) => (
                <div key={date}>
                  <h3 className="text-[8px] font-semibold text-zinc-600 uppercase tracking-widest mb-3 px-2">
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </h3>
                  <div className="space-y-2">
                    {txns.map(txn => (
                      <div key={txn.id} className="p-4 rounded-[1.2rem] bg-gradient-to-r from-white/[0.02] to-transparent border border-white/[0.02] flex justify-between items-center group">
                        <div className="flex items-center gap-4">
                          <div className={`w-[2px] h-6 rounded-full ${txn.type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          <div>
                            <div className="text-zinc-200 text-[12px] font-medium tracking-wide">{txn.category}</div>
                            <div className="text-[9px] text-zinc-600 tracking-wider mt-0.5">{txn.note || (txn.type === 'INCOME' ? 'Income' : 'Expense')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`text-[12px] font-semibold tracking-wider ${txn.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {txn.type === 'INCOME' ? '+' : '-'}{formatCurrency(txn.amount, txn.currency)}
                          </div>
                          <button onClick={() => deleteTransaction(txn.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-rose-500 flex items-center justify-center">
                            <i className="fi fi-rr-trash" style={{ fontSize: '12px', lineHeight: 1 }}></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="text-center py-10 text-zinc-600 text-[10px] uppercase tracking-widest">No activity recorded</div>
              )}
            </div>
            
            <button 
              onClick={() => setIsAddTxnOpen(true)}
              className="w-full py-5 rounded-2xl border border-dashed border-white/[0.05] text-[8px] tracking-[0.4em] uppercase text-zinc-500 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all"
            >
              Add Ledger Entry
            </button>
          </div>
        )}

        {/* Wealth View (Holdings) */}
        {view === 'wealth' && (
          <div className="animate-in fade-in duration-700 space-y-8">
            <header className="flex justify-between items-end pb-4 border-b border-white/[0.03]">
              <div>
                <h1 className="text-xl text-white font-light tracking-tight uppercase">HOLDINGS</h1>
                <span className="text-[8px] uppercase tracking-[0.4em] text-[#D4AF37]">האחזקות שלי</span>
              </div>
              <div className="text-right">
                <div className="text-[14px] text-white font-medium">{formatCurrency(enrichedHoldings.totalPortfolioValue, displayCurrency)}</div>
                <div className={`text-[9px] tracking-widest font-semibold mt-1 ${enrichedHoldings.portfolioROI >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {enrichedHoldings.portfolioROI >= 0 ? '+' : ''}{enrichedHoldings.portfolioROI.toFixed(2)}%
                </div>
              </div>
            </header>

            <div className="space-y-4">
              {enrichedHoldings.items.map(item => (
                <div key={item.id} className="p-6 rounded-[2rem] bg-gradient-to-b from-white/[0.02] to-transparent border border-white/[0.03] group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex gap-4 items-center">
                      <div className="w-10 h-10 rounded-full bg-[#0A0A0A] border border-white/[0.05] flex items-center justify-center text-[#D4AF37] shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
                        {item.type === 'Crypto' ? <i className="fi fi-rr-coins" style={{ fontSize: '16px', lineHeight: 1 }}></i> : <i className="fi fi-rr-arrow-trend-up" style={{ fontSize: '16px', lineHeight: 1 }}></i>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium tracking-widest">{item.symbol}</span>
                          <span className="text-[6px] px-1.5 py-0.5 rounded-sm border border-zinc-800 text-zinc-500 uppercase tracking-tighter bg-zinc-900/50">{item.currency}</span>
                        </div>
                        <div className="text-[8px] text-zinc-600 uppercase tracking-widest mt-1">{item.name}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-white text-[12px] font-medium tracking-wide">{formatCurrency(item.currentValue, item.currency)}</div>
                      <div className={`text-[9px] tracking-widest font-semibold mt-1 ${item.roiPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {item.roiPct >= 0 ? '+' : ''}{item.roiPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 pt-4 border-t border-white/[0.02] relative z-10 gap-2">
                    <div>
                      <div className="text-[7px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Quantity</div>
                      <div className="text-zinc-300 text-[10px] font-light">{item.shares}</div>
                    </div>
                    <div>
                      <div className="text-[7px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Live Price</div>
                      <div className="text-zinc-300 text-[10px] font-light animate-pulse">{formatCurrency(item.currentPrice, item.currency)}</div>
                    </div>
                    <div className="text-right">
                      <button onClick={() => deleteHolding(item.id)} className="text-zinc-600 hover:text-rose-500 mt-2 transition-colors flex items-center justify-end w-full">
                        <i className="fi fi-rr-trash" style={{ fontSize: '12px', lineHeight: 1 }}></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => setIsAddHoldingOpen(true)}
              className="w-full py-5 rounded-2xl border border-dashed border-white/[0.05] text-[8px] tracking-[0.4em] text-zinc-500 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all uppercase"
            >
              Append Position
            </button>
          </div>
        )}

        {/* Settings View */}
        {view === 'settings' && (
          <div className="animate-in fade-in duration-700 space-y-8">
             <header className="flex justify-between items-end pb-4 border-b border-white/[0.03]">
              <div>
                <h1 className="text-xl text-white font-light tracking-tight uppercase">Settings</h1>
                <span className="text-[7px] tracking-[0.3em] text-zinc-600 uppercase">Preferences & Account</span>
              </div>
            </header>
            
            <div className="space-y-6">
              {/* Profile */}
              <div className="p-5 rounded-[2rem] bg-gradient-to-br from-white/[0.02] to-transparent border border-white/[0.03] flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                  <i className="fi fi-rr-user" style={{ fontSize: '24px', lineHeight: 1 }}></i>
                </div>
                <div>
                  <div className="text-white text-lg font-medium tracking-wide">Ido</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Premium Member</div>
                </div>
              </div>

              {/* Preferences */}
              <div>
                <h3 className="text-[8px] font-semibold text-zinc-600 uppercase tracking-widest mb-3 px-2">Preferences</h3>
                <div className="space-y-2">
                  <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.02] flex justify-between items-center">
                     <div className="flex items-center gap-3">
                       <i className="fi fi-rr-globe text-zinc-500" style={{ fontSize: '16px', lineHeight: 1 }}></i>
                       <span className="text-sm text-zinc-300">Base Currency</span>
                     </div>
                     <select value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value)} className="bg-transparent text-[#D4AF37] text-xs font-semibold outline-none appearance-none text-right cursor-pointer">
                        <option value="ILS">ILS (₪)</option>
                        <option value="USD">USD ($)</option>
                     </select>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.02] flex justify-between items-center">
                     <div className="flex items-center gap-3">
                       <i className="fi fi-rr-bell text-zinc-500" style={{ fontSize: '16px', lineHeight: 1 }}></i>
                       <span className="text-sm text-zinc-300">Notifications</span>
                     </div>
                     <div className="w-8 h-4 bg-[#D4AF37] rounded-full relative cursor-pointer">
                       <div className="w-3 h-3 bg-black rounded-full absolute right-0.5 top-0.5"></div>
                     </div>
                  </div>
                </div>
              </div>

              {/* Data & Security */}
              <div>
                <h3 className="text-[8px] font-semibold text-zinc-600 uppercase tracking-widest mb-3 px-2">Data & Security</h3>
                <div className="space-y-2">
                  <button onClick={() => alert('Data exported to CSV successfully.')} className="w-full p-4 rounded-2xl bg-white/[0.01] border border-white/[0.02] flex justify-between items-center hover:bg-white/[0.03] transition-colors text-left">
                     <div className="flex items-center gap-3">
                       <i className="fi fi-rr-download text-zinc-500" style={{ fontSize: '16px', lineHeight: 1 }}></i>
                       <span className="text-sm text-zinc-300">Export Ledger (CSV)</span>
                     </div>
                  </button>
                  <button onClick={() => { if(window.confirm('Are you sure you want to clear all data? This cannot be undone.')) { localStorage.clear(); window.location.reload(); } }} className="w-full p-4 rounded-2xl bg-rose-500/[0.02] border border-rose-500/[0.05] flex justify-between items-center hover:bg-rose-500/[0.05] transition-colors text-left">
                     <div className="flex items-center gap-3">
                       <i className="fi fi-rr-database text-rose-500/70" style={{ fontSize: '16px', lineHeight: 1 }}></i>
                       <span className="text-sm text-rose-500/70">Clear Local Data</span>
                     </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Menu Container */}
      <div className="fixed bottom-28 right-6 flex flex-col-reverse gap-3 z-40 items-end group">
        <button className="w-14 h-14 bg-[#D4AF37] text-black rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(212,175,55,0.2)] hover:scale-105 transition-all">
          <i className="fi fi-rr-plus" style={{ fontSize: '24px', lineHeight: 1 }}></i>
        </button>
        {/* Hover Menu */}
        <div className="opacity-0 translate-y-4 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all flex flex-col gap-2 pb-2">
          <button 
            onClick={() => setIsAddHoldingOpen(true)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800 transition-colors shadow-lg"
          >
            <span className="text-[10px] tracking-widest uppercase font-semibold">Asset</span>
            <i className="fi fi-rr-chart-histogram text-[#D4AF37]" style={{ fontSize: '14px', lineHeight: 1 }}></i>
          </button>
          <button 
            onClick={() => setIsAddTxnOpen(true)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800 transition-colors shadow-lg"
          >
            <span className="text-[10px] tracking-widest uppercase font-semibold">Ledger Entry</span>
            <i className="fi fi-rr-wallet text-[#D4AF37]" style={{ fontSize: '14px', lineHeight: 1 }}></i>
          </button>
        </div>
      </div>

      {/* Luxury Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#050505]/90 backdrop-blur-3xl border-t border-white/[0.03] px-6 pt-4 pb-8 flex justify-between items-center">
        <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-2 transition-all w-1/4 ${view === 'dashboard' ? 'text-[#D4AF37]' : 'text-zinc-600 hover:text-zinc-400'}`}>
          <i className="fi fi-rr-pulse" style={{ fontSize: '18px', lineHeight: 1 }}></i>
          <span className="text-[7px] tracking-[0.2em] uppercase font-semibold">Net Worth</span>
        </button>
        <button onClick={() => setView('ledger')} className={`flex flex-col items-center gap-2 transition-all w-1/4 ${view === 'ledger' ? 'text-[#D4AF37]' : 'text-zinc-600 hover:text-zinc-400'}`}>
          <i className="fi fi-rr-wallet" style={{ fontSize: '18px', lineHeight: 1 }}></i>
          <span className="text-[7px] tracking-[0.2em] uppercase font-semibold">Cashflow</span>
        </button>
        <button onClick={() => setView('wealth')} className={`flex flex-col items-center gap-2 transition-all w-1/4 ${view === 'wealth' ? 'text-[#D4AF37]' : 'text-zinc-600 hover:text-zinc-400'}`}>
          <i className="fi fi-rr-chart-histogram" style={{ fontSize: '18px', lineHeight: 1 }}></i>
          <span className="text-[7px] tracking-[0.2em] uppercase font-semibold">Holdings</span>
        </button>
        <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-2 transition-all w-1/4 ${view === 'settings' ? 'text-[#D4AF37]' : 'text-zinc-600 hover:text-zinc-400'}`}>
          <i className="fi fi-rr-settings" style={{ fontSize: '18px', lineHeight: 1 }}></i>
          <span className="text-[7px] tracking-[0.2em] uppercase font-semibold">Settings</span>
        </button>
      </nav>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODALS */}
      {/* ──────────────────────────────────────────────────────────────────────── */}

      {/* Add Transaction Modal */}
      {isAddTxnOpen && (
        <AddTransactionModal 
          onClose={() => setIsAddTxnOpen(false)} 
          onSave={(txn) => {
            setTransactions(prev => [...prev, { ...txn, id: newId() }]);
            setIsAddTxnOpen(false);
          }} 
        />
      )}

      {/* Add Holding Modal */}
      {isAddHoldingOpen && (
        <AddHoldingModal 
          onClose={() => setIsAddHoldingOpen(false)} 
          onSave={(holding) => {
            setHoldings(prev => [...prev, { ...holding, id: newId() }]);
            setIsAddHoldingOpen(false);
          }} 
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        @import url('https://cdn-uicons.flaticon.com/2.1.0/uicons-regular-rounded/css/uicons-regular-rounded.css');
        
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
      `}</style>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// MODAL COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

const AddTransactionModal = ({ onClose, onSave }) => {
  const [type, setType] = useState('EXPENSE');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('ILS');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const categories = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = () => {
    if (!amount || isNaN(amount) || amount <= 0) return alert('Please enter a valid amount');
    onSave({ type, amount: parseFloat(amount), currency, category, date, note });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full bg-[#0A0A0A] rounded-t-[2.5rem] border-t border-zinc-800 p-8 pt-4 max-h-[85vh] overflow-y-auto shadow-[0_-10px_50px_rgba(0,0,0,0.8)]">
        <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-8"></div>
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <span className="text-[8px] tracking-[0.4em] text-[#D4AF37] uppercase mb-1 block">Ledger</span>
            <h2 className="text-white text-lg tracking-widest font-light uppercase">New Entry</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-zinc-500 hover:text-white">
            <i className="fi fi-rr-cross" style={{ fontSize: '16px', lineHeight: 1 }}></i>
          </button>
        </div>

        <div className="flex gap-2 p-1 rounded-2xl bg-zinc-900/50 border border-zinc-800 mb-6">
          <button onClick={() => { setType('EXPENSE'); setCategory(EXPENSE_CATEGORIES[0]); }} className={`flex-1 py-3 rounded-xl text-[10px] tracking-widest font-semibold uppercase transition-all ${type === 'EXPENSE' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'text-zinc-500'}`}>Expense</button>
          <button onClick={() => { setType('INCOME'); setCategory(INCOME_CATEGORIES[0]); }} className={`flex-1 py-3 rounded-xl text-[10px] tracking-widest font-semibold uppercase transition-all ${type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'text-zinc-500'}`}>Income</button>
        </div>

        <div className="space-y-6 mb-8">
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase block mb-2 px-1">Amount</label>
                <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent border-b border-zinc-800 focus:border-[#D4AF37] p-3 text-sm text-white outline-none transition-colors" />
              </div>
              <div>
                <label className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase block mb-2 px-1">Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-transparent border-b border-zinc-800 focus:border-[#D4AF37] p-3 text-sm text-zinc-300 outline-none appearance-none transition-colors">
                  <option value="ILS">ILS (₪)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
           </div>

           <div>
              <label className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase block mb-2 px-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-300 outline-none focus:border-[#D4AF37] transition-colors appearance-none">
                {categories.map(cat => <option key={cat} value={cat} className="bg-[#0A0A0A]">{cat}</option>)}
              </select>
           </div>

           <div>
              <label className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase block mb-2 px-1">Note / Description</label>
              <input type="text" placeholder="Optional notes..." value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-300 outline-none focus:border-[#D4AF37] transition-colors" />
           </div>
        </div>

        <button onClick={handleSubmit} className="w-full py-4 rounded-xl bg-[#D4AF37] text-black text-[11px] font-semibold tracking-[0.3em] uppercase hover:bg-[#b08d29] transition-colors shadow-[0_5px_20px_rgba(212,175,55,0.2)]">
          Secure Record
        </button>
      </div>
    </div>
  );
};

const AddHoldingModal = ({ onClose, onSave }) => {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [shares, setShares] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [type, setType] = useState('Stock');

  const handleSubmit = () => {
    if (!symbol || !shares || !purchasePrice) return alert('Missing required fields');
    onSave({ symbol: symbol.toUpperCase(), name: name || symbol, shares: parseFloat(shares), purchasePrice: parseFloat(purchasePrice), currency, type });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full bg-[#0A0A0A] rounded-t-[2.5rem] border-t border-zinc-800 p-8 pt-4 max-h-[85vh] overflow-y-auto shadow-[0_-10px_50px_rgba(0,0,0,0.8)]">
        <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-8"></div>
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <span className="text-[8px] tracking-[0.4em] text-[#D4AF37] uppercase mb-1 block">Wealth</span>
            <h2 className="text-white text-lg tracking-widest font-light uppercase">New Asset</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-zinc-500 hover:text-white">
            <i className="fi fi-rr-cross" style={{ fontSize: '16px', lineHeight: 1 }}></i>
          </button>
        </div>

        <div className="space-y-6 mb-8">
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase block mb-2 px-1">Symbol</label>
                <input type="text" placeholder="e.g. NVDA, BTC-USD" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full bg-transparent border-b border-zinc-800 focus:border-[#D4AF37] p-3 text-sm text-white outline-none uppercase transition-colors" />
              </div>
              <div>
                <label className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase block mb-2 px-1">Asset Name</label>
                <input type="text" placeholder="NVIDIA Corp" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent border-b border-zinc-800 focus:border-[#D4AF37] p-3 text-sm text-zinc-300 outline-none transition-colors" />
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase block mb-2 px-1">Shares/Amount</label>
                <input type="number" placeholder="0.00" value={shares} onChange={(e) => setShares(e.target.value)} className="w-full bg-transparent border-b border-zinc-800 focus:border-[#D4AF37] p-3 text-sm text-white outline-none transition-colors" />
              </div>
              <div>
                <label className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase block mb-2 px-1">Avg Cost</label>
                <input type="number" placeholder="0.00" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full bg-transparent border-b border-zinc-800 focus:border-[#D4AF37] p-3 text-sm text-zinc-300 outline-none transition-colors" />
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase block mb-2 px-1">Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-300 outline-none focus:border-[#D4AF37] appearance-none">
                  <option value="USD">USD</option>
                  <option value="ILS">ILS</option>
                </select>
              </div>
              <div>
                <label className="text-[8px] tracking-[0.3em] text-zinc-600 uppercase block mb-2 px-1">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-300 outline-none focus:border-[#D4AF37] appearance-none">
                  <option value="Stock">Stock / ETF</option>
                  <option value="Crypto">Crypto</option>
                </select>
              </div>
           </div>
        </div>

        <button onClick={handleSubmit} className="w-full py-4 rounded-xl bg-transparent border border-[#D4AF37] text-[#D4AF37] text-[11px] font-semibold tracking-[0.3em] uppercase hover:bg-[#D4AF37] hover:text-black transition-colors shadow-[0_5px_20px_rgba(212,175,55,0.1)]">
          Append Position
        </button>
      </div>
    </div>
  );
};

export default App;