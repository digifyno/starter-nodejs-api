# Node.js Fastify Starter Template

A minimal, production-ready Fastify backend starter template with TypeScript.

## Features

- **Fastify** - Fast and low overhead web framework
- **TypeScript** - Full type safety
- **tsx** - Fast TypeScript execution for development
- **Auto-reload** - Hot reloading during development
- **Production builds** - Compiled JavaScript output

## Quick Start

```bash
# Install dependencies
npm install

# Run development server (auto-reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Visit http://localhost:3000
```

## Project Structure

```
├── src/
│   └── index.ts         # Fastify application
├── dist/
│   └── index.html       # Placeholder page (kept in git)
├── tsconfig.json        # TypeScript configuration
└── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Root endpoint (serves dist/index.html or API info) |
| GET | `/health` | Health check |
| GET | `/api/hello` | Sample API endpoint |
| POST | `/api/items` | Create an item |
| GET | `/api/items/:id` | Get item by ID |

## Adding Endpoints

```typescript
// GET request
fastify.get('/api/users', async (request, reply) => {
  return { users: [] }
})

// POST request with typed body
interface CreateUserBody {
  name: string
  email: string
}

fastify.post<{ Body: CreateUserBody }>('/api/users', async (request, reply) => {
  const { name, email } = request.body
  return { created: true, user: { name, email } }
})

// Route with params
fastify.get<{ Params: { id: string } }>('/api/users/:id', async (request, reply) => {
  const { id } = request.params
  return { user: { id, name: 'John' } }
})
```

## Environment Variables

Create a `.env` file:

```env
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://user:password@localhost/dbname
```

Access in code:

```typescript
const port = parseInt(process.env.PORT || '3000')
```

## Database Integration

### PostgreSQL with pg

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

### MongoDB

```bash
npm install mongodb
```

```typescript
import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.MONGODB_URL!)
await client.connect()
const db = client.db('mydb')
```

## CORS (for frontend)

```bash
npm install @fastify/cors
```

```typescript
import cors from '@fastify/cors'

await fastify.register(cors, {
  origin: 'http://localhost:5173'
})
```

## Production Deployment

### Build and run

```bash
npm run build
npm start
```

### systemd Service

```ini
[Unit]
Description=Fastify API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/myapp
ExecStart=/usr/bin/node /var/www/myapp/dist/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
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
