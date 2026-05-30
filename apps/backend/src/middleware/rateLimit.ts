import type { NextFunction, Request, Response } from 'express'

import { tooManyRequests } from '../lib/errors.js'

type Bucket = { tokens: number; updatedAt: number }

type Options = {
  capacity: number
  refillPerSec: number
  keyFn?: (req: Request) => string
}

const buckets = new Map<string, Bucket>()

export const resetRateLimiter = (): void => {
  buckets.clear()
}

export const rateLimit = ({ capacity, refillPerSec, keyFn }: Options) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = keyFn ? keyFn(req) : (req.ip ?? 'anon')
    const now = Date.now()
    const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now }
    const elapsedSec = (now - bucket.updatedAt) / 1000
    const refilled = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec)

    if (refilled < 1) {
      const waitMs = Math.ceil(((1 - refilled) / refillPerSec) * 1000)
      next(tooManyRequests('Rate limit exceeded', { retryAfterMs: waitMs }))
      return
    }

    buckets.set(key, { tokens: refilled - 1, updatedAt: now })
    next()
  }
}
