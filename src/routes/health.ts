import type { FastifyPluginAsync } from 'fastify'

interface HealthResponse {
  status: string
  message: string
  timestamp: string
}

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health/live', {
    config: { compress: false, rateLimit: false },
    schema: {
      summary: 'Liveness probe',
      tags: ['health'],
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } }
      }
    }
  }, async (_, reply) => {
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
  }, async (_, reply) => {
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
  }, async (_, reply) => {
    reply.header('Cache-Control', 'no-store')
    return { status: 'healthy', message: 'API is running', timestamp: new Date().toISOString() }
  })
}

export default healthRoutes
