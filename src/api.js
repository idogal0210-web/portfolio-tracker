const API_HOST = 'apidojo-yahoo-finance-v1.p.rapidapi.com'
const API_URL = `https://${API_HOST}/market/v2/get-quotes`

export async function fetchPrices(symbols, apiKey) {
  const allSymbols = [...symbols, 'USDILS=X'].join(',')
  const response = await fetch(`${API_URL}?symbols=${allSymbols}&region=US`, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': API_HOST,
    },
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const data = await response.json()
  const quotes = data?.quoteResponse?.result ?? []

  const priceMap = {}
  let exchangeRate = 3.7

  for (const quote of quotes) {
    if (quote.symbol === 'USDILS=X') {
      exchangeRate = quote.regularMarketPrice
    } else {
      priceMap[quote.symbol] = {
        regularMarketPrice: quote.regularMarketPrice,
        regularMarketChangePercent: quote.regularMarketChangePercent,
        longName: quote.longName || quote.shortName || quote.symbol,
      }
    }
  }

  return { priceMap, exchangeRate }
}

const HISTORY_URL = `https://${API_HOST}/stock/v3/get-chart`

const RANGE_MAP = {
  '1D': { range: '1d',  interval: '5m'  },
  '1W': { range: '5d',  interval: '60m' },
  '1M': { range: '1mo', interval: '1d'  },
  '3M': { range: '3mo', interval: '1d'  },
  '1Y': { range: '1y',  interval: '1wk' },
  'ALL': { range: 'max', interval: '1mo' },
}

export async function fetchHistory(symbol, rangeKey = '1M', apiKey) {
  const { range, interval } = RANGE_MAP[rangeKey] ?? RANGE_MAP['1M']
  const url = `${HISTORY_URL}?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}&region=US`
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': API_HOST,
    },
  })
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  const data = await response.json()
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
  return closes.filter(v => v != null && isFinite(v))
}
