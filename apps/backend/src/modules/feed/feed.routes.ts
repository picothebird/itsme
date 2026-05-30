import { Router } from 'express'
import { z } from 'zod'

import { buildFeed, paginate } from '../../domain/feed.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { parseOrThrow } from '../../lib/validate.js'
import { petRepo, responseRepo, surveyRepo } from '../../repositories/inMemory.js'

export const feedRouter = Router()

const feedQuerySchema = z.object({
  pid: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

feedRouter.get(
  '/',
  asyncHandler((req, res) => {
    const query = parseOrThrow(feedQuerySchema, req.query, 'feed')
    const surveys = surveyRepo.list()
    const responses = responseRepo.list()
    const panelist = query.pid
      ? {
          pid: query.pid,
          interests: Object.keys(petRepo.get(query.pid).tagVector ?? {}),
        }
      : null
    const ranked = buildFeed(surveys, responses, panelist)
    const page = paginate(ranked, query.cursor, query.limit)
    res.json({ ok: true, data: { items: page.items, nextCursor: page.nextCursor } })
  }),
)
