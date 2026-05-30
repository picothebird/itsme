import { Router } from 'express'

import { asyncHandler } from '../../lib/asyncHandler.js'
import { surveyRepo } from '../../repositories/inMemory.js'

export const feedRouter = Router()

feedRouter.get(
  '/',
  asyncHandler((_req, res) => {
    const cards = surveyRepo.listByStatus('live').map((survey) => ({
      id: survey.id,
      title: survey.title,
      category: survey.category,
      questionCount: survey.questions.length,
      estimatedTimeSec: Math.max(20, survey.questions.length * 8),
      pointsPerUser: survey.deployment?.pointsPerUser ?? 0,
    }))
    res.json({ ok: true, data: cards })
  }),
)
