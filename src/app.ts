import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
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
import { registerErrorHandlers } from './errors.js'
import healthRoutes from './routes/health.js'
import apiRoutes from './routes/api.js'
import v1Routes from './routes/v1/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface BuildOptions {
  nodeEnv?: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function registerPlugins(fastify: FastifyInstance, nodeEnv: string): Promise<void> {
  await fastify.register(helmet)
  await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  // credentials: true must only be set when origin is a specific allowlist, not a wildcard/reflect-all.
  // https://fetch.spec.whatwg.org/#cors-protocol-and-credentials
  await fastify.register(cors, {
    origin: nodeEnv === 'production' ? false : true,
    credentials: false,
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

  if (nodeEnv !== 'production') {
    await fastify.register(swaggerUi, { routePrefix: '/docs', baseDir: __dirname })
  }
}

export async function buildApp(options?: BuildOptions): Promise<FastifyInstance> {
  const nodeEnv = options?.nodeEnv ?? config.NODE_ENV
  const htmlPath = join(__dirname, '../dist/index.html')
  const indexHtml = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf-8') : null

  const fastify = Fastify({
    logger: {
      level: 'info',
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]'
      ]
    },
    genReqId: (req) => {
      const id = req.headers['x-request-id']
      if (typeof id === 'string' && UUID_REGEX.test(id)) return id
      return randomUUID()
    },
    ajv: {
      customOptions: {
        // Reject requests with extra body fields rather than silently stripping them.
        // Schemas that declare additionalProperties: false will return 400 on unknown keys.
        removeAdditional: false
      }
    }
  })

  await registerPlugins(fastify, nodeEnv)
  registerErrorHandlers(fastify)

  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-ID', request.id)
  })

  fastify.get('/', { config: { compress: false } }, async (_, reply) => {
    if (indexHtml) {
      return reply.type('text/html').send(indexHtml)
    }
    return {
      message: 'Fastify Backend',
      docs: nodeEnv !== 'production' ? '/docs' : 'disabled in production',
      health: '/health'
    }
  })

  await fastify.register(healthRoutes)
  await fastify.register(apiRoutes, { prefix: '/api' })
  await fastify.register(v1Routes, { prefix: '/v1' })

  return fastify
}
