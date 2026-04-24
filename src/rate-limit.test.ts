import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'
import { WRITE_RATE_LIMIT } from './schemas.js'

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

    for (let i = 0; i <= WRITE_RATE_LIMIT.max; i++) {
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

    expect(response!.headers['content-type']).toContain('application/problem+json')
    const body = response!.json()
    expect(body).toHaveProperty('type')
    expect(body).toHaveProperty('title')
    expect(body).toHaveProperty('status', 429)
    expect(typeof body.detail).toBe('string')
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
})

describe('POST /api/items rate limiting', () => {
  let app: FastifyInstance

  beforeEach(async () => { app = await buildApp() })
  afterEach(async () => { await app.close() })

  test('returns 429 after exceeding 30 req/min limit', async () => {
    let response
    for (let i = 0; i <= WRITE_RATE_LIMIT.max; i++) {
      response = await app.inject({
        method: 'POST',
        url: '/api/items',
        payload: { name: 'test', price: 1 },
      })
    }
    expect(response!.statusCode).toBe(429)
    expect(response!.headers['x-ratelimit-limit']).toBeDefined()
    expect(response!.headers['retry-after']).toBeDefined()
    expect(response!.headers['content-type']).toContain('application/problem+json')
    const body = response!.json()
    expect(body).toHaveProperty('type')
    expect(body).toHaveProperty('title')
    expect(body).toHaveProperty('status', 429)
    expect(typeof body.detail).toBe('string')
  })
})

describe('Health probe rate-limit exemption', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp()
    // /health/ready checks server.listening — must bind before injecting
    await app.listen({ port: 0 })
  })
  afterEach(async () => { await app.close() })

  test.each(['/health', '/health/live', '/health/ready'])(
    '%s returns 200 after global rate limit is exhausted',
    async (url) => {
      for (let i = 0; i < 100; i++) {
        await app.inject({ method: 'GET', url: '/api/hello' })
      }
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode).toBe(200)
    }
  )
})
