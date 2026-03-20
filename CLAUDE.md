# Node.js Fastify Starter - Claude Development Guide

## Stack

- **Node.js 22+ (LTS)**
- **Fastify** - Fast web framework
- **TypeScript 5.7+** in strict mode
- **tsx** - Fast TS execution with watch mode
- **@fastify/helmet** - HTTP security headers (enabled by default)
- **@fastify/rate-limit** - Request rate limiting (enabled by default)
- **@fastify/swagger** - OpenAPI 3.0 spec generation (enabled by default)
- **@fastify/swagger-ui** - Swagger UI at /docs (dev/staging only)

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
├── index.ts          # Server entry point (listen, graceful shutdown)
├── app.ts            # App factory — buildApp() registers plugins + routes
├── config.ts         # Environment variable validation (zod)
├── index.test.ts     # Route integration tests
└── config.test.ts    # Env schema unit tests
dist/
└── index.html        # Landing page served at GET /
tsconfig.json         # TypeScript config (NodeNext ESM)
vitest.config.ts      # Test runner config
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

Copy `.env.example` to `.env` to configure local environment variables.

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

`@fastify/helmet` and `@fastify/rate-limit` are pre-installed and registered by default in `src/index.ts` — both are already included in `package.json` — no install needed.

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

Route schemas validate input and also feed into the auto-generated OpenAPI docs — add `summary` and `tags` to control how a route appears in Swagger UI.

```typescript
const itemSchema = {
  summary: 'Create an item',
  tags: ['items'],
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

## API Documentation

`@fastify/swagger` and `@fastify/swagger-ui` are pre-installed and registered by default in `src/index.ts`.

```bash
npm install @fastify/swagger @fastify/swagger-ui
```

```typescript
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

// Register after security plugins, before routes
await fastify.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: { title: 'My API', description: 'API docs', version: '1.0.0' }
  }
})

// Only expose docs UI outside production
if (process.env.NODE_ENV !== 'production') {
  await fastify.register(swaggerUi, { routePrefix: '/docs' })
}
```

| Endpoint | Description |
|----------|-------------|
| `/docs` | Swagger UI (dev/staging only — disabled when `NODE_ENV=production`) |
| `/docs/json` | Raw OpenAPI JSON schema |

Routes contribute to the spec automatically when their `schema` includes `summary` and `tags`.

## Testing

vitest is pre-installed. Run tests with:

```bash
npm test         # Run once
npm run test:watch  # Watch mode
```

Example test:
```typescript
// src/index.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
})

test('GET /health returns 200 with healthy status', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' })
  expect(response.statusCode).toBe(200)
  expect(response.json().status).toBe('healthy')
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
