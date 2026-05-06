import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_NAME = 'gemini-2.5-flash'

/**
 * callGemini(payload, isJson?) → Promise<string | object>
 * Retries up to 3× with exponential backoff on transient failures.
 */
export async function callGemini(payload, isJson = false) {
  const key = import.meta.env.VITE_GEMINI_KEY
  if (!key) throw new Error('VITE_GEMINI_KEY not set')

  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: MODEL_NAME })

  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1000 * 2 ** (attempt - 1)))
    }
    try {
      const result = await model.generateContent({ contents: payload.contents })
      const text = result.response.text()
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
