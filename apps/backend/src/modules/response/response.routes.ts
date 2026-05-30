import { Router } from 'express'

import { asyncHandler } from '../../lib/asyncHandler.js'
import { parseOrThrow } from '../../lib/validate.js'
import { completeResponse, startResponse, submitAnswer } from './response.service.js'
import {
  completeResponseSchema,
  startResponseSchema,
  submitAnswerSchema,
} from './response.schemas.js'

export const responseRouter = Router()

responseRouter.post(
  '/start',
  asyncHandler((req, res) => {
    const input = parseOrThrow(startResponseSchema, req.body, 'response')
    const created = startResponse(input)
    res.status(201).json({ ok: true, data: created })
  }),
)

responseRouter.post(
  '/:id/answer',
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
