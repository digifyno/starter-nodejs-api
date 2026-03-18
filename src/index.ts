import dotenv from 'dotenv'
import { buildApp } from './app.js'

dotenv.config()

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
    const port = parseInt(process.env.PORT || '3000')
    const host = process.env.HOST || '0.0.0.0'

    await fastify.listen({ port, host })
    fastify.log.info({ port, host }, 'Server started')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
