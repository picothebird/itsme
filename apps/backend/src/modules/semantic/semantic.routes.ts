import { Router } from 'express'
import { z } from 'zod'

import { asyncHandler } from '../../lib/asyncHandler.js'
import { notFound } from '../../lib/errors.js'
import { parseOrThrow } from '../../lib/validate.js'
import { surveyRepo } from '../../repositories/inMemory.js'
import { findDuplicateQuestions, searchSurveys, similarSurveys } from './semantic.service.js'

export const semanticRouter = Router()

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

semanticRouter.get(
  '/search',
  asyncHandler((req, res) => {
    const { q, limit } = parseOrThrow(searchQuerySchema, req.query, 'semantic.search')
    res.json({ ok: true, data: { query: q, results: searchSurveys(q, limit) } })
  }),
)

const similarQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

semanticRouter.get(
  '/surveys/:id/similar',
  asyncHandler((req, res) => {
    const id = String(req.params.id)
    const survey = surveyRepo.get(id)
    if (!survey) throw notFound('Survey not found')
    const { limit } = parseOrThrow(similarQuerySchema, req.query, 'semantic.similar')
    res.json({
      ok: true,
      data: { surveyId: survey.id, neighbors: similarSurveys(survey.id, limit) },
    })
  }),
)

semanticRouter.get(
  '/surveys/:id/duplicates',
  asyncHandler((req, res) => {
    const id = String(req.params.id)
    const survey = surveyRepo.get(id)
    if (!survey) throw notFound('Survey not found')
    res.json({
      ok: true,
      data: { surveyId: survey.id, duplicates: findDuplicateQuestions(survey) },
    })
  }),
)
