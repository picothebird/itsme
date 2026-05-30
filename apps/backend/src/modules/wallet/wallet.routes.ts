import { Router } from 'express'
import { z } from 'zod'

import { findCatalogItem, REWARD_CATALOG } from '../../domain/rewardCatalog.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { badRequest, notFound } from '../../lib/errors.js'
import { parseOrThrow } from '../../lib/validate.js'
import { generateId, rewardOrderRepo, walletRepo } from '../../repositories/inMemory.js'
import { issueVoucher } from './wallet.vendor.js'
import type { RewardOrder } from '../../domain/types.js'

export const walletRouter = Router()

walletRouter.get(
  '/catalog',
  asyncHandler((_req, res) => {
    res.json({ ok: true, data: REWARD_CATALOG })
  }),
)

const balanceQuery = z.object({ pid: z.string().min(1) })

walletRouter.get(
  '/me',
  asyncHandler((req, res) => {
    const { pid } = parseOrThrow(balanceQuery, req.query, 'wallet.me')
    const wallet = walletRepo.get(pid)
    res.json({ ok: true, data: wallet })
  }),
)

walletRouter.get(
  '/me/orders',
  asyncHandler((req, res) => {
    const { pid } = parseOrThrow(balanceQuery, req.query, 'wallet.orders')
    const orders = rewardOrderRepo
      .listByPid(pid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json({ ok: true, data: orders })
  }),
)

const redeemSchema = z.object({
  pid: z.string().min(1),
  itemId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(64),
})

walletRouter.post(
  '/redeem',
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(redeemSchema, req.body, 'wallet.redeem')
    const item = findCatalogItem(input.itemId)
    if (!item) throw notFound('CatalogItem', input.itemId)

    // §3.7.6 — idempotent redeem: same key returns existing order verbatim
    const existing = rewardOrderRepo.findByIdempotencyKey(input.pid, input.idempotencyKey)
    if (existing) {
      res.json({ ok: true, data: { order: existing, idempotent: true } })
      return
    }

    const wallet = walletRepo.get(input.pid)
    if (wallet.balance < item.cost) {
      throw badRequest('Insufficient balance', { balance: wallet.balance, cost: item.cost })
    }

    const now = new Date().toISOString()
    let order: RewardOrder = {
      id: generateId('ord'),
      pid: input.pid,
      itemId: item.id,
      itemLabel: item.label,
      cost: item.cost,
      idempotencyKey: input.idempotencyKey,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    order = rewardOrderRepo.save(order)

    const spendTxn = walletRepo.debit(input.pid, item.cost, order.id)

    const result = await issueVoucher(item)
    if (result.ok) {
      order = rewardOrderRepo.save({
        ...order,
        status: 'issued',
        voucherCode: result.voucherCode,
        updatedAt: new Date().toISOString(),
      })
      res.status(201).json({ ok: true, data: { order, idempotent: false, debit: spendTxn } })
      return
    }

    // §7.5 — vendor failure → automatic refund
    walletRepo.credit(input.pid, item.cost, 'grant', order.id)
    order = rewardOrderRepo.save({
      ...order,
      status: result.retryable ? 'failed' : 'refunded',
      failureReason: result.reason,
      updatedAt: new Date().toISOString(),
    })
    res.status(502).json({
      ok: false,
      error: {
        code: 'VENDOR_FAILED',
        message: `Voucher issuance failed: ${result.reason}`,
        details: { order, refunded: true },
      },
    })
  }),
)
