import type { FastifyPluginAsync } from 'fastify'
import { createProblemDetail } from '../errors.js'
import { baseItemBodySchema, WRITE_RATE_LIMIT } from '../schemas.js'

interface Item {
  name: string
  description?: string
  price: number
}

const apiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/hello', {
    schema: { summary: 'Hello endpoint', tags: ['api'] }
  }, async () => {
    return { message: 'Hello from Fastify!' }
  })

  fastify.post<{ Body: Item }>('/items', {
    config: { rateLimit: WRITE_RATE_LIMIT },
    schema: {
      summary: 'Create an item',
      tags: ['items'],
      body: {
        ...baseItemBodySchema,
        properties: {
          ...baseItemBodySchema.properties,
          description: { type: 'string', maxLength: 1000 }
        }
      }
    }
  }, async (request) => {
    return { status: 'created', item: request.body }
  })

  fastify.get<{ Params: { id: string } }>('/items/:id', {
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

    return { itemId: numId, name: `Item ${id}`, price: 99.99 }
  })
}

export default apiRoutes
