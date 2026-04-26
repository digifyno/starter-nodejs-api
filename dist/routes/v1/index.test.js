import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
let app;
beforeAll(async () => {
    app = await buildApp();
});
afterAll(async () => {
    await app.close();
});
describe('GET /v1/status', () => {
    test('returns version, status, and timestamp', async () => {
        const response = await app.inject({ method: 'GET', url: '/v1/status' });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.version).toBe('1');
        expect(body.status).toBe('ok');
        expect(typeof body.timestamp).toBe('string');
        expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
    });
});
describe('GET /v1/items', () => {
    test('returns paginated envelope with data and pagination fields', async () => {
        const res = await app.inject({ method: 'GET', url: '/v1/items' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.pagination).toBeDefined();
        expect(typeof body.pagination.hasMore).toBe('boolean');
    });
    test('default page returns 20 items with hasMore true and a nextCursor', async () => {
        const res = await app.inject({ method: 'GET', url: '/v1/items' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.data).toHaveLength(20);
        expect(body.pagination.hasMore).toBe(true);
        expect(typeof body.pagination.nextCursor).toBe('string');
    });
    test('limit=5 returns 5 items with hasMore true', async () => {
        const res = await app.inject({ method: 'GET', url: '/v1/items?limit=5' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.data).toHaveLength(5);
        expect(body.pagination.hasMore).toBe(true);
    });
    test('cursor pagination returns items starting after the first page', async () => {
        const firstRes = await app.inject({ method: 'GET', url: '/v1/items?limit=5' });
        const firstBody = firstRes.json();
        const cursor = firstBody.pagination.nextCursor;
        const secondRes = await app.inject({ method: 'GET', url: `/v1/items?limit=5&cursor=${cursor}` });
        expect(secondRes.statusCode).toBe(200);
        const secondBody = secondRes.json();
        expect(secondBody.data[0].id).toBeGreaterThan(firstBody.data[firstBody.data.length - 1].id);
    });
    test('limit=50 returns all items with hasMore false and null nextCursor', async () => {
        const res = await app.inject({ method: 'GET', url: '/v1/items?limit=50' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.data).toHaveLength(50);
        expect(body.pagination.hasMore).toBe(false);
        expect(body.pagination.nextCursor).toBeNull();
    });
    test('limit=1 returns exactly 1 item', async () => {
        const res = await app.inject({ method: 'GET', url: '/v1/items?limit=1' });
        expect(res.statusCode).toBe(200);
        expect(res.json().data).toHaveLength(1);
    });
    test('limit=100 returns 50 items (less than limit) with hasMore false', async () => {
        const res = await app.inject({ method: 'GET', url: '/v1/items?limit=100' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.data).toHaveLength(50);
        expect(body.pagination.hasMore).toBe(false);
    });
    test('limit=0 returns 400 (below minimum)', async () => {
        const res = await app.inject({ method: 'GET', url: '/v1/items?limit=0' });
        expect(res.statusCode).toBe(400);
    });
    test('limit=101 returns 400 (above maximum)', async () => {
        const res = await app.inject({ method: 'GET', url: '/v1/items?limit=101' });
        expect(res.statusCode).toBe(400);
    });
    test('malformed cursor returns 400 Problem Detail', async () => {
        const res = await app.inject({ method: 'GET', url: '/v1/items?cursor=INVALID!!!' });
        expect(res.statusCode).toBe(400);
        expect(res.headers['content-type']).toContain('application/problem+json');
        expect(res.json().status).toBe(400);
    });
});
describe('POST /v1/items', () => {
    test('creates an item with valid body', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/items',
            payload: { name: 'Widget', price: 9.99 }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.status).toBe('created');
        expect(body.item.name).toBe('Widget');
        expect(body.item.price).toBe(9.99);
    });
    test('returns 400 when body is invalid', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/items',
            payload: { name: 'Widget' } // missing required 'price'
        });
        expect(response.statusCode).toBe(400);
    });
    test('returns 400 when extra fields are present (mass assignment prevention)', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/items',
            payload: { name: 'Widget', price: 9.99, role: 'admin' }
        });
        expect(response.statusCode).toBe(400);
    });
});
describe('POST /v1/items input boundaries', () => {
    test('price: 0 is accepted (minimum boundary)', async () => {
        const res = await app.inject({
            method: 'POST', url: '/v1/items',
            payload: { name: 'Widget', price: 0 }
        });
        expect(res.statusCode).toBe(200);
    });
    test('price: -0.01 is rejected with 400 (below minimum)', async () => {
        const res = await app.inject({
            method: 'POST', url: '/v1/items',
            payload: { name: 'Widget', price: -0.01 }
        });
        expect(res.statusCode).toBe(400);
    });
    test('name at maxLength (255 chars) is accepted', async () => {
        const res = await app.inject({
            method: 'POST', url: '/v1/items',
            payload: { name: 'a'.repeat(255), price: 1 }
        });
        expect(res.statusCode).toBe(200);
    });
    test('name exceeding maxLength (256 chars) is rejected with 400', async () => {
        const res = await app.inject({
            method: 'POST', url: '/v1/items',
            payload: { name: 'a'.repeat(256), price: 1 }
        });
        expect(res.statusCode).toBe(400);
    });
    test('description field is rejected with 400 (additionalProperties: false)', async () => {
        const res = await app.inject({
            method: 'POST', url: '/v1/items',
            payload: { name: 'Widget', price: 9.99, description: 'extra' }
        });
        expect(res.statusCode).toBe(400);
    });
});
// POST /v1/items rate limiting covered in src/rate-limit.test.ts
//# sourceMappingURL=index.test.js.map