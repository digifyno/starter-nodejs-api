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
 *     const after = request.query.cursor ? decodeCursor(request.query.cursor, config.CURSOR_SECRET) : null
 *     // e.g.: const rows = await db.query('SELECT * FROM items WHERE id > $1 ORDER BY id LIMIT $2', [after?.id ?? 0, limit + 1])
 *     const items = rows.slice(0, limit)
 *     const nextCursor = rows.length > limit ? encodeCursor({ id: items[items.length - 1].id }, config.CURSOR_SECRET) : null
 *     return paginatedResponse(items, nextCursor)
 *   })
 */

import { createHmac, timingSafeEqual } from 'crypto'

function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = statusCode
  return err
}

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
 * Encodes a cursor value as a signed base64url token (payload.signature) to prevent tampering.
 */
export function encodeCursor(value: Record<string, unknown>, secret: string): string {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/**
 * Decodes and verifies a cursor produced by encodeCursor. Throws 400 on invalid or tampered cursors.
 * Pass a `validate` callback to reject payloads with unexpected shapes (throws 400).
 */
export function decodeCursor(
  cursor: string,
  secret: string,
  validate?: (raw: Record<string, unknown>) => boolean
): Record<string, unknown> {
  const dotIndex = cursor.lastIndexOf('.')
  if (dotIndex === -1) {
    throw httpError(400, 'Invalid cursor: missing signature')
  }
  const payload = cursor.slice(0, dotIndex)
  const sig = cursor.slice(dotIndex + 1)
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw httpError(400, 'Invalid cursor: signature mismatch')
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (validate && !validate(parsed)) {
      throw httpError(400, 'Invalid cursor: unexpected payload shape')
    }
    return parsed
  } catch (e) {
    if (e instanceof Error && (e as Error & { statusCode?: number }).statusCode === 400) throw e
    throw httpError(400, 'Invalid cursor: malformed or corrupted pagination token')
  }
}
