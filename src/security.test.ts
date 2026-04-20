import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
})

describe('Helmet security headers', () => {
  const routes = ['/health', '/health/live', '/v1/status', '/api/hello', '/']

  test.each(routes)('GET %s sets X-Content-Type-Options: nosniff', async (url) => {
    const res = await app.inject({ method: 'GET', url })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  test.each(routes)('GET %s sets X-Frame-Options to SAMEORIGIN or DENY', async (url) => {
    const res = await app.inject({ method: 'GET', url })
    const xfo = res.headers['x-frame-options'] as string | undefined
    expect(xfo).toBeDefined()
    expect(['SAMEORIGIN', 'DENY']).toContain(xfo)
  })

  test.each(routes)('GET %s sets X-DNS-Prefetch-Control: off', async (url) => {
    const res = await app.inject({ method: 'GET', url })
    expect(res.headers['x-dns-prefetch-control']).toBe('off')
  })

  test.each(routes)('GET %s includes a Content-Security-Policy header', async (url) => {
    const res = await app.inject({ method: 'GET', url })
    expect(res.headers['content-security-policy']).toBeDefined()
    expect(typeof res.headers['content-security-policy']).toBe('string')
    expect((res.headers['content-security-policy'] as string).length).toBeGreaterThan(0)
  })
})
