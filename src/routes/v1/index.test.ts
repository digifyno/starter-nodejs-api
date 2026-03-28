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
