import { FastifyPluginAsync } from 'fastify'

// When /v2 is released, add to onSend hook:
// reply.header('Deprecation', 'true')
// reply.header('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT')
// reply.header('Link', '</v2/status>; rel="successor-version"')

const v1Routes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/status', {
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
}

export default v1Routes
