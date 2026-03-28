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

test('GET /v1/ping returns 200 with pong response', async () => {
  const response = await app.inject({ method: 'GET', url: '/v1/ping' })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ pong: 'ok' })
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

describe('GET /v1/items', () => {
  test('default page returns 20 items with hasMore true and non-null nextCursor', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/items' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data).toHaveLength(20)
    expect(body.pagination.hasMore).toBe(true)
    expect(typeof body.pagination.nextCursor).toBe('string')
    expect(body.pagination.nextCursor).not.toBeNull()
  })

  test('explicit limit=5 returns exactly 5 items', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/items?limit=5' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data).toHaveLength(5)
  })

  test('cursor pagination: page 2 starts after page 1 with no overlap', async () => {
    const page1 = await app.inject({ method: 'GET', url: '/v1/items?limit=10' })
    const page1Body = page1.json()
    const nextCursor = page1Body.pagination.nextCursor

    const page2 = await app.inject({ method: 'GET', url: `/v1/items?limit=10&cursor=${nextCursor}` })
    expect(page2.statusCode).toBe(200)
    const page2Body = page2.json()
    expect(page2Body.data).toHaveLength(10)

    const page1Ids: number[] = page1Body.data.map((item: { id: number }) => item.id)
    const page2Ids: number[] = page2Body.data.map((item: { id: number }) => item.id)
    for (const id of page2Ids) {
      expect(page1Ids.includes(id)).toBe(false)
    }
    expect(Math.min(...page2Ids)).toBeGreaterThan(Math.max(...page1Ids))
  })

  test('last page has hasMore false and nextCursor null', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/items?limit=50' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data).toHaveLength(50)
    expect(body.pagination.hasMore).toBe(false)
    expect(body.pagination.nextCursor).toBeNull()
  })

  test('invalid cursor returns 400', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/items?cursor=INVALID!!!' })
    expect(response.statusCode).toBe(400)
  })

  test('limit=1 returns exactly 1 item', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/items?limit=1' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data).toHaveLength(1)
    expect(body.pagination.hasMore).toBe(true)
  })

  test('limit=100 returns all 50 items with hasMore false', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/items?limit=100' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data).toHaveLength(50)
    expect(body.pagination.hasMore).toBe(false)
    expect(body.pagination.nextCursor).toBeNull()
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
