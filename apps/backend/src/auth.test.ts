import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { app } from './app.js'
import { resetStore, walletRepo } from './repositories/inMemory.js'
import { resetRateLimiter } from './middleware/rateLimit.js'

beforeEach(() => {
  resetStore()
  resetRateLimiter()
})

const login = async (providerUserId: string, provider = 'kakao') => {
  const res = await request(app)
    .post('/auth/login')
    .send({ provider, providerUserId, displayName: '데모유저' })
  return res
}

describe('POST /auth/login', () => {
  it('creates a new account on first login and returns onboarding as next step', async () => {
    const res = await login('kakao_user_1')
    expect(res.status).toBe(201)
    expect(res.body.data.isNew).toBe(true)
    expect(res.body.data.nextStep).toBe('onboarding')
    expect(res.body.data.token).toMatch(/^sess_/)
    expect(res.body.data.account.onboarded).toBe(false)
    expect(res.body.data.account.pid).toMatch(/^pid_/)
  })

  it('returns the same account (idempotent identity) on repeat login', async () => {
    const first = await login('kakao_user_2')
    const second = await login('kakao_user_2')
    expect(second.status).toBe(200)
    expect(second.body.data.isNew).toBe(false)
    expect(second.body.data.account.pid).toBe(first.body.data.account.pid)
    // A fresh session token is minted each login
    expect(second.body.data.token).not.toBe(first.body.data.token)
  })

  it('keeps providers isolated — same id under different providers are distinct users', async () => {
    const kakao = await login('shared_id', 'kakao')
    const google = await login('shared_id', 'google')
    expect(kakao.body.data.account.pid).not.toBe(google.body.data.account.pid)
  })

  it('rejects an unknown provider', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ provider: 'naver', providerUserId: 'x' })
    expect(res.status).toBe(400)
  })
})

describe('auth guard', () => {
  it('rejects /auth/me without a bearer token', async () => {
    const res = await request(app).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('rejects an invalid bearer token', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer sess_bogus')
    expect(res.status).toBe(401)
  })
})

describe('POST /auth/onboarding', () => {
  it('hatches the egg: seeds pet tag vector from interests and grants a welcome bonus', async () => {
    const loginRes = await login('kakao_onboard')
    const token = loginRes.body.data.token
    const pid = loginRes.body.data.account.pid

    const res = await request(app)
      .post('/auth/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ birthYear: 1996, gender: 'female', interests: ['뷰티', 'IT'] })

    expect(res.status).toBe(200)
    expect(res.body.data.account.onboarded).toBe(true)
    expect(res.body.data.account.interests).toEqual(['뷰티', 'IT'])
    expect(res.body.data.welcomeBonus).toBe(500)
    // Interests seeded into the pet's tag vector for day-one personalization
    expect(res.body.data.pet.tagVector).toMatchObject({ 뷰티: 1, IT: 1 })
    expect(walletRepo.get(pid).balance).toBe(500)
  })

  it('does not double-grant the welcome bonus on repeat onboarding', async () => {
    const loginRes = await login('kakao_twice')
    const token = loginRes.body.data.token
    const pid = loginRes.body.data.account.pid

    await request(app)
      .post('/auth/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ birthYear: 1990, gender: 'male', interests: ['운동'] })

    const second = await request(app)
      .post('/auth/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ birthYear: 1990, gender: 'male', interests: ['운동', '여행'] })

    expect(second.body.data.welcomeBonus).toBe(0)
    expect(walletRepo.get(pid).balance).toBe(500)
  })

  it('rejects an under-age birth year', async () => {
    const loginRes = await login('kakao_minor')
    const token = loginRes.body.data.token
    const res = await request(app)
      .post('/auth/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ birthYear: new Date().getFullYear(), gender: 'unspecified', interests: ['IT'] })
    expect(res.status).toBe(400)
  })

  it('requires at least one interest', async () => {
    const loginRes = await login('kakao_nointerest')
    const token = loginRes.body.data.token
    const res = await request(app)
      .post('/auth/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ birthYear: 1995, gender: 'male', interests: [] })
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/logout', () => {
  it('invalidates the session token', async () => {
    const loginRes = await login('kakao_logout')
    const token = loginRes.body.data.token

    await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200)
    await request(app).post('/auth/logout').set('Authorization', `Bearer ${token}`).expect(200)
    await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(401)
  })
})

describe('GET /auth/me', () => {
  it('returns the account, wallet and pet for an authenticated session', async () => {
    const loginRes = await login('kakao_me')
    const token = loginRes.body.data.token
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.account.pid).toBe(loginRes.body.data.account.pid)
    expect(res.body.data.wallet).toHaveProperty('balance')
    expect(res.body.data.pet).toHaveProperty('level')
  })
})
