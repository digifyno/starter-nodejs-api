import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { config } from './config.js'
import v1Routes from './routes/v1/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Types
interface HealthResponse {
  status: string
  message: string
  timestamp: string
}

interface Item {
  name: string
  description?: string
  price: number
}

let appReady = false

export async function buildApp(): Promise<FastifyInstance> {
  const htmlPath = join(__dirname, '../dist/index.html')
  const indexHtml = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf-8') : null

  const fastify = Fastify({
    logger: true,
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID()
  })

  await fastify.register(helmet)
  await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Fastify API',
        description: 'Auto-generated API documentation',
        version: '1.0.0'
      },
      servers: [{ url: `http://localhost:${config.PORT}`, description: 'Local development server' }]
    }
  })

  if (config.NODE_ENV !== 'production') {
    await fastify.register(swaggerUi, { routePrefix: '/docs', baseDir: __dirname })
  }

  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-ID', request.id)
  })

  fastify.addHook('onReady', async () => {
    appReady = true
  })

  fastify.get('/', async (request, reply) => {
    if (indexHtml) {
      return reply.type('text/html').send(indexHtml)
    }
    return {
      message: 'Fastify Backend',
      docs: config.NODE_ENV !== 'production' ? '/docs' : 'disabled in production',
      health: '/health'
    }
  })

  fastify.get('/health/live', {
    schema: {
      summary: 'Liveness probe',
      tags: ['health'],
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } }
      }
    }
  }, async () => ({ status: 'ok' }))

  fastify.get('/health/ready', {
    schema: {
      summary: 'Readiness probe',
      tags: ['health'],
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        503: { type: 'object', properties: { status: { type: 'string' }, error: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    if (!appReady) {
      return reply.code(503).send({ status: 'unavailable', error: 'Service not ready' })
    }
    return { status: 'ready' }
  })

  fastify.get<{ Reply: HealthResponse }>('/health', {
    schema: {
      summary: 'Health check (legacy)',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    return { status: 'healthy', message: 'API is running', timestamp: new Date().toISOString() }
  })

  fastify.get('/api/hello', {
    schema: { summary: 'Hello endpoint', tags: ['api'] }
  }, async (request, reply) => {
    return { message: 'Hello from Fastify!' }
  })

  fastify.post<{ Body: Item }>('/api/items', {
    schema: {
      summary: 'Create an item',
      tags: ['items'],
      body: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    const item = request.body
    return { status: 'created', item }
  })

  fastify.get<{ Params: { id: string } }>('/api/items/:id', {
    schema: {
      summary: 'Get item by ID',
      tags: ['items'],
      params: { type: 'object', properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params
    return { item_id: parseInt(id), name: `Item ${id}`, price: 99.99 }
  })

  await fastify.register(v1Routes, { prefix: '/v1' })

  return fastify
}
