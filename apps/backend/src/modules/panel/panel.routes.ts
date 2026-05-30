import { Router } from 'express'

import { asyncHandler } from '../../lib/asyncHandler.js'
import { petRepo, walletRepo } from '../../repositories/inMemory.js'

export const panelRouter = Router()

panelRouter.get(
  '/me',
  asyncHandler((req, res) => {
    const pid = String(req.query.pid ?? '')
    if (!pid) {
      res.status(400).json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'pid query parameter is required' },
      })
      return
    }
    const wallet = walletRepo.get(pid)
    const pet = petRepo.get(pid)
    res.json({ ok: true, data: { pid, wallet, pet } })
  }),
)
