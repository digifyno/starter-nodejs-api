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
