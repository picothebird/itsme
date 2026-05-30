import { Router } from 'express'
import { z } from 'zod'

import { asyncHandler } from '../../lib/asyncHandler.js'
import { rateLimit } from '../../middleware/rateLimit.js'
import { parseOrThrow } from '../../lib/validate.js'
import {
  completeResponse,
  getActiveResponse,
  startResponse,
  submitAnswer,
} from './response.service.js'
import {
  completeResponseSchema,
  startResponseSchema,
  submitAnswerSchema,
} from './response.schemas.js'

export const responseRouter = Router()

// 60 requests / minute / pid burst-tolerant
const answerLimiter = rateLimit({
  capacity: 30,
  refillPerSec: 1,
  keyFn: (req) => `answer:${(req.body && (req.body as { pid?: string }).pid) ?? req.ip ?? 'anon'}`,
})

const startLimiter = rateLimit({
  capacity: 10,
  refillPerSec: 0.2,
  keyFn: (req) => `start:${(req.body && (req.body as { pid?: string }).pid) ?? req.ip ?? 'anon'}`,
})

responseRouter.post(
  '/start',
  startLimiter,
  asyncHandler((req, res) => {
    const input = parseOrThrow(startResponseSchema, req.body, 'response')
    const created = startResponse(input)
    res.status(201).json({ ok: true, data: created })
  }),
)

responseRouter.post(
  '/:id/answer',
  answerLimiter,
  asyncHandler((req, res) => {
    const input = parseOrThrow(submitAnswerSchema, req.body, 'answer')
    const result = submitAnswer(String(req.params.id), input)
    res.json({ ok: true, data: result })
  }),
)

responseRouter.post(
  '/:id/complete',
  asyncHandler((req, res) => {
    parseOrThrow(completeResponseSchema, req.body ?? {}, 'completion')
    const result = completeResponse(String(req.params.id))
    res.json({ ok: true, data: result })
  }),
)

const activeQuerySchema = z.object({
  pid: z.string().min(1),
  surveyId: z.string().min(1),
})

responseRouter.get(
  '/active',
  asyncHandler((req, res) => {
    const query = parseOrThrow(activeQuerySchema, req.query, 'active')
    const active = getActiveResponse(query.pid, query.surveyId)
    res.json({ ok: true, data: active })
  }),
)
