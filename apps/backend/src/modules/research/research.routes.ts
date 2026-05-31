import { Router } from 'express'
import { z } from 'zod'

import { canTransition } from '../../domain/application.js'
import type { Application, ApplicationStatus } from '../../domain/types.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { parseOrThrow } from '../../lib/validate.js'
import { applicationRepo, generateId, managedStudyRepo } from '../../repositories/inMemory.js'

export const researchRouter = Router()

const pidQuery = z.object({ pid: z.string().min(1) })

// Public: list open managed studies for panelists
researchRouter.get(
  '/studies',
  asyncHandler((_req, res) => {
    res.json({ ok: true, data: managedStudyRepo.listOpen() })
  }),
)

researchRouter.get(
  '/studies/:id',
  asyncHandler((req, res) => {
    const study = managedStudyRepo.get(String(req.params.id))
    if (!study) throw notFound('ManagedStudy', String(req.params.id))
    res.json({ ok: true, data: study })
  }),
)

const applySchema = z.object({
  pid: z.string().min(1),
  studyId: z.string().min(1),
  screenerAnswers: z
    .array(z.object({ questionId: z.string().min(1), answer: z.string().max(2000) }))
    .default([]),
})

// Panelist applies to a managed study
researchRouter.post(
  '/applications',
  asyncHandler((req, res) => {
    const input = parseOrThrow(applySchema, req.body, 'application')
    const study = managedStudyRepo.get(input.studyId)
    if (!study) throw notFound('ManagedStudy', input.studyId)
    if (study.status !== 'open') throw badRequest('Study is not accepting applications')

    const existing = applicationRepo.findByPidAndStudy(input.pid, input.studyId)
    if (existing) throw conflict('Already applied to this study')

    const now = new Date().toISOString()
    const application: Application = {
      id: generateId('app'),
      pid: input.pid,
      studyId: input.studyId,
      status: 'applied',
      screenerAnswers: input.screenerAnswers,
      history: [{ status: 'applied', at: now }],
      createdAt: now,
      updatedAt: now,
    }
    applicationRepo.save(application)
    res.status(201).json({ ok: true, data: application })
  }),
)

// Panelist views own applications, enriched with study summary
researchRouter.get(
  '/applications/me',
  asyncHandler((req, res) => {
    const { pid } = parseOrThrow(pidQuery, req.query, 'application.me')
    const items = applicationRepo
      .listByPid(pid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((application) => ({
        ...application,
        study: managedStudyRepo.get(application.studyId) ?? null,
      }))
    res.json({ ok: true, data: items })
  }),
)

// Researcher: list applicants for a study
researchRouter.get(
  '/studies/:id/applications',
  asyncHandler((req, res) => {
    const study = managedStudyRepo.get(String(req.params.id))
    if (!study) throw notFound('ManagedStudy', String(req.params.id))
    const items = applicationRepo
      .listByStudy(study.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    res.json({ ok: true, data: items })
  }),
)

const APPLICATION_STATUSES: ApplicationStatus[] = [
  'applied',
  'screening',
  'review',
  'selected',
  'rejected',
  'scheduled',
  'in_session',
  'completed',
  'paid',
]

const transitionSchema = z.object({
  to: z.enum(APPLICATION_STATUSES as [ApplicationStatus, ...ApplicationStatus[]]),
  note: z.string().max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
})

// Researcher: advance an application through the lifecycle state machine
researchRouter.post(
  '/applications/:id/transition',
  asyncHandler((req, res) => {
    const application = applicationRepo.get(String(req.params.id))
    if (!application) throw notFound('Application', String(req.params.id))
    const input = parseOrThrow(transitionSchema, req.body, 'application.transition')

    if (!canTransition(application.status, input.to)) {
      throw conflict(`Invalid transition: ${application.status} → ${input.to}`)
    }

    const now = new Date().toISOString()
    const next: Application = {
      ...application,
      status: input.to,
      scheduledAt: input.to === 'scheduled' ? (input.scheduledAt ?? now) : application.scheduledAt,
      history: [...application.history, { status: input.to, note: input.note, at: now }],
      updatedAt: now,
    }
    applicationRepo.save(next)
    res.json({ ok: true, data: next })
  }),
)
