import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { app } from './app.js'
import { resetStore, walletRepo } from './repositories/inMemory.js'
import { resetRateLimiter } from './middleware/rateLimit.js'
import { resetRewardVendor, setRewardVendor } from './modules/wallet/wallet.vendor.js'

beforeEach(() => {
  resetStore()
  resetRateLimiter()
})

afterEach(() => {
  resetRewardVendor()
})

describe('GET /wallet/catalog', () => {
  it('returns the static catalog with 4 items', async () => {
    const res = await request(app).get('/wallet/catalog').expect(200)
    expect(res.body.data).toHaveLength(4)
    expect(res.body.data[0]).toMatchObject({ vendor: 'naverpay', cost: 1000 })
  })
})

describe('POST /wallet/redeem', () => {
  it('debits the wallet and issues a voucher with idempotency', async () => {
    walletRepo.credit('pid_w1', 10_000, 'grant')

    const first = await request(app)
      .post('/wallet/redeem')
      .send({ pid: 'pid_w1', itemId: 'reward_npay_1000', idempotencyKey: 'idem-1234abcd' })
      .expect(201)
    expect(first.body.data.order.status).toBe('issued')
    expect(first.body.data.order.voucherCode).toBeTruthy()
    expect(first.body.data.idempotent).toBe(false)

    const balance = walletRepo.get('pid_w1').balance
    expect(balance).toBe(9_000)

    // Replay same idempotency key → returns the SAME order, no extra debit
    const replay = await request(app)
      .post('/wallet/redeem')
      .send({ pid: 'pid_w1', itemId: 'reward_npay_1000', idempotencyKey: 'idem-1234abcd' })
      .expect(200)
    expect(replay.body.data.order.id).toBe(first.body.data.order.id)
    expect(replay.body.data.idempotent).toBe(true)
    expect(walletRepo.get('pid_w1').balance).toBe(9_000)
  })

  it('refuses redemption when balance is insufficient', async () => {
    walletRepo.credit('pid_w2', 500, 'grant')
    const res = await request(app)
      .post('/wallet/redeem')
      .send({ pid: 'pid_w2', itemId: 'reward_npay_1000', idempotencyKey: 'idem-poor-2222' })
      .expect(400)
    expect(res.body.error.message).toMatch(/insufficient/i)
    expect(walletRepo.get('pid_w2').balance).toBe(500)
  })

  it('refunds the wallet and marks the order failed when vendor errors', async () => {
    walletRepo.credit('pid_w3', 10_000, 'grant')
    setRewardVendor(async () => ({ ok: false, reason: 'vendor 500', retryable: true }))
    const res = await request(app)
      .post('/wallet/redeem')
      .send({ pid: 'pid_w3', itemId: 'reward_npay_1000', idempotencyKey: 'idem-fail-3333' })
      .expect(502)
    expect(res.body.error.code).toBe('VENDOR_FAILED')
    expect(res.body.error.details.refunded).toBe(true)
    expect(res.body.error.details.order.status).toBe('failed')
    expect(walletRepo.get('pid_w3').balance).toBe(10_000)
  })
})

describe('GET /wallet/me/orders', () => {
  it('returns the panelist orders in reverse-chronological order', async () => {
    walletRepo.credit('pid_w4', 20_000, 'grant')
    await request(app)
      .post('/wallet/redeem')
      .send({ pid: 'pid_w4', itemId: 'reward_npay_1000', idempotencyKey: 'idem-a-1111111' })
      .expect(201)
    await request(app)
      .post('/wallet/redeem')
      .send({ pid: 'pid_w4', itemId: 'reward_npay_5000', idempotencyKey: 'idem-b-2222222' })
      .expect(201)

    const res = await request(app).get('/wallet/me/orders?pid=pid_w4').expect(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].itemId).toBe('reward_npay_5000')
  })
})
