import { expect, describe, it, beforeEach } from 'vitest'

// Mock environment variables
beforeEach(() => {
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.VITE_RAPIDAPI_KEY = 'test-rapidapi-key'
})

describe('Environment Setup', () => {
  it('should load environment variables', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBeDefined()
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBeDefined()
    expect(import.meta.env.VITE_RAPIDAPI_KEY).toBeDefined()
  })
})
