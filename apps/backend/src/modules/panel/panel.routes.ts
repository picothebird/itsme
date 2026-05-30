import { Router } from 'express'
import { z } from 'zod'

import { feedDataPiece } from '../../domain/pet.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { badRequest, forbidden, notFound } from '../../lib/errors.js'
import { parseOrThrow } from '../../lib/validate.js'
import { dataPieceRepo, petRepo, walletRepo } from '../../repositories/inMemory.js'

export const panelRouter = Router()

const requirePid = (req: { query: { pid?: unknown } }): string => {
  const pid = String(req.query.pid ?? '')
  if (!pid) throw badRequest('pid query parameter is required')
  return pid
}

panelRouter.get(
  '/me',
  asyncHandler((req, res) => {
    const pid = requirePid(req)
    const wallet = walletRepo.get(pid)
    const pet = petRepo.get(pid)
    res.json({ ok: true, data: { pid, wallet, pet } })
  }),
)

panelRouter.get(
  '/me/data-pieces',
  asyncHandler((req, res) => {
    const pid = requirePid(req)
    const pieces = dataPieceRepo
      .listByPid(pid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json({
      ok: true,
      data: {
        pending: pieces.filter((p) => !p.consumedAt),
        consumed: pieces.filter((p) => Boolean(p.consumedAt)),
      },
    })
  }),
)

const feedSchema = z.object({
  pid: z.string().min(1),
  pieceId: z.string().min(1),
})

panelRouter.post(
  '/me/feed',
  asyncHandler((req, res) => {
    const input = parseOrThrow(feedSchema, req.body, 'feed')
    const piece = dataPieceRepo.get(input.pieceId)
    if (!piece) throw notFound('DataPiece', input.pieceId)
    if (piece.pid !== input.pid) throw forbidden('DataPiece does not belong to this panelist')
    if (piece.consumedAt) {
      throw badRequest('DataPiece already consumed', { consumedAt: piece.consumedAt })
    }

    const pet = petRepo.get(input.pid)
    const next = feedDataPiece(
      {
        exp: pet.exp,
        level: pet.level,
        tagVector: pet.tagVector,
        evolutionStage: pet.evolutionStage,
      },
      { bonusExp: piece.bonusExp, tag: piece.categoryTag },
    )
    petRepo.save({
      ...pet,
      exp: next.exp,
      level: next.level,
      tagVector: next.tagVector,
      evolutionStage: next.evolutionStage,
      sick: false,
    })
    dataPieceRepo.save({ ...piece, consumedAt: new Date().toISOString() })

    res.json({
      ok: true,
      data: {
        piece: { ...piece, consumedAt: new Date().toISOString() },
        pet: {
          exp: next.exp,
          level: next.level,
          evolutionStage: next.evolutionStage,
        },
        leveledUp: next.leveledUp,
        evolved: next.evolved,
      },
    })
  }),
)
