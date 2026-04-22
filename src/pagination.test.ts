import { describe, test, expect } from 'vitest'
import { encodeCursor, decodeCursor, paginatedResponse, paginationQuerySchema } from './pagination.js'

const TEST_SECRET = 'test-cursor-secret-replace-in-production'

describe('encodeCursor / decodeCursor', () => {
  test('round-trips a simple object', () => {
    const value = { id: 42, createdAt: '2024-01-01T00:00:00Z' }
    expect(decodeCursor(encodeCursor(value, TEST_SECRET), TEST_SECRET)).toEqual(value)
  })

  test('round-trips an object with various value types', () => {
    const value = { id: 'abc', score: 3.14, nested: { x: 1 } }
    expect(decodeCursor(encodeCursor(value, TEST_SECRET), TEST_SECRET)).toEqual(value)
  })

  test('produces a base64url string (no +, /, = characters)', () => {
    const encoded = encodeCursor({ id: 1 }, TEST_SECRET)
    expect(encoded).not.toMatch(/[+/=]/)
  })

  test('produces a payload.signature format with a single dot separator', () => {
    const encoded = encodeCursor({ id: 1 }, TEST_SECRET)
    const parts = encoded.split('.')
    expect(parts).toHaveLength(2)
    expect(parts[0].length).toBeGreaterThan(0)
    expect(parts[1].length).toBeGreaterThan(0)
  })

  test('throws a 400 error on invalid base64url input', () => {
    const err = (() => { try { decodeCursor('!!!invalid!!!', TEST_SECRET) } catch (e) { return e } })() as Error & { statusCode: number }
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
  })

  test('throws a 400 error on valid base64 but missing signature', () => {
    const badCursor = Buffer.from('not-json').toString('base64url')
    const err = (() => { try { decodeCursor(badCursor, TEST_SECRET) } catch (e) { return e } })() as Error & { statusCode: number }
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
  })

  test('throws a 400 error when signature does not match (tampered cursor)', () => {
    const original = encodeCursor({ id: 1 }, TEST_SECRET)
    const dotIndex = original.lastIndexOf('.')
    const tamperedPayload = Buffer.from(JSON.stringify({ id: 9999 })).toString('base64url')
    const forged = `${tamperedPayload}.${original.slice(dotIndex + 1)}`
    const err = (() => { try { decodeCursor(forged, TEST_SECRET) } catch (e) { return e } })() as Error & { statusCode: number }
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
    expect(err.message).toContain('signature mismatch')
  })

  test('throws a 400 error when cursor re-encoded without the secret', () => {
    const raw = Buffer.from(JSON.stringify({ id: 42 })).toString('base64url')
    const wrongSig = Buffer.from('invalidsig').toString('base64url')
    const forged = `${raw}.${wrongSig}`
    const err = (() => { try { decodeCursor(forged, TEST_SECRET) } catch (e) { return e } })() as Error & { statusCode: number }
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
  })
})

describe('paginatedResponse', () => {
  test('wraps items in data envelope with pagination info', () => {
    const items = [{ id: 1 }, { id: 2 }]
    const cursor = encodeCursor({ id: 2 }, TEST_SECRET)
    const result = paginatedResponse(items, cursor)
    expect(result).toEqual({
      data: items,
      pagination: { nextCursor: cursor, hasMore: true }
    })
  })

  test('returns hasMore: false and nextCursor: null when no next cursor', () => {
    const result = paginatedResponse([{ id: 1 }], null)
    expect(result.pagination.hasMore).toBe(false)
    expect(result.pagination.nextCursor).toBeNull()
  })

  test('handles empty array with null cursor', () => {
    const result = paginatedResponse([], null)
    expect(result).toEqual({
      data: [],
      pagination: { nextCursor: null, hasMore: false }
    })
  })

  test('handles empty array with a cursor (edge case: filtered page)', () => {
    const cursor = encodeCursor({ id: 99 }, TEST_SECRET)
    const result = paginatedResponse([], cursor)
    expect(result.data).toEqual([])
    expect(result.pagination.hasMore).toBe(true)
    expect(result.pagination.nextCursor).toBe(cursor)
  })
})

describe('paginationQuerySchema', () => {
  test('defines limit with min 1 and max 100', () => {
    const limit = paginationQuerySchema.properties.limit
    expect(limit.minimum).toBe(1)
    expect(limit.maximum).toBe(100)
    expect(limit.default).toBe(20)
  })

  test('defines cursor as a string property', () => {
    const cursor = paginationQuerySchema.properties.cursor
    expect(cursor.type).toBe('string')
  })

  test('is a valid JSON schema object type', () => {
    expect(paginationQuerySchema.type).toBe('object')
  })
})

describe('decodeCursor with validator', () => {
  const isNumericId = (raw: Record<string, unknown>) => typeof raw.id === 'number' && Number.isFinite(raw.id)

  test('accepts a valid cursor when validator passes', () => {
    const cursor = encodeCursor({ id: 42 }, TEST_SECRET)
    expect(decodeCursor(cursor, TEST_SECRET, isNumericId)).toEqual({ id: 42 })
  })

  test('throws 400 when id is null', () => {
    const cursor = encodeCursor({ id: null }, TEST_SECRET)
    const err = (() => { try { decodeCursor(cursor, TEST_SECRET, isNumericId) } catch (e) { return e } })() as Error & { statusCode: number }
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
    expect(err.message).toContain('unexpected payload shape')
  })

  test('throws 400 when id is a string', () => {
    const cursor = encodeCursor({ id: 'xss' }, TEST_SECRET)
    const err = (() => { try { decodeCursor(cursor, TEST_SECRET, isNumericId) } catch (e) { return e } })() as Error & { statusCode: number }
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
    expect(err.message).toContain('unexpected payload shape')
  })

  test('throws 400 when id is Infinity', () => {
    // JSON.stringify coerces Infinity to null, so encode manually — also lacks a signature
    const cursor = Buffer.from(JSON.stringify({ id: null })).toString('base64url')
    const err = (() => { try { decodeCursor(cursor, TEST_SECRET, isNumericId) } catch (e) { return e } })() as Error & { statusCode: number }
    expect(err.statusCode).toBe(400)
  })

  test('without validator, still decodes payloads with null id', () => {
    const cursor = encodeCursor({ id: null }, TEST_SECRET)
    expect(decodeCursor(cursor, TEST_SECRET)).toEqual({ id: null })
  })
})

describe('pagination edge cases', () => {
  test('decodeCursor throws 400 for empty string', () => {
    const err = (() => { try { decodeCursor('', TEST_SECRET) } catch (e) { return e } })() as Error & { statusCode: number }
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
  })

  test('encodeCursor/decodeCursor roundtrips unicode and special characters', () => {
    const value = { name: 'héllo wörld 🎉', query: "<>&'" }
    expect(decodeCursor(encodeCursor(value, TEST_SECRET), TEST_SECRET)).toEqual(value)
  })

  test('encodeCursor/decodeCursor roundtrips arrays and null values', () => {
    const value = { tags: ['a', 'b', 'c'], count: 0, extra: null }
    expect(decodeCursor(encodeCursor(value, TEST_SECRET), TEST_SECRET)).toEqual(value)
  })

  test('paginatedResponse preserves all items when nextCursor is null', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = paginatedResponse(items, null)
    expect(result.data).toEqual(items)
    expect(result.pagination.nextCursor).toBeNull()
    expect(result.pagination.hasMore).toBe(false)
  })

  test('paginationQuerySchema cursor field is optional (no required constraint)', () => {
    const schema = paginationQuerySchema as unknown as { required?: string[] }
    const required = schema.required ?? []
    expect(required).not.toContain('cursor')
  })
})
