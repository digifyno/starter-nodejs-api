import { describe, test, expect } from 'vitest'
import { envSchema } from './config.js'

describe('envSchema', () => {
  test('parses valid PORT string to number', () => {
    const result = envSchema.safeParse({ PORT: '3000' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.PORT).toBe(3000)
    }
  })

  test('uses default PORT 3000 when not set', () => {
    const result = envSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.PORT).toBe(3000)
    }
  })

  test('fails when PORT is not a valid number', () => {
    const result = envSchema.safeParse({ PORT: 'abc' })
    expect(result.success).toBe(false)
  })

  test('fails when PORT is out of valid range', () => {
    const result = envSchema.safeParse({ PORT: '99999' })
    expect(result.success).toBe(false)
  })

  test('fails when PORT is zero', () => {
    const result = envSchema.safeParse({ PORT: '0' })
    expect(result.success).toBe(false)
  })

  test('uses default HOST 0.0.0.0 when not set', () => {
    const result = envSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.HOST).toBe('0.0.0.0')
    }
  })

  test('uses default NODE_ENV development when not set', () => {
    const result = envSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development')
    }
  })

  test('accepts all valid NODE_ENV values', () => {
    for (const env of ['development', 'production', 'test']) {
      const result = envSchema.safeParse({ NODE_ENV: env })
      expect(result.success).toBe(true)
    }
  })

  test('fails for invalid NODE_ENV value', () => {
    const result = envSchema.safeParse({ NODE_ENV: 'staging' })
    expect(result.success).toBe(false)
  })
})

describe('envSchema — CURSOR_SECRET', () => {
  test('rejects secrets shorter than 32 characters', () => {
    const result = envSchema.safeParse({ CURSOR_SECRET: 'tooshort' })
    expect(result.success).toBe(false)
  })

  test('accepts a secret of exactly 32 characters', () => {
    const secret = 'a'.repeat(32)
    const result = envSchema.safeParse({ CURSOR_SECRET: secret })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.CURSOR_SECRET).toBe(secret)
    }
  })

  test('accepts a secret longer than 32 characters', () => {
    const result = envSchema.safeParse({ CURSOR_SECRET: 'a'.repeat(64) })
    expect(result.success).toBe(true)
  })

  test('uses dev default when CURSOR_SECRET is not supplied in non-production', () => {
    // The production guard (process.env.NODE_ENV === 'production' → throw) runs inside the
    // Zod default() callback and cannot be reliably tested via safeParse without mocking
    // process.env.NODE_ENV at module load time — that case is intentionally omitted here.
    const result = envSchema.safeParse({ NODE_ENV: 'development' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.CURSOR_SECRET.startsWith('dev-cursor-secret')).toBe(true)
    }
  })
})
