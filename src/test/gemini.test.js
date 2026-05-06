import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callGemini } from '../gemini'

const MOCK_KEY = 'test-api-key'

vi.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: vi.fn() }))
import { GoogleGenerativeAI } from '@google/generative-ai'

function stubModel(model) {
  // Must use `function` keyword so `new GoogleGenerativeAI()` works
  GoogleGenerativeAI.mockImplementation(function () {
    this.getGenerativeModel = () => model
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
    const model = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'Your portfolio looks great!' } }) }
    stubModel(model)

    const result = await callGemini({ contents: [{ parts: [{ text: 'analyze this' }] }] })
    expect(result).toBe('Your portfolio looks great!')
  })

  it('initializes the SDK with the correct API key', async () => {
    const model = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => '' } }) }
    stubModel(model)

    await callGemini({ contents: [] })
    expect(GoogleGenerativeAI).toHaveBeenCalledWith(MOCK_KEY)
  })

  it('parses JSON when isJson=true', async () => {
    const parsed = [{ amount: 50, category: 'Food', type: 'EXPENSE', currency: 'USD', note: 'lunch' }]
    const text = '```json\n' + JSON.stringify(parsed) + '\n```'
    const model = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => text } }) }
    stubModel(model)

    const result = await callGemini({ contents: [] }, true)
    expect(result).toEqual(parsed)
  })

  it('strips bare code fences when parsing JSON', async () => {
    const parsed = { key: 'value' }
    const text = '```\n' + JSON.stringify(parsed) + '\n```'
    const model = { generateContent: vi.fn().mockResolvedValue({ response: { text: () => text } }) }
    stubModel(model)

    const result = await callGemini({ contents: [] }, true)
    expect(result).toEqual(parsed)
  })

  it('retries on failure and succeeds on second attempt', async () => {
    let calls = 0
    const model = {
      generateContent: vi.fn().mockImplementation(() => {
        calls++
        if (calls === 1) return Promise.reject(new Error('network error'))
        return Promise.resolve({ response: { text: () => 'ok' } })
      }),
    }
    stubModel(model)

    const result = await callGemini({ contents: [] })
    expect(result).toBe('ok')
    expect(calls).toBe(2)
  })

  it('throws after 3 failed attempts', async () => {
    const model = { generateContent: vi.fn().mockRejectedValue(new Error('always fails')) }
    stubModel(model)

    await expect(callGemini({ contents: [] })).rejects.toThrow('always fails')
    expect(model.generateContent).toHaveBeenCalledTimes(3)
  })
})
