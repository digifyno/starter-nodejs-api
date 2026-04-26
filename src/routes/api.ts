import type { FastifyPluginAsync } from 'fastify'
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

  fastify.get<{ Params: { id: number } }>('/items/:id', {
    schema: {
      summary: 'Get item by ID',
      tags: ['items'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1 } }
      }
    }
  }, async (request) => {
    const { id } = request.params
    return { itemId: id, name: `Item ${id}`, price: 99.99 }
  })
}

export default apiRoutes
