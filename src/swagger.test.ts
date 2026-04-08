import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

// vi.mock is hoisted by vitest before any imports, so config.NODE_ENV will be
// 'production' when app.ts registers its plugins — exercising the swagger gate.
vi.mock('./config.js', () => ({
  config: {
    NODE_ENV: 'production',
    PORT: 3000,
    HOST: '0.0.0.0',
  }
}))

import { buildApp } from './app.js'

describe('Swagger UI production gate', () => {
  let prodApp: FastifyInstance

  beforeAll(async () => {
    prodApp = await buildApp()
  })

  afterAll(async () => {
    await prodApp.close()
  })

  test('GET /docs returns 404 in production', async () => {
    const response = await prodApp.inject({ method: 'GET', url: '/docs' })
    expect(response.statusCode).toBe(404)
  })

  test('GET /docs/json returns 404 in production', async () => {
    const response = await prodApp.inject({ method: 'GET', url: '/docs/json' })
    expect(response.statusCode).toBe(404)
  })

  test('buildApp({ nodeEnv: production }) disables swagger UI without vi.mock', async () => {
    const app = await buildApp({ nodeEnv: 'production' })
    const res = await app.inject({ method: 'GET', url: '/docs' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
