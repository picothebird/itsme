import type { ErrorRequestHandler } from 'express'

import { AppError } from '../lib/errors.js'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    })
    return
  }

  const message = err instanceof Error ? err.message : 'Internal server error'
  res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  })
}
