import type { FastifyPluginAsync } from 'fastify'
import { createProblemDetail } from '../errors.js'

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
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      summary: 'Create an item',
      tags: ['items'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'price'],
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string', maxLength: 1000 },
          price: { type: 'number', minimum: 0 }
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

    return { item_id: numId, name: `Item ${id}`, price: 99.99 }
  })
}

export default apiRoutes
