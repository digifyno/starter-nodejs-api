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
- **@fastify/compress** - Response compression (gzip/brotli, enabled by default)

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
├── index.ts              # Server entry point (listen, graceful shutdown)
├── app.ts                # App factory — buildApp() registers plugins + routes
├── config.ts             # Environment variable validation (zod)
├── errors.ts             # RFC 9457 Problem Details error helpers
├── pagination.ts         # Cursor-based pagination utilities
├── index.test.ts         # Route integration tests
├── config.test.ts        # Env schema unit tests
├── pagination.test.ts    # Pagination utility tests
└── routes/
    └── v1/
        └── index.ts      # v1 API routes (/v1/status)
dist/
└── index.html            # Landing page served at GET /
tsconfig.json             # TypeScript config (NodeNext ESM)
vitest.config.ts          # Test runner config
```

## Forbidden Actions

- **DO NOT create, modify, or delete any files under `.github/workflows/`** — GitHub Actions workflow files require a special `workflow` PAT scope that is not available to RSI workers. Any push containing workflow file changes will be rejected by GitHub with a non-retryable error, wasting the entire task cycle.
- DO NOT create files named `*.yml` or `*.yaml` inside `.github/` at any level unless explicitly instructed with a confirmed PAT scope upgrade.

## Key Patterns

### Define Routes

```typescript
// GET
fastify.get('/api/data', {
  schema: {
    summary: 'Get all data',
    tags: ['data']
  }
}, async (request, reply) => {
  return { data: [] }
})

// POST with typed body
interface CreateItem {
  name: string
  price: number
}

fastify.post<{ Body: CreateItem }>('/api/items', {
  schema: {
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
}, async (request, reply) => {
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

Use the RFC 9457 Problem Details helpers from `src/errors.ts`:

```typescript
import { createProblemDetail } from './errors.js'

// In route handlers — return a Problem Details response for business-logic errors:
fastify.get<{ Params: { id: string } }>('/api/items/:id', async (request, reply) => {
  const { id } = request.params

  if (!itemExists(id)) {
    return reply
      .code(404)
      .header('Content-Type', 'application/problem+json')
      .send(createProblemDetail(404, 'Not Found', `Item with id '${id}' was not found.`, request.url))
  }

  return { item: {} }
})

// The global error handler (already registered in buildApp()) handles 400, 404, 429, 413, 500
// automatically via createProblemDetail — individual routes only need to handle
// business-logic 404s and similar cases explicitly.
```

### Cursor-Based Pagination

Use the pagination utilities from `src/pagination.ts`:

```typescript
import { paginationQuerySchema, paginatedResponse, decodeCursor, encodeCursor } from './pagination.js'

fastify.get<{ Querystring: { limit?: number; cursor?: string } }>('/v1/items', {
  schema: { querystring: paginationQuerySchema, summary: 'List items', tags: ['v1'] }
}, async (request) => {
  const { limit = 20, cursor } = request.query
  const after = cursor ? decodeCursor(cursor) : null
  // ... fetch items where id > (after?.id ?? 0), slice to limit + 1 to detect hasMore
  const hasMore = items.length > limit
  const page = items.slice(0, limit)
  const nextCursor = hasMore ? encodeCursor({ id: page[page.length - 1].id }) : null
  return paginatedResponse(page, nextCursor)
})
// Response shape: { data: [...], pagination: { nextCursor: string|null, hasMore: boolean } }
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

`@fastify/helmet` and `@fastify/rate-limit` are pre-installed and registered by default in `src/app.ts` — both are already included in `package.json` — no install needed.

```typescript
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

// Register before routes
await fastify.register(helmet)
await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' })
```

`helmet` sets secure HTTP response headers (CSP, HSTS, X-Frame-Options, etc.).
`rateLimit` limits each IP to 100 requests per minute by default — adjust `max` and `timeWindow` as needed.

### Per-Route Rate Limiting

Override the global limit for specific routes using the `config.rateLimit` option:

```typescript
// Tighter limit for auth/write endpoints (brute-force protection)
fastify.post('/api/auth/login', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
}, handler)

// Exempt health probes — load balancer checks must not exhaust the rate limit budget
fastify.get('/health/live', {
  config: { rateLimit: false }
}, handler)
```

**Recommended limits by endpoint type:**
| Endpoint type | Suggested limit |
|---|---|
| Auth / login / token | 10 req/min (brute-force protection) |
| Write operations (POST/PUT) | 20–30 req/min |
| Public read endpoints | 100 req/min (global default) |
| Health probes (`/health/live`, `/health/ready`) | exempt (`rateLimit: false`) |

Both health probe endpoints in this starter already use `config: { rateLimit: false }`. Write routes (`POST /api/items`, `POST /v1/items`) already use `config: { rateLimit: { max: 30, timeWindow: '1 minute' } }`.

### Rate Limiting: Single-Instance Limitation

`@fastify/rate-limit` stores counters **in memory by default**. This works correctly for single-instance deployments but does **not** share state across multiple instances. In a horizontally scaled deployment (multiple pods/processes behind a load balancer), each instance tracks requests independently — effectively multiplying the allowed rate by the number of instances.

For multi-instance deployments, use a Redis-backed store:

```bash
npm install @fastify/rate-limit ioredis
```

```typescript
import Redis from 'ioredis'
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  redis: new Redis({ host: process.env.REDIS_HOST })
})
```

Responses are automatically compressed via `@fastify/compress` — no extra configuration needed. Health check endpoints (`/health/live`, `/health/ready`, `/health`), the root discovery endpoint (`GET /`), and status routes (`GET /v1/status`) are excluded from compression since their payloads are too small to benefit.

**Rule**: Routes with consistently small, fixed-size payloads (<1KB) should use `config: { compress: false }` to avoid compression CPU overhead with no size benefit (compression ratio approaches 1:1 or worse on tiny JSON). Do **not** apply this to routes that may return large or variable-size payloads (e.g., bulk data endpoints, `/docs/json` OpenAPI spec). All three health endpoints (`/health`, `/health/live`, `/health/ready`) set `Cache-Control: no-store` to prevent proxy/CDN caching of probe state.

`/health/ready` performs a real `server.listening` check — it returns 503 `{ status: "not_ready" }` if the Fastify server has not finished binding to a port (e.g., during initialization). Apps with external dependencies should extend this check with their own readiness logic, for example:

```typescript
// Example: add a database connectivity check
try {
  await pool.query("SELECT 1")
} catch {
  return reply.code(503).send({ status: "not_ready" })
}
```

## Request Limits

Fastify enforces a default body size limit of 1MB (`bodyLimit: 1048576`). Override in `buildApp()` for endpoints that need larger payloads:

```typescript
const fastify = Fastify({ bodyLimit: 5 * 1024 * 1024 }) // 5MB
```

For file upload routes using `@fastify/multipart`, set the limit at the plugin level instead.

## CORS (pre-configured)

`@fastify/cors` is pre-installed and registered by default. In **production** (`NODE_ENV=production`), CORS is disabled (`origin: false`). In **development/staging**, all origins are permitted (`origin: true`). Override in `buildApp()` to restrict to specific origins in staging or non-production environments:

```typescript
// Override in buildApp() or extend in your own plugin:
await fastify.register(cors, {
  origin: ['https://app.example.com'],
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

`@fastify/swagger` and `@fastify/swagger-ui` are pre-installed — no install step needed.

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
npm audit --audit-level=high  # Fail on high/critical CVEs
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # Run with coverage report
```

Coverage thresholds are enforced in `vitest.config.ts` — the build fails if any threshold is not met:

| Metric     | Threshold |
|------------|-----------|
| Lines      | 75%       |
| Functions  | 80%       |
| Branches   | 75%       |
| Statements | 75%       |

> **CI environments**: Use `npm ci` instead of `npm install` for reproducible, locked installs. `npm ci` installs exactly what is in `package-lock.json` and fails if the lockfile is out of sync.

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


### Rate-Limit 429 Integration Tests

Test that rate-limited endpoints return HTTP 429 with the correct response shape and `Retry-After` / `X-RateLimit-*` headers. Use `app.inject()` in a loop to exhaust the configured limit:

```typescript
test('POST /api/items returns 429 after exceeding rate limit', async () => {
  const limit = 30 // matches config.rateLimit.max for write routes
  // Exhaust the limit
  for (let i = 0; i < limit; i++) {
    await app.inject({ method: 'POST', url: '/api/items', payload: { name: 'x', price: 1 } })
  }
  // Next request should be rate-limited
  const response = await app.inject({ method: 'POST', url: '/api/items', payload: { name: 'x', price: 1 } })
  expect(response.statusCode).toBe(429)
  expect(response.headers['retry-after']).toBeDefined()
  expect(response.headers['x-ratelimit-limit']).toBeDefined()
  expect(response.json()).toMatchObject({ statusCode: 429 })
})
```

**Note**: `@fastify/rate-limit` stores counters in-memory by default. In tests, build a **fresh** `app` instance per `describe` block (or use `afterEach(() => app.close())`) so rate-limit counters reset between tests.

## CI/CD (GitHub Actions)

> **Note for RSI workers**: The CI configuration below is shown as reference only. Do NOT create or modify `.github/workflows/ci.yml` or any workflow file — the RSI PAT does not have `workflow` scope and pushes containing these files will be rejected by GitHub with a non-retryable error.

Cache npm dependencies with `actions/cache` to speed up CI runs. The cache key uses the `package-lock.json` hash so it invalidates automatically when dependencies change:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Cache npm dependencies
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm audit --audit-level=high --omit=dev
```

`actions/cache` caches `~/.npm` (the global npm cache). `npm ci` reuses it on cache hits, reducing install time on repeat runs.

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
