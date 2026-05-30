import { Router } from 'express'

import { buildDashboardSummary, buildSurveyAnalytics, toCsv } from '../../domain/analytics.js'
import { estimateReach } from '../../domain/targeting.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { notFound } from '../../lib/errors.js'
import { parseOrThrow } from '../../lib/validate.js'
import { responseRepo, surveyRepo } from '../../repositories/inMemory.js'
import { estimateReachSchema } from './analytics.schemas.js'

export const analyticsRouter = Router()

analyticsRouter.get(
  '/dashboard/summary',
  asyncHandler((_req, res) => {
    const surveys = surveyRepo.list()
    const responses = responseRepo.list()
    res.json({ ok: true, data: buildDashboardSummary(surveys, responses) })
  }),
)

analyticsRouter.get(
  '/surveys/:id',
  asyncHandler((req, res) => {
    const survey = surveyRepo.get(String(req.params.id))
    if (!survey) throw notFound('Survey', String(req.params.id))
    const responses = responseRepo.listBySurvey(survey.id)
    res.json({ ok: true, data: buildSurveyAnalytics(survey, responses) })
  }),
)

analyticsRouter.get(
  '/surveys/:id/export.csv',
  asyncHandler((req, res) => {
    const survey = surveyRepo.get(String(req.params.id))
    if (!survey) throw notFound('Survey', String(req.params.id))
    const responses = responseRepo.listBySurvey(survey.id)
    const csv = toCsv(survey, responses)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="survey-${survey.id}-responses.csv"`)
    res.status(200).send(csv)
  }),
)

analyticsRouter.post(
  '/estimate-reach',
  asyncHandler((req, res) => {
    const input = parseOrThrow(estimateReachSchema, req.body, 'estimateReach')
    res.json({ ok: true, data: estimateReach(input.targeting) })
  }),
)
