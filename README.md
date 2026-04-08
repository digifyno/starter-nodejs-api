# Node.js Fastify Starter Template

A production-ready Fastify backend starter template with TypeScript, pre-configured security, observability, and API documentation.

## Features

- **Fastify 5** — Fast and low overhead web framework
- **TypeScript 5.7+** — Strict mode, NodeNext ESM
- **tsx** — Fast TypeScript execution with watch mode for development
- **`@fastify/helmet`** — HTTP security headers (enabled by default)
- **`@fastify/rate-limit`** — 100 req/min global, 30 req/min on write routes (enabled by default)
- **`@fastify/swagger` + `@fastify/swagger-ui`** — OpenAPI 3.0 docs at `/docs` (dev/staging only)
- **`@fastify/compress`** — gzip/brotli response compression (enabled by default)
- **`@fastify/cors`** — CORS disabled in production, open in dev/staging (enabled by default)
- **Zod** — Environment variable validation with fail-fast on startup

## Quick Start

```bash
# Install dependencies
npm install

# Run development server (auto-reload)
npm run dev

# Type check without building
npx tsc --noEmit

# Build for production
npm run build

# Run production build
npm start

# Visit http://localhost:3000
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
        └── index.ts      # v1 API routes
dist/
└── index.html            # Landing page served at GET /
tsconfig.json             # TypeScript config (NodeNext ESM)
vitest.config.ts          # Test runner config
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Landing page (HTML) or JSON discovery |
| GET | `/health` | Health check (legacy) |
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe (503 until server binds) |
| GET | `/api/hello` | Sample hello endpoint |
| POST | `/api/items` | Create an item (30 req/min) |
| GET | `/api/items/:id` | Get item by ID |
| GET | `/v1/status` | API v1 status |
| GET | `/v1/items` | List items (cursor-based pagination) |
| POST | `/v1/items` | Create a v1 item (30 req/min) |
| GET | `/docs` | Swagger UI (dev/staging only) |

## Adding Endpoints

Routes should include `schema.summary` and `schema.tags` to appear in Swagger UI. Apply rate-limit and compression overrides as appropriate:

```typescript
import { createProblemDetail } from './errors.js'

// GET — read endpoint, inherits global 100 req/min
fastify.get('/api/widgets', {
  schema: {
    summary: 'List widgets',
    tags: ['widgets']
  }
}, async (request, reply) => {
  return { widgets: [] }
})

// POST — write endpoint: tighter rate limit; small fixed response exempted from compression
fastify.post<{ Body: { name: string; price: number } }>('/api/widgets', {
  config: {
    rateLimit: { max: 30, timeWindow: '1 minute' },
    compress: false
  },
  schema: {
    summary: 'Create a widget',
    tags: ['widgets'],
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
  const widget = request.body
  return { status: 'created', widget }
})

// Route with params — return Problem Detail on not found
fastify.get<{ Params: { id: string } }>('/api/widgets/:id', {
  schema: {
    summary: 'Get widget by ID',
    tags: ['widgets'],
    params: { type: 'object', properties: { id: { type: 'string' } } }
  }
}, async (request, reply) => {
  const { id } = request.params
  // example not-found response
  return reply
    .code(404)
    .header('Content-Type', 'application/problem+json')
    .send(createProblemDetail(404, 'Not Found', `Widget '${id}' was not found.`, request.url))
})
```

## Error Response Format

All errors use [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) with `Content-Type: application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Item with id '999' was not found.",
  "instance": "/api/items/999"
}
```

Use `createProblemDetail` from `./errors.js` to produce this shape:

```typescript
import { createProblemDetail } from './errors.js'

createProblemDetail(404, 'Not Found', `Item with id '${id}' was not found.`, request.url)
```

## Environment Variables

Copy `.env.example` to `.env`. All variables are validated by Zod at startup — the server exits immediately if validation fails.

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
```

| Variable | Default | Values |
|----------|---------|--------|
| `PORT` | `3000` | 1–65535 |
| `HOST` | `0.0.0.0` | any string |
| `NODE_ENV` | `development` | `development`, `production`, `test` |

Access validated config in code:

```typescript
import { config } from './config.js'

const port = config.PORT  // validated number
const host = config.HOST  // validated string
```

## Database Integration

### PostgreSQL (pg)

```bash
npm install pg @types/pg
```

```typescript
import pg from 'pg'
const { Pool } = pg

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

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

## CORS

CORS is pre-configured — no install needed. In **production** (`NODE_ENV=production`), CORS is disabled (`origin: false`). In **development/staging**, all origins are permitted (`origin: true`).

To restrict to specific origins, override the registration in `buildApp()` in `src/app.ts` (line 49):

```typescript
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

await fastify.register(jwt, { secret: process.env.JWT_SECRET! })

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
```

## Testing

vitest is pre-installed. Tests import `buildApp` from `app.ts` — not `index.ts`:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'

let app: FastifyInstance

beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

test('GET /health returns 200 with healthy status', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' })
  expect(response.statusCode).toBe(200)
  expect(response.json().status).toBe('healthy')
})
```

Run tests:

```bash
npm test           # Run once
npm run test:watch # Watch mode
npm audit --audit-level=high  # Fail on high/critical CVEs
```

## Production Deployment

### Build and run

```bash
npm run build
NODE_ENV=production node dist/index.js
```

### systemd Service

```ini
[Unit]
Description=Fastify API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/myapp
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

### nginx Configuration

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## Learn More

- [Fastify Documentation](https://fastify.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [tsx Documentation](https://github.com/privatenumber/tsx)

## License

MIT
