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
import healthRoutes from './routes/health.js'
import apiRoutes from './routes/api.js'
import v1Routes from './routes/v1/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
      return reply.code(400).send(createProblemDetail(400, 'Bad Request', error.message, request.url))
    }
    if (statusCode === 404) {
      return reply.code(404).send(createProblemDetail(404, 'Not Found', 'The requested resource was not found.', request.url))
    }
    if (statusCode === 429) {
      return reply.code(429).send(createProblemDetail(429, 'Too Many Requests', 'Rate limit exceeded. Please try again later.', request.url))
    }
    if (statusCode === 413) {
      return reply.code(413).send(createProblemDetail(413, 'Payload Too Large', 'Request body exceeds the 1MB size limit.', request.url))
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

  fastify.get('/', { config: { compress: false } }, async (_, reply) => {
    if (indexHtml) {
      return reply.type('text/html').send(indexHtml)
    }
    return {
      message: 'Fastify Backend',
      docs: config.NODE_ENV !== 'production' ? '/docs' : 'disabled in production',
      health: '/health'
    }
  })

  await fastify.register(healthRoutes)
  await fastify.register(apiRoutes, { prefix: '/api' })
  await fastify.register(v1Routes, { prefix: '/v1' })

  return fastify
}
