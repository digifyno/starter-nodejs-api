import { test, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  app.get('/health', async () => ({ status: 'ok' }))
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

test('GET /health returns 200 with ok status', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/health'
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ status: 'ok' })
})
