import { Router } from 'express'

import { asyncHandler } from '../../lib/asyncHandler.js'
import { parseOrThrow } from '../../lib/validate.js'
import {
  closeSurvey,
  createSurvey,
  getSurvey,
  listSurveys,
  publishSurvey,
  updateSurvey,
} from './survey.service.js'
import { createSurveySchema, publishSurveySchema, updateSurveySchema } from './survey.schemas.js'

export const surveyRouter = Router()

surveyRouter.get(
  '/',
  asyncHandler((_req, res) => {
    res.json({ ok: true, data: listSurveys() })
  }),
)

surveyRouter.post(
  '/',
  asyncHandler((req, res) => {
    const input = parseOrThrow(createSurveySchema, req.body, 'survey')
    const survey = createSurvey(input)
    res.status(201).json({ ok: true, data: survey })
  }),
)

surveyRouter.get(
  '/:id',
  asyncHandler((req, res) => {
    res.json({ ok: true, data: getSurvey(String(req.params.id)) })
  }),
)

surveyRouter.patch(
  '/:id',
  asyncHandler((req, res) => {
    const input = parseOrThrow(updateSurveySchema, req.body, 'survey')
    res.json({ ok: true, data: updateSurvey(String(req.params.id), input) })
  }),
)

surveyRouter.post(
  '/:id/publish',
  asyncHandler((req, res) => {
    const input = parseOrThrow(publishSurveySchema, req.body, 'deployment')
    res.status(202).json({ ok: true, data: publishSurvey(String(req.params.id), input) })
  }),
)

surveyRouter.post(
  '/:id/close',
  asyncHandler((req, res) => {
    res.json({ ok: true, data: closeSurvey(String(req.params.id)) })
  }),
)
