// v1.0.0
import { buildApp } from './app.js'
import { config } from './config.js'

const start = async () => {
  const fastify = await buildApp()

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    fastify.log.info({ signal }, 'Received shutdown signal, closing server')

    // Immediately close idle keep-alive connections (Node.js 18.2+)
    fastify.server.closeIdleConnections()

    try {
      await fastify.close()
      fastify.log.info('Server closed gracefully')
      process.exit(0)
    } catch (err) {
      fastify.log.error(err, 'Error during graceful shutdown')
      process.exit(1)
    }
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))

  try {
    await fastify.listen({ port: config.PORT, host: config.HOST })
    fastify.log.info({ port: config.PORT, host: config.HOST }, 'Server started')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
