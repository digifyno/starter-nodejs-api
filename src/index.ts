import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const fastify = Fastify({
  logger: true
})

// Security plugins (registered before routes)
await fastify.register(helmet)
await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' })

// Types
interface HealthResponse {
  status: string
  message: string
  timestamp: string
}

interface Item {
  name: string
  description?: string
  price: number
}

// Routes
fastify.get('/', async (request, reply) => {
  // Serve dist/index.html if it exists
  const htmlPath = join(__dirname, '../dist/index.html')
  
  if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, 'utf-8')
    return reply.type('text/html').send(html)
  }
  
  return {
    message: 'Fastify Backend',
    docs: 'No automatic docs (use tools like Postman)',
    health: '/health'
  }
})

fastify.get<{ Reply: HealthResponse }>('/health', async (request, reply) => {
  return {
    status: 'healthy',
    message: 'API is running',
    timestamp: new Date().toISOString()
  }
})

fastify.get('/api/hello', async (request, reply) => {
  return { message: 'Hello from Fastify!' }
})

fastify.post<{ Body: Item }>('/api/items', async (request, reply) => {
  const item = request.body
  return {
    status: 'created',
    item
  }
})

fastify.get<{ Params: { id: string } }>('/api/items/:id', async (request, reply) => {
  const { id } = request.params
  return {
    item_id: parseInt(id),
    name: `Item ${id}`,
    price: 99.99
  }
})

// Start server
const start = async () => {
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
