import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'
import { createProblemDetail } from './errors.js'

describe('Error handler – RFC 9457 Problem Details', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  test('returns 404 with RFC 9457 shape for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/does-not-exist' })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body).toHaveProperty('type')
    expect(body).toHaveProperty('title')
    expect(body).toHaveProperty('status', 404)
  })

  test('returns 400 with RFC 9457 shape for schema validation errors', async () => {
    // POST /v1/items requires name (string) and price (number)
    // Sending an empty body triggers Fastify schema validation → 400
    const res = await app.inject({
      method: 'POST',
      url: '/v1/items',
      headers: { 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body).toHaveProperty('type')
    expect(body).toHaveProperty('title')
    expect(body).toHaveProperty('status', 400)
  })

  test('returns 400 (not 500) for malformed base64 cursor in pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/items?cursor=NOT_VALID_BASE64!!!',
    })
    expect(res.statusCode).toBe(400)
    // Must be JSON (not HTML) and must not leak stack trace
    const body = res.json()
    expect(typeof body).toBe('object')
    expect(body).not.toHaveProperty('stack')
  })

  test('returns 500 JSON without stack trace for unhandled errors', async () => {
    // Register a throw route before the first inject (which triggers ready())
    const throwApp = await buildApp()
    throwApp.get('/test-error-handler-throw', async () => {
      throw new Error('boom')
    })

    const originalEnv = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'production'

      const res = await throwApp.inject({
        method: 'GET',
        url: '/test-error-handler-throw',
      })

      // Must be 500
      expect(res.statusCode).toBe(500)
      // Must return application/problem+json, not HTML (Fastify's default fallback)
      const contentType = res.headers['content-type'] ?? ''
      expect(contentType).toContain('problem+json')
      // Must not leak internal stack trace in production
      const body = res.json()
      expect(body).not.toHaveProperty('stack')
    } finally {
      process.env.NODE_ENV = originalEnv
      await throwApp.close()
    }
  })
})

describe('createProblemDetail unit tests', () => {
  test('returns required RFC 9457 fields', () => {
    const result = createProblemDetail(400, 'Bad Request', 'Something went wrong')
    expect(result.type).toBe('about:blank')
    expect(result.title).toBe('Bad Request')
    expect(result.status).toBe(400)
    expect(result.detail).toBe('Something went wrong')
  })

  test('omits instance when not provided', () => {
    const result = createProblemDetail(404, 'Not Found', 'missing')
    expect('instance' in result).toBe(false)
  })

  test('includes instance when provided', () => {
    const result = createProblemDetail(400, 'Bad Request', 'detail', '/api/items/abc')
    expect(result.instance).toBe('/api/items/abc')
  })

  test.each([400, 404, 413, 429, 500])('status field matches input code %i', (code) => {
    const result = createProblemDetail(code, 'Error', 'detail')
    expect(result.status).toBe(code)
  })
})
