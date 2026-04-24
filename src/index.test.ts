import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'
import { WRITE_RATE_LIMIT } from './schemas.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
})

test('GET /health returns 200 with healthy status', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' })
  expect(response.statusCode).toBe(200)
  const body = response.json()
  expect(body.status).toBe('healthy')
  expect(body.message).toBe('API is running')
  expect(typeof body.timestamp).toBe('string')
  expect(response.headers['cache-control']).toBe('no-store')
})

test('GET /health/live returns 200 with ok status', async () => {
  const response = await app.inject({ method: 'GET', url: '/health/live' })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ status: 'ok' })
})

test('GET /health/ready returns 503 before server.listen() is called', async () => {
  // server.listening is false when using inject() without calling listen() first
  // This is the 503 path: the server has not finished binding to a port
  const response = await app.inject({ method: 'GET', url: '/health/ready' })
  expect(response.statusCode).toBe(503)
  expect(response.json()).toEqual({ status: 'not_ready' })
})

test('GET /health/ready returns 200 once server is listening', async () => {
  // Use a separate app instance to avoid interfering with the shared test app.
  // Bind to a random port so server.listening becomes true, then verify ready.
  const listeningApp = await buildApp()
  await listeningApp.listen({ port: 0 })
  const response = await listeningApp.inject({ method: 'GET', url: '/health/ready' })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ status: 'ready' })
  await listeningApp.close()
})

test('GET /api/hello returns greeting message', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/hello' })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ message: 'Hello from Fastify!' })
})

test('POST /api/items creates an item', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/items',
    payload: { name: 'Widget', price: 9.99 }
  })
  expect(response.statusCode).toBe(200)
  const body = response.json()
  expect(body.status).toBe('created')
  expect(body.item.name).toBe('Widget')
  expect(body.item.price).toBe(9.99)
})

test('GET /api/items/:id returns item by id', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/items/42' })
  expect(response.statusCode).toBe(200)
  const body = response.json()
  expect(body.itemId).toBe(42)
  expect(body.name).toBe('Item 42')
  expect(body.price).toBe(99.99)
})

test('GET /api/items/:id with non-numeric id returns 404 Problem Detail', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/items/abc' })
  expect(response.statusCode).toBe(404)
  expect(response.headers['content-type']).toContain('application/problem+json')
  const body = response.json()
  expect(body.status).toBe(404)
  expect(body.instance).toBe('/api/items/abc')
})

test('GET /api/items/:id with negative id returns 404 Problem Detail', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/items/-1' })
  expect(response.statusCode).toBe(404)
  const body = response.json()
  expect(body.status).toBe(404)
})

test('X-Request-ID: valid UUID v4 is echoed back', async () => {
  const validUUID = '550e8400-e29b-4d00-a456-426614174000'
  const response = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { 'x-request-id': validUUID }
  })
  expect(response.statusCode).toBe(200)
  expect(response.headers['x-request-id']).toBe(validUUID)
})

test('X-Request-ID: non-UUID value is rejected; a fresh UUID is generated', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { 'x-request-id': 'test-123' }
  })
  expect(response.statusCode).toBe(200)
  const reqId = response.headers['x-request-id']
  expect(reqId).not.toBe('test-123')
  expect(reqId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
})

test('X-Request-ID is generated when not provided', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' })
  expect(response.statusCode).toBe(200)
  const reqId = response.headers['x-request-id']
  expect(typeof reqId).toBe('string')
  expect(reqId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

// v1/status covered in src/routes/v1/index.test.ts

test('POST /api/items with invalid body returns 400 Problem Detail', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/items',
    payload: { name: 'Widget' } // missing required 'price'
  })
  expect(response.statusCode).toBe(400)
  expect(response.headers['content-type']).toContain('application/problem+json')
  const body = response.json()
  expect(body.type).toBe('about:blank')
  expect(body.title).toBe('Bad Request')
  expect(body.status).toBe(400)
  expect(typeof body.detail).toBe('string')
  expect(body.detail.length).toBeGreaterThan(0)
})

test('GET /api/items/:id with id=0 returns 404 Problem Detail', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/items/0' })
  expect(response.statusCode).toBe(404)
  expect(response.headers['content-type']).toContain('application/problem+json')
  const body = response.json()
  expect(body.type).toBe('about:blank')
  expect(body.title).toBe('Not Found')
  expect(body.status).toBe(404)
  expect(typeof body.detail).toBe('string')
  expect(body.instance).toBe('/api/items/0')
})

test.each(['/health', '/health/live', '/health/ready'])(
  'GET %s returns Cache-Control: no-store',
  async (url) => {
    const res = await app.inject({ method: 'GET', url })
    expect(res.headers['cache-control']).toBe('no-store')
  }
)

test.each(['/', '/health', '/health/live', '/health/ready', '/v1/status'])(
  'GET %s is not compressed',
  async (url) => {
    const res = await app.inject({ method: 'GET', url })
    expect(res.headers['content-encoding']).toBeUndefined()
  }
)

test('GET /v1/items with Accept-Encoding: gzip returns gzip-encoded response', async () => {
  // limit=50 ensures payload exceeds the 1024-byte compression threshold
  const res = await app.inject({
    method: 'GET',
    url: '/v1/items?limit=50',
    headers: { 'accept-encoding': 'gzip' }
  })
  expect(res.statusCode).toBe(200)
  expect(res.headers['content-encoding']).toBe('gzip')
})

// GET / serves dist/index.html when the file exists (HTML path is exercised here).
// The JSON fallback ({ message, health, docs }) executes only when dist/index.html is
// absent; that branch depends on config.NODE_ENV (not the buildApp nodeEnv option)
// for the `docs` field, so it is not separately testable without filesystem mocking.
test('GET / serves landing page with 200', async () => {
  const response = await app.inject({ method: 'GET', url: '/' })
  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toMatch(/html/)
})

// /docs/json is registered only when NODE_ENV !== 'production' (swaggerUi plugin conditional in app.ts)
test('GET /docs/json returns valid OpenAPI spec', async () => {
  const response = await app.inject({ method: 'GET', url: '/docs/json' })
  expect(response.statusCode).toBe(200)
  const spec = response.json()
  expect(spec.openapi).toBe('3.0.0')
  expect(spec.info).toBeDefined()
  expect(spec.paths).toBeDefined()
  expect(spec.paths['/v1/status']).toBeDefined()
})

test('POST /api/items with extra fields returns 400 (mass assignment prevention)', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/items',
    payload: { name: 'Widget', price: 9.99, role: 'admin' }
  })
  expect(response.statusCode).toBe(400)
})

test('POST with oversized body returns 413', async () => {
  const largePayload = { name: 'x'.repeat(2 * 1024 * 1024), price: 1 }
  const response = await app.inject({
    method: 'POST',
    url: '/api/items',
    payload: largePayload
  })
  expect(response.statusCode).toBe(413)
})

describe('POST /api/items input boundaries', () => {
  test('price: 0 is accepted (minimum boundary)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/items',
      payload: { name: 'Widget', price: 0 }
    })
    expect(res.statusCode).toBe(200)
  })

  test('price: -0.01 is rejected with 400 (below minimum)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/items',
      payload: { name: 'Widget', price: -0.01 }
    })
    expect(res.statusCode).toBe(400)
  })

  test('name at maxLength (255 chars) is accepted', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/items',
      payload: { name: 'a'.repeat(255), price: 1 }
    })
    expect(res.statusCode).toBe(200)
  })

  test('name exceeding maxLength (256 chars) is rejected with 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/items',
      payload: { name: 'a'.repeat(256), price: 1 }
    })
    expect(res.statusCode).toBe(400)
  })

  test('optional description field is accepted and echoed back', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/items',
      payload: { name: 'Widget', price: 9.99, description: 'A test widget' }
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().item.description).toBe('A test widget')
  })
})

describe('CORS', () => {
  test('production mode: CORS headers absent on cross-origin request', async () => {
    const prodApp = await buildApp({ nodeEnv: 'production' })
    const res = await prodApp.inject({
      method: 'GET',
      url: '/health/live',
      headers: { Origin: 'https://evil.example.com' }
    })
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
    await prodApp.close()
  })

  test('non-production: CORS preflight returns 204 or 200', async () => {
    const devApp = await buildApp({ nodeEnv: 'development' })
    const res = await devApp.inject({
      method: 'OPTIONS',
      url: '/health/live',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      }
    })
    expect([200, 204]).toContain(res.statusCode)
    await devApp.close()
  })

  test('non-production: Access-Control-Allow-Credentials header is not present', async () => {
    const devApp = await buildApp({ nodeEnv: 'development' })
    const res = await devApp.inject({
      method: 'GET',
      url: '/health/live',
      headers: { Origin: 'http://attacker.example.com' }
    })
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
    await devApp.close()
  })
})

describe('X-Request-ID on all response types', () => {
  const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  test('404 response includes X-Request-ID matching UUID v4', async () => {
    const response = await app.inject({ method: 'GET', url: '/no-such-route' })
    expect(response.statusCode).toBe(404)
    expect(response.headers['x-request-id']).toBeDefined()
    expect(response.headers['x-request-id']).toMatch(UUID_V4_RE)
  })

  test('400 response includes X-Request-ID', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/items',
      payload: { name: 'Widget' } // missing required 'price'
    })
    expect(response.statusCode).toBe(400)
    expect(response.headers['x-request-id']).toBeDefined()
  })

  test('429 response includes X-Request-ID', async () => {
    const rateLimitApp = await buildApp()
    for (let i = 0; i < WRITE_RATE_LIMIT.max; i++) {
      await rateLimitApp.inject({ method: 'POST', url: '/v1/items', payload: { name: 'x', price: 1 } })
    }
    const response = await rateLimitApp.inject({ method: 'POST', url: '/v1/items', payload: { name: 'x', price: 1 } })
    expect(response.statusCode).toBe(429)
    expect(response.headers['x-request-id']).toBeDefined()
    await rateLimitApp.close()
  })
})
