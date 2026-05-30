import { Router } from 'express'

import { asyncHandler } from '../../lib/asyncHandler.js'
import { parseOrThrow } from '../../lib/validate.js'
import { applyAuditFix, generateDraftSurvey, getAuditSession, runAudit } from './ai.service.js'
import { applyFixSchema, auditSurveySchema, generateDraftSchema } from './ai.schemas.js'

export const aiRouter = Router()

aiRouter.post(
  '/drafts',
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(generateDraftSchema, req.body, 'ai.draft')
    const result = await generateDraftSurvey(input)
    res.status(201).json({ ok: true, data: result })
  }),
)

aiRouter.post(
  '/audits',
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(auditSurveySchema, req.body, 'ai.audit')
    const result = await runAudit(input.surveyId)
    res.status(201).json({ ok: true, data: result })
  }),
)

aiRouter.get(
  '/audits/:id',
  asyncHandler((req, res) => {
    const session = getAuditSession(String(req.params.id))
    res.json({ ok: true, data: session })
  }),
)

aiRouter.post(
  '/audits/:id/apply',
  asyncHandler((req, res) => {
    const input = parseOrThrow(applyFixSchema, req.body, 'ai.apply')
    const result = applyAuditFix(String(req.params.id), input.findingId)
    res.json({ ok: true, data: result })
  }),
)
