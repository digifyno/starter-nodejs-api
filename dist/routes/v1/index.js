import { config } from '../../config.js';
import { decodeCursor, encodeCursor, paginatedResponse, paginationQuerySchema } from '../../pagination.js';
const v1Routes = async (fastify) => {
    // GET routes inherit the global 100 req/min default — read-only, no override needed
    fastify.get('/status', {
        config: { compress: false },
        schema: {
            summary: 'API v1 status',
            tags: ['v1'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        version: { type: 'string' },
                        status: { type: 'string' },
                        timestamp: { type: 'string' }
                    }
                }
            }
        }
    }, async () => ({
        version: '1',
        status: 'ok',
        timestamp: new Date().toISOString()
    }));
    // GET /items: cursor-based pagination over a stub item list
    fastify.get('/items', {
        schema: {
            summary: 'List v1 items',
            tags: ['v1'],
            querystring: paginationQuerySchema
        }
    }, async (request) => {
        const { limit = 20, cursor } = request.query;
        const after = cursor ? decodeCursor(cursor, config.CURSOR_SECRET, (raw) => typeof raw.id === 'number' && Number.isFinite(raw.id)) : null;
        const allItems = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            name: `Item ${i + 1}`,
            price: parseFloat(((i + 1) * 9.99).toFixed(2))
        }));
        const startId = after?.id ?? 0;
        const filtered = allItems.filter(item => item.id > startId);
        const page = filtered.slice(0, limit);
        const nextCursor = filtered.length > limit ? encodeCursor({ id: page[page.length - 1].id }, config.CURSOR_SECRET) : null;
        return paginatedResponse(page, nextCursor);
    });
    // POST routes that mutate state: enforced 30 req/min (tighter than global 100)
    fastify.post('/items', {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
        schema: {
            summary: 'Create a v1 item',
            tags: ['v1'],
            body: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'price'],
                properties: {
                    name: { type: 'string', maxLength: 255 },
                    price: { type: 'number', minimum: 0 }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        item: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                price: { type: 'number' }
                            }
                        }
                    }
                }
            }
        }
    }, async (request) => {
        return { status: 'created', item: request.body };
    });
};
export default v1Routes;
//# sourceMappingURL=index.js.map