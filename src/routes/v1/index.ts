import { FastifyPluginAsync } from 'fastify'
import { decodeCursor, encodeCursor, paginatedResponse, paginationQuerySchema } from '../../pagination.js'

// When /v2 is released, add to onSend hook:
// reply.header('Deprecation', 'true')
// reply.header('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT')
// reply.header('Link', '</v2/status>; rel="successor-version"')

interface CreateItemBody {
  name: string
  price: number
}

const v1Routes: FastifyPluginAsync = async (fastify) => {
  // GET routes inherit the global 100 req/min default — read-only, no override needed
  fastify.get('/status', {
    config: { compress: false },
    schema: {
      summary: 'API v1 status',
      tags: ['v1'],
      response: {
        200: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            status: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async () => ({
    version: '1',
    status: 'ok',
    timestamp: new Date().toISOString()
  }))

  // GET /items: cursor-based pagination over a stub item list
  fastify.get<{ Querystring: { limit?: number; cursor?: string } }>('/items', {
    schema: {
      summary: 'List v1 items',
      tags: ['v1'],
      querystring: paginationQuerySchema
    }
  }, async (request) => {
    const { limit = 20, cursor } = request.query
    const after = cursor ? decodeCursor(cursor, (raw) => typeof raw.id === 'number' && Number.isFinite(raw.id)) : null
    const allItems = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      price: parseFloat(((i + 1) * 9.99).toFixed(2))
    }))
    const startId = (after?.id as number) ?? 0
    const filtered = allItems.filter(item => item.id > startId)
    const page = filtered.slice(0, limit)
    const nextCursor = filtered.length > limit ? encodeCursor({ id: page[page.length - 1].id }) : null
    return paginatedResponse(page, nextCursor)
  })

  // POST routes that mutate state: enforced 30 req/min (tighter than global 100)
  fastify.post<{ Body: CreateItemBody }>('/items', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      summary: 'Create a v1 item',
      tags: ['v1'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'price'],
        properties: {
          name: { type: 'string', maxLength: 255 },
          price: { type: 'number', minimum: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            item: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                price: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request) => {
    return { status: 'created', item: request.body }
  })
}

export default v1Routes
