/**
 * Cursor-based pagination utilities for Fastify routes.
 *
 * Usage example:
 *
 *   import { paginationQuerySchema, paginatedResponse, decodeCursor, encodeCursor } from './pagination.js'
 *
 *   fastify.get<{ Querystring: { limit?: number; cursor?: string } }>('/api/items', {
 *     schema: { querystring: paginationQuerySchema, ... }
 *   }, async (request) => {
 *     const limit = request.query.limit ?? 20
 *     const after = request.query.cursor ? decodeCursor(request.query.cursor) : null
 *     // e.g.: const rows = await db.query('SELECT * FROM items WHERE id > $1 ORDER BY id LIMIT $2', [after?.id ?? 0, limit + 1])
 *     const items = rows.slice(0, limit)
 *     const nextCursor = rows.length > limit ? encodeCursor({ id: items[items.length - 1].id }) : null
 *     return paginatedResponse(items, nextCursor)
 *   })
 */

export const paginationQuerySchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20
    },
    cursor: {
      type: 'string',
      description: 'Opaque cursor for the next page, returned by the previous response'
    }
  }
} as const

/**
 * Wraps a page of results in a standard pagination envelope.
 */
export function paginatedResponse<T>(items: T[], nextCursor: string | null) {
  return {
    data: items,
    pagination: {
      nextCursor,
      hasMore: nextCursor !== null
    }
  }
}

/**
 * Encodes a cursor value as a base64url JSON string, keeping internals opaque to clients.
 */
export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/**
 * Decodes a cursor produced by encodeCursor back to its original object.
 * Pass a `validate` callback to reject payloads with unexpected shapes (throws 400).
 */
export function decodeCursor(
  cursor: string,
  validate?: (raw: Record<string, unknown>) => boolean
): Record<string, unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (validate && !validate(parsed)) {
      const err = new Error('Invalid cursor: unexpected payload shape') as Error & { statusCode: number }
      err.statusCode = 400
      throw err
    }
    return parsed
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 400) throw e
    const err = new Error('Invalid cursor: malformed or corrupted pagination token') as Error & { statusCode: number }
    err.statusCode = 400
    throw err
  }
}
