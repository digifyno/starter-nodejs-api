import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from './config.js'

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

export async function buildApp(): Promise<FastifyInstance> {
  // Read HTML once at startup (not on every request)
  const htmlPath = join(__dirname, '../dist/index.html')
  const indexHtml = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf-8') : null

  const fastify = Fastify({
    logger: true
  })

  // Security plugins (registered before routes)
  await fastify.register(helmet)
  await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  // API documentation (OpenAPI 3.0) — disabled in production
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Fastify API',
        description: 'Auto-generated API documentation',
        version: '1.0.0'
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: 'Local development server'
        }
      ]
    }
  })

  if (config.NODE_ENV !== 'production') {
    await fastify.register(swaggerUi, {
      routePrefix: '/docs'
    })
  }

  // Routes
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

  fastify.get<{ Reply: HealthResponse }>('/health', {
    schema: {
      summary: 'Health check',
      tags: ['system'],
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
    return {
      status: 'healthy',
      message: 'API is running',
      timestamp: new Date().toISOString()
    }
  })

  fastify.get('/api/hello', {
    schema: {
      summary: 'Hello endpoint',
      tags: ['api']
    }
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
    return {
      status: 'created',
      item
    }
  })

  fastify.get<{ Params: { id: string } }>('/api/items/:id', {
    schema: {
      summary: 'Get item by ID',
      tags: ['items'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params
    return {
      item_id: parseInt(id),
      name: `Item ${id}`,
      price: 99.99
    }
  })

  return fastify
}
