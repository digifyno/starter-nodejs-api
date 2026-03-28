import Fastify from 'fastify'
import type { FastifyInstance, FastifyError } from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import compress from '@fastify/compress'
import cors from '@fastify/cors'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { config } from './config.js'
import { createProblemDetail } from './errors.js'
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

interface BuildOptions {
  nodeEnv?: string
}

export async function buildApp(options?: BuildOptions): Promise<FastifyInstance> {
  const htmlPath = join(__dirname, '../dist/index.html')
  const indexHtml = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf-8') : null

  const fastify = Fastify({
    logger: true,
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID()
  })

  await fastify.register(helmet)
  await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  await fastify.register(cors, {
    origin: (options?.nodeEnv ?? config.NODE_ENV) === 'production' ? false : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await fastify.register(compress, { global: true, encodings: ['br', 'gzip', 'deflate'] })

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

  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500

    reply.header('Content-Type', 'application/problem+json')

    if (statusCode === 400) {
      return reply.code(400).send(
        createProblemDetail(400, 'Bad Request', error.message, request.url)
      )
    }

    if (statusCode === 404) {
      return reply.code(404).send(
        createProblemDetail(404, 'Not Found', 'The requested resource was not found.', request.url)
      )
    }

    if (statusCode === 429) {
      return reply.code(429).send(
        createProblemDetail(429, 'Too Many Requests', 'Rate limit exceeded. Please try again later.', request.url)
      )
    }

    if (statusCode === 413) {
      return reply.code(413).send(
        createProblemDetail(413, 'Payload Too Large', 'Request body exceeds the 1MB size limit.', request.url)
      )
    }

    request.log.error(error, 'Unhandled error')
    return reply.code(statusCode >= 500 ? statusCode : 500).send(
      createProblemDetail(statusCode >= 500 ? statusCode : 500, 'Internal Server Error', 'An unexpected error occurred.', request.url)
    )
  })

  fastify.setNotFoundHandler((request, reply) => {
    reply
      .header('Content-Type', 'application/problem+json')
      .code(404)
      .send(createProblemDetail(404, 'Not Found', 'The requested resource was not found.', request.url))
  })

  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-ID', request.id)
  })

  fastify.get('/', {
    config: { compress: false }
  }, async (request, reply) => {
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
    config: { compress: false, rateLimit: false },
    schema: {
      summary: 'Liveness probe',
      tags: ['health'],
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    return { status: 'ok' }
  })

  fastify.get('/health/ready', {
    config: { compress: false, rateLimit: false },
    schema: {
      summary: 'Readiness probe',
      tags: ['health'],
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        503: { type: 'object', properties: { status: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    if (!fastify.server.listening) {
      return reply.code(503).send({ status: 'not_ready' })
    }
    return { status: 'ready' }
  })

  fastify.get<{ Reply: HealthResponse }>('/health', {
    config: { compress: false, rateLimit: false },
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
    reply.header('Cache-Control', 'no-store')
    return { status: 'healthy', message: 'API is running', timestamp: new Date().toISOString() }
  })

  fastify.get('/ping', { config: { compress: false, rateLimit: false } }, async () => 'pong')

  fastify.get('/api/hello', {
    schema: { summary: 'Hello endpoint', tags: ['api'] }
  }, async (request, reply) => {
    return { message: 'Hello from Fastify!' }
  })

  // Per-route override: tighter limit for write operations
  fastify.post<{ Body: Item }>('/api/items', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
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
    const numId = parseInt(id, 10)

    if (isNaN(numId) || numId <= 0) {
      return reply
        .code(404)
        .header('Content-Type', 'application/problem+json')
        .send(createProblemDetail(404, 'Not Found', `Item with id '${id}' was not found.`, request.url))
    }

    return { item_id: numId, name: `Item ${id}`, price: 99.99 }
  })

  await fastify.register(v1Routes, { prefix: '/v1' })

  return fastify
}
