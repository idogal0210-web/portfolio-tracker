const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

/**
 * callGemini(payload, isJson?) → Promise<string | object>
 * Retries up to 3× with exponential backoff (1s, 2s).
 */
export async function callGemini(payload, isJson = false) {
  const key = import.meta.env.VITE_GEMINI_KEY
  if (!key) throw new Error('VITE_GEMINI_KEY not set')

  const url = `${GEMINI_ENDPOINT}?key=${key}`
  let lastError

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1000 * 2 ** (attempt - 1)))
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Gemini ${res.status}: ${text}`)
      }
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (isJson) {
        const clean = text
          .replace(/^```(?:json)?\n?/, '')
          .replace(/\n?```$/, '')
          .trim()
        return JSON.parse(clean)
      }
      return text
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
