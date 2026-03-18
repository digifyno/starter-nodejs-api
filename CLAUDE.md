# Node.js Fastify Starter - Claude Development Guide

## Stack

- **Node.js 20+**
- **Fastify** - Fast web framework
- **TypeScript 5.7+** in strict mode
- **tsx** - Fast TS execution with watch mode
- **@fastify/helmet** - HTTP security headers (enabled by default)
- **@fastify/rate-limit** - Request rate limiting (enabled by default)

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (auto-reload on file changes)
npm run dev

# Type check without building
npx tsc --noEmit

# Build for production
npm run build

# Run production build
npm start
```

## Project Structure

```
src/
└── index.ts         # Fastify app entry point
dist/               # Build output + static files
tsconfig.json       # TypeScript config
```

## Key Patterns

### Define Routes

```typescript
// GET
fastify.get('/api/data', async (request, reply) => {
  return { data: [] }
})

// POST with typed body
interface CreateItem {
  name: string
  price: number
}

fastify.post<{ Body: CreateItem }>('/api/items', async (request, reply) => {
  const item = request.body
  return { created: item }
})

// Route parameters
fastify.get<{ Params: { id: string } }>('/api/items/:id', async (request, reply) => {
  const { id } = request.params
  return { id }
})

// Query parameters
fastify.get<{ Querystring: { limit: string } }>('/api/items', async (request, reply) => {
  const limit = parseInt(request.query.limit || '10')
  return { limit }
})
```

### Error Handling

```typescript
import { FastifyError } from 'fastify'

fastify.get('/api/items/:id', async (request, reply) => {
  const { id } = request.params
  
  if (!itemExists(id)) {
    return reply.code(404).send({ error: 'Item not found' })
  }
  
  return { item: {} }
})

// Error handler
fastify.setErrorHandler((error: FastifyError, request, reply) => {
  fastify.log.error(error)
  reply.status(error.statusCode || 500).send({
    error: error.message
  })
})
```

### Hooks (Middleware)

```typescript
// Before all routes
fastify.addHook('onRequest', async (request, reply) => {
  console.log('Request received:', request.url)
})

// Before specific route
fastify.addHook('preHandler', async (request, reply) => {
  // Auth check, etc.
  const token = request.headers.authorization
  if (!token) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
})
```

### Plugins

```typescript
// Create a plugin
async function myPlugin(fastify, options) {
  fastify.decorate('myUtility', () => {
    return 'Hello'
  })
  
  fastify.get('/plugin-route', async () => {
    return { message: fastify.myUtility() }
  })
}

// Register plugin
fastify.register(myPlugin)
```

## Environment Variables

```typescript
import dotenv from 'dotenv'
dotenv.config()

const PORT = parseInt(process.env.PORT || '3000')
const DATABASE_URL = process.env.DATABASE_URL
```

## Database Integration

### PostgreSQL (pg)

```bash
npm install pg @types/pg
```

```typescript
import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

fastify.get('/api/users', async () => {
  const result = await pool.query('SELECT * FROM users')
  return result.rows
})
```

### Prisma ORM

```bash
npm install prisma @prisma/client
npx prisma init
```

```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

fastify.get('/api/users', async () => {
  return await prisma.user.findMany()
})
```

## Security

`@fastify/helmet` and `@fastify/rate-limit` are pre-installed and registered by default in `src/index.ts`.

```bash
npm install @fastify/helmet @fastify/rate-limit
```

```typescript
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

// Register before routes
await fastify.register(helmet)
await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' })
```

`helmet` sets secure HTTP response headers (CSP, HSTS, X-Frame-Options, etc.).
`rateLimit` limits each IP to 100 requests per minute by default — adjust `max` and `timeWindow` as needed.

## CORS

```bash
npm install @fastify/cors
```

```typescript
import cors from '@fastify/cors'

await fastify.register(cors, {
  origin: ['http://localhost:5173', 'https://example.com'],
  credentials: true
})
```

## Authentication (JWT)

```bash
npm install @fastify/jwt
```

```typescript
import jwt from '@fastify/jwt'

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET!
})

fastify.post('/login', async (request, reply) => {
  const token = fastify.jwt.sign({ user: 'john' })
  return { token }
})

// Protected route
fastify.get('/protected', {
  onRequest: [fastify.authenticate]
}, async (request, reply) => {
  return { user: request.user }
})

// Add authenticate method
fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.send(err)
  }
})
```

## File Uploads

```bash
npm install @fastify/multipart
```

```typescript
import multipart from '@fastify/multipart'

await fastify.register(multipart)

fastify.post('/upload', async (request, reply) => {
  const data = await request.file()
  // data.file is a stream
  return { filename: data.filename }
})
```

## Static Files

```typescript
import fastifyStatic from '@fastify/static'
import { join } from 'path'

await fastify.register(fastifyStatic, {
  root: join(__dirname, '../public')
})
```

## Validation (JSON Schema)

```typescript
const itemSchema = {
  body: {
    type: 'object',
    required: ['name', 'price'],
    properties: {
      name: { type: 'string' },
      price: { type: 'number' }
    }
  }
}

fastify.post('/api/items', { schema: itemSchema }, async (request, reply) => {
  return { created: request.body }
})
```

## Testing

No test framework is pre-installed. To add testing:

```bash
npm install --save-dev vitest
```

Add to `package.json` scripts: `"test": "vitest run"`

Example test:
```typescript
// src/index.test.ts
import { test, expect } from 'vitest'
import Fastify from 'fastify'

test('GET /health returns 200', async () => {
  const app = Fastify()
  app.get('/health', async () => ({ status: 'ok' }))

  const response = await app.inject({
    method: 'GET',
    url: '/health'
  })

  expect(response.statusCode).toBe(200)
})
```

## Production Build

```bash
npm run build
# Output: dist/
```

Run with:
```bash
NODE_ENV=production node dist/index.js
```

## systemd Service

```ini
[Unit]
Description=Fastify API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/myapp
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

## Resources

- [Fastify Docs](https://fastify.dev/)
- [Fastify Plugins](https://fastify.dev/ecosystem/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
