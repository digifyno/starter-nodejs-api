import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'

describe('Rate limiting', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  test('POST /v1/items returns 429 with correct headers and body after exceeding 30 req/min limit', async () => {
    let response

    for (let i = 0; i < 31; i++) {
      response = await app.inject({
        method: 'POST',
        url: '/v1/items',
        payload: { name: 'test', price: 1 },
      })
    }

    expect(response!.statusCode).toBe(429)
    expect(response!.headers['x-ratelimit-limit']).toBeDefined()
    expect(response!.headers['x-ratelimit-remaining']).toBe('0')
    expect(response!.headers['retry-after']).toBeDefined()

    const body = response!.json()
    expect(body).toBeTruthy()
    // @fastify/rate-limit with RFC 9457 Problem Details returns { type, title, status, detail, instance }
    expect(body.title || body.detail || body.error || body.message).toBeTruthy()
  })

  test('GET /v1/status returns 429 after exceeding global 100 req/min limit', async () => {
    let response

    for (let i = 0; i < 101; i++) {
      response = await app.inject({
        method: 'GET',
        url: '/v1/status',
      })
    }

    expect(response!.statusCode).toBe(429)
  })

  test('POST /api/items returns 429 after exceeding 30 req/min limit', async () => {
    let response

    for (let i = 0; i < 31; i++) {
      response = await app.inject({
        method: 'POST',
        url: '/api/items',
        payload: { name: 'test', price: 1 },
      })
    }

    expect(response!.statusCode).toBe(429)
    expect(response!.headers['x-ratelimit-limit']).toBeDefined()
    expect(response!.headers['retry-after']).toBeDefined()
  })
})

describe('Health endpoints are exempt from rate limiting', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  test('/health/live still responds after exhausting global rate limit', async () => {
    // Exhaust global rate limit on a non-exempt endpoint
    for (let i = 0; i < 100; i++) {
      await app.inject({ method: 'GET', url: '/api/hello' })
    }
    // Verify global limit is actually hit
    const limitedRes = await app.inject({ method: 'GET', url: '/api/hello' })
    expect(limitedRes.statusCode).toBe(429)

    // Health endpoint should still return 200 (exempt via rateLimit: false)
    const healthRes = await app.inject({ method: 'GET', url: '/health/live' })
    expect(healthRes.statusCode).toBe(200)
  })

  test('/health/ready still responds after exhausting global rate limit', async () => {
    for (let i = 0; i < 100; i++) {
      await app.inject({ method: 'GET', url: '/api/hello' })
    }
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect([200, 503]).toContain(res.statusCode) // 503 is valid (not listening)
  })

  test('/health still responds after exhausting global rate limit', async () => {
    for (let i = 0; i < 100; i++) {
      await app.inject({ method: 'GET', url: '/api/hello' })
    }
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
  })
})
