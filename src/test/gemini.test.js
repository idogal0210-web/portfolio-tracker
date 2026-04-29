import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callGemini } from '../gemini'

const MOCK_KEY = 'test-api-key'

function mockFetch(responseBody, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
  })
}

describe('callGemini', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GEMINI_KEY', MOCK_KEY)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('throws when VITE_GEMINI_KEY is not set', async () => {
    vi.unstubAllEnvs()
    await expect(callGemini({ contents: [] })).rejects.toThrow('VITE_GEMINI_KEY not set')
  })

  it('returns text from a successful response', async () => {
    const apiResponse = {
      candidates: [{
        content: { parts: [{ text: 'Your portfolio looks great!' }] },
      }],
    }
    global.fetch = mockFetch(apiResponse)

    const result = await callGemini({ contents: [{ parts: [{ text: 'analyze this' }] }] })
    expect(result).toBe('Your portfolio looks great!')
  })

  it('parses JSON when isJson=true', async () => {
    const parsed = [{ amount: 50, category: 'Food', type: 'EXPENSE', currency: 'USD', note: 'lunch' }]
    const apiResponse = {
      candidates: [{
        content: { parts: [{ text: '```json\n' + JSON.stringify(parsed) + '\n```' }] },
      }],
    }
    global.fetch = mockFetch(apiResponse)

    const result = await callGemini({ contents: [] }, true)
    expect(result).toEqual(parsed)
  })

  it('strips bare code fences when parsing JSON', async () => {
    const parsed = { key: 'value' }
    const apiResponse = {
      candidates: [{
        content: { parts: [{ text: '```\n' + JSON.stringify(parsed) + '\n```' }] },
      }],
    }
    global.fetch = mockFetch(apiResponse)

    const result = await callGemini({ contents: [] }, true)
    expect(result).toEqual(parsed)
  })

  it('retries on failure and succeeds on second attempt', async () => {
    const successResponse = {
      candidates: [{ content: { parts: [{ text: 'ok' }] } }],
    }
    let calls = 0
    global.fetch = vi.fn().mockImplementation(() => {
      calls++
      if (calls === 1) return Promise.reject(new Error('network error'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => successResponse,
        text: async () => '',
      })
    })

    const result = await callGemini({ contents: [] })
    expect(result).toBe('ok')
    expect(calls).toBe(2)
  })

  it('throws after 3 failed attempts', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('always fails'))

    await expect(callGemini({ contents: [] })).rejects.toThrow('always fails')
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('throws on non-ok HTTP response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
      json: async () => ({}),
    })

    await expect(callGemini({ contents: [] })).rejects.toThrow('Gemini 429')
  })

  it('includes the API key in the request URL', async () => {
    const apiResponse = {
      candidates: [{ content: { parts: [{ text: '' }] } }],
    }
    global.fetch = mockFetch(apiResponse)

    await callGemini({ contents: [] })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`key=${MOCK_KEY}`),
      expect.any(Object),
    )
  })
})
