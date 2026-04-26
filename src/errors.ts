import type { FastifyInstance, FastifyError } from 'fastify'

export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
}

export function createProblemDetail(
  statusCode: number,
  title: string,
  detail: string,
  instance?: string
): ProblemDetail {
  return {
    type: 'about:blank',
    title,
    status: statusCode,
    detail,
    ...(instance !== undefined ? { instance } : {})
  }
}

const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
}

const STATUS_DETAILS: Partial<Record<number, string>> = {
  404: 'The requested resource was not found.',
  413: 'Request body exceeds the 1MB size limit.',
  429: 'Rate limit exceeded. Please try again later.',
}

export function registerErrorHandlers(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500
    const safeCode = statusCode >= 400 ? statusCode : 500
    const title = STATUS_TITLES[safeCode] ?? 'Internal Server Error'
    const detail = STATUS_DETAILS[safeCode] ?? (safeCode < 500 ? error.message : 'An unexpected error occurred.')

    if (safeCode >= 500) {
      request.log.error(error, 'Unhandled error')
    }

    reply
      .header('Content-Type', 'application/problem+json')
      .code(safeCode)
      .send(createProblemDetail(safeCode, title, detail, request.url))
  })

  fastify.setNotFoundHandler((request, reply) => {
    reply
      .header('Content-Type', 'application/problem+json')
      .code(404)
      .send(createProblemDetail(404, 'Not Found', 'The requested resource was not found.', request.url))
  })
}
