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
