import { buildApp } from './app.js'
import { config } from './config.js'

const start = async () => {
  const fastify = await buildApp()

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    fastify.log.info({ signal }, 'Shutdown signal received, closing server')
    try {
      await fastify.close()
      process.exit(0)
    } catch (err) {
      fastify.log.error(err, 'Error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  try {
    await fastify.listen({ port: config.PORT, host: config.HOST })
    fastify.log.info({ port: config.PORT, host: config.HOST }, 'Server started')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
