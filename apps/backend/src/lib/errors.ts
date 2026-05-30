export class AppError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export const notFound = (resource: string, id?: string) =>
  new AppError(404, 'NOT_FOUND', `${resource}${id ? ` (${id})` : ''} not found`)

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details)

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message)

export const forbidden = (message: string) => new AppError(403, 'FORBIDDEN', message)

export const tooManyRequests = (message: string, details?: unknown) =>
  new AppError(429, 'TOO_MANY_REQUESTS', message, details)
