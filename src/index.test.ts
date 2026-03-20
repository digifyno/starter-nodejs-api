import { test, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
})

test('GET /health returns 200 with healthy status', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/health'
  })
  expect(response.statusCode).toBe(200)
  const body = response.json()
  expect(body.status).toBe('healthy')
  expect(body.message).toBe('API is running')
  expect(typeof body.timestamp).toBe('string')
})

test('GET /api/hello returns greeting message', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/hello'
  })
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
  const response = await app.inject({
    method: 'GET',
    url: '/api/items/42'
  })
  expect(response.statusCode).toBe(200)
  const body = response.json()
  expect(body.item_id).toBe(42)
  expect(body.name).toBe('Item 42')
  expect(body.price).toBe(99.99)
})

test('X-Request-ID header is echoed back when provided', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { 'x-request-id': 'test-123' }
  })
  expect(response.statusCode).toBe(200)
  expect(response.headers['x-request-id']).toBe('test-123')
})

test('X-Request-ID is generated when not provided', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/health'
  })
  expect(response.statusCode).toBe(200)
  const reqId = response.headers['x-request-id']
  expect(typeof reqId).toBe('string')
  expect(reqId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})
