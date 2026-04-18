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
