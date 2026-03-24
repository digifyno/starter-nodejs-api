import { FastifyPluginAsync } from 'fastify'

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

  // POST routes that mutate state: enforced 30 req/min (tighter than global 100)
  fastify.post<{ Body: CreateItemBody }>('/items', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      summary: 'Create a v1 item',
      tags: ['v1'],
      body: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name: { type: 'string' },
          price: { type: 'number' }
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
