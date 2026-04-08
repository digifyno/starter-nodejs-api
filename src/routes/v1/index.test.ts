import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
})

describe('GET /v1/status', () => {
  test('returns version, status, and timestamp', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/status' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.version).toBe('1')
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date')
  })
})

describe('POST /v1/items', () => {
  test('creates an item with valid body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/items',
      payload: { name: 'Widget', price: 9.99 }
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.status).toBe('created')
    expect(body.item.name).toBe('Widget')
    expect(body.item.price).toBe(9.99)
  })

  test('returns 400 when body is invalid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/items',
      payload: { name: 'Widget' } // missing required 'price'
    })
    expect(response.statusCode).toBe(400)
  })

  test('returns 429 after exceeding the 30 req/min rate limit', async () => {
    // Exhaust the per-route limit (30 allowed per minute)
    for (let i = 0; i < 29; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/items',
        payload: { name: 'test', price: 1 }
      })
    }
    // The next request (31st total including the first two tests) should be rate limited
    const response = await app.inject({
      method: 'POST',
      url: '/v1/items',
      payload: { name: 'test', price: 1 }
    })
    expect(response.statusCode).toBe(429)
  })
})

describe('GET /v1/items', () => {
  test('returns first page with default limit', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/items' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(20)
    expect(body.pagination).toBeDefined()
    expect(body.pagination.hasMore).toBe(true)
    expect(typeof body.pagination.nextCursor).toBe('string')
  })

  test('respects the limit query param', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/items?limit=5' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.length).toBe(5)
  })

  test('returns last page when cursor points near end', async () => {
    let cursor: string | null = null
    let pageCount = 0
    while (pageCount < 10) {
      const url: string = cursor ? `/v1/items?limit=20&cursor=${cursor}` : '/v1/items?limit=20'
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode).toBe(200)
      const body: { pagination: { nextCursor: string | null } } = res.json()
      cursor = body.pagination.nextCursor
      pageCount++
      if (!cursor) break
    }
    expect(cursor).toBeNull()
  })

  test('returns 400 for malformed cursor', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/items?cursor=INVALID!!!' })
    expect(response.statusCode).toBe(400)
  })
})
