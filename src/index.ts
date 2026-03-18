import dotenv from 'dotenv'
import { buildApp } from './app.js'

dotenv.config()

const start = async () => {
  const fastify = await buildApp()

  try {
    const port = parseInt(process.env.PORT || '3000')
    const host = process.env.HOST || '0.0.0.0'

    await fastify.listen({ port, host })
    console.log(`Server running at http://${host}:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
