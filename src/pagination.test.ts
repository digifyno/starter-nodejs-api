import { describe, test, expect } from 'vitest'
import { encodeCursor, decodeCursor, paginatedResponse, paginationQuerySchema } from './pagination.js'

describe('encodeCursor / decodeCursor', () => {
  test('round-trips a simple object', () => {
    const value = { id: 42, createdAt: '2024-01-01T00:00:00Z' }
    expect(decodeCursor(encodeCursor(value))).toEqual(value)
  })

  test('round-trips an object with various value types', () => {
    const value = { id: 'abc', score: 3.14, nested: { x: 1 } }
    expect(decodeCursor(encodeCursor(value))).toEqual(value)
  })

  test('produces a base64url string (no +, /, = characters)', () => {
    const encoded = encodeCursor({ id: 1 })
    expect(encoded).not.toMatch(/[+/=]/)
  })

  test('throws a 400 error on invalid base64url input', () => {
    const err = (() => { try { decodeCursor('!!!invalid!!!') } catch (e) { return e } })() as Error & { statusCode: number }
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
  })

  test('throws a 400 error on valid base64 but invalid JSON', () => {
    const badCursor = Buffer.from('not-json').toString('base64url')
    const err = (() => { try { decodeCursor(badCursor) } catch (e) { return e } })() as Error & { statusCode: number }
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
  })
})

describe('paginatedResponse', () => {
  test('wraps items in data envelope with pagination info', () => {
    const items = [{ id: 1 }, { id: 2 }]
    const cursor = encodeCursor({ id: 2 })
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
    const cursor = encodeCursor({ id: 99 })
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
