import { Router } from 'express'

import { asyncHandler } from '../../lib/asyncHandler.js'
import { resetStore } from '../../repositories/inMemory.js'
import { resetAiSessions } from '../ai/ai.service.js'
import { __testing as responseTesting } from '../response/response.service.js'

export const devRouter = Router()

devRouter.post(
  '/reset',
  asyncHandler((_req, res) => {
    resetStore()
    responseTesting.clearPenalties()
    resetAiSessions()
    res.json({ ok: true, data: { cleared: true } })
  }),
)
