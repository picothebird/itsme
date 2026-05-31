import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { app } from './app.js'
import { resetStore } from './repositories/inMemory.js'
import { resetRateLimiter } from './middleware/rateLimit.js'

beforeEach(() => {
  resetStore()
  resetRateLimiter()
})

const OPEN_STUDY = 'study_ut_shopping'

describe('managed research — studies & applications', () => {
  it('GET /research/studies returns seeded open studies', async () => {
    const res = await request(app).get('/research/studies').expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(3)
    expect(res.body.data.every((s: { status: string }) => s.status === 'open')).toBe(true)
  })

  it('GET /research/studies/:id returns a study with screener', async () => {
    const res = await request(app).get(`/research/studies/${OPEN_STUDY}`).expect(200)
    expect(res.body.data.id).toBe(OPEN_STUDY)
    expect(Array.isArray(res.body.data.screener)).toBe(true)
  })

  it('returns 404 for an unknown study', async () => {
    await request(app).get('/research/studies/nope').expect(404)
  })

  it('POST /research/applications creates an applied application', async () => {
    const res = await request(app)
      .post('/research/applications')
      .send({
        pid: 'pid_app_1',
        studyId: OPEN_STUDY,
        screenerAnswers: [{ questionId: 'q1', answer: '네' }],
      })
      .expect(201)
    expect(res.body.data.status).toBe('applied')
    expect(res.body.data.history).toHaveLength(1)
    expect(res.body.data.history[0].status).toBe('applied')
  })

  it('rejects duplicate applications to the same study', async () => {
    await request(app)
      .post('/research/applications')
      .send({ pid: 'pid_dup', studyId: OPEN_STUDY })
      .expect(201)
    await request(app)
      .post('/research/applications')
      .send({ pid: 'pid_dup', studyId: OPEN_STUDY })
      .expect(409)
  })

  it('rejects applications to an unknown study', async () => {
    await request(app)
      .post('/research/applications')
      .send({ pid: 'pid_x', studyId: 'study_missing' })
      .expect(404)
  })

  it('GET /research/applications/me returns enriched applications', async () => {
    await request(app)
      .post('/research/applications')
      .send({ pid: 'pid_me', studyId: OPEN_STUDY })
      .expect(201)
    const res = await request(app).get('/research/applications/me?pid=pid_me').expect(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].study.id).toBe(OPEN_STUDY)
  })
})

describe('managed research — lifecycle state machine', () => {
  const apply = async (pid: string) => {
    const res = await request(app)
      .post('/research/applications')
      .send({ pid, studyId: OPEN_STUDY })
      .expect(201)
    return res.body.data.id as string
  }

  const transition = (id: string, to: string, body: Record<string, unknown> = {}) =>
    request(app)
      .post(`/research/applications/${id}/transition`)
      .send({ to, ...body })

  it('walks the happy path applied → ... → paid', async () => {
    const id = await apply('pid_happy')
    await transition(id, 'screening').expect(200)
    await transition(id, 'review').expect(200)
    await transition(id, 'selected').expect(200)
    const scheduled = await transition(id, 'scheduled', {
      scheduledAt: '2026-06-10T10:00:00.000Z',
    }).expect(200)
    expect(scheduled.body.data.scheduledAt).toBe('2026-06-10T10:00:00.000Z')
    await transition(id, 'in_session').expect(200)
    await transition(id, 'completed').expect(200)
    const paid = await transition(id, 'paid').expect(200)
    expect(paid.body.data.status).toBe('paid')
    expect(paid.body.data.history.at(-1).status).toBe('paid')
  })

  it('allows rejection from review', async () => {
    const id = await apply('pid_reject')
    await transition(id, 'screening').expect(200)
    await transition(id, 'review').expect(200)
    const rejected = await transition(id, 'rejected', { note: '대상 조건 불일치' }).expect(200)
    expect(rejected.body.data.status).toBe('rejected')
    expect(rejected.body.data.history.at(-1).note).toBe('대상 조건 불일치')
  })

  it('rejects an invalid transition (applied → paid)', async () => {
    const id = await apply('pid_invalid')
    await transition(id, 'paid').expect(409)
  })

  it('rejects transitions out of a terminal state', async () => {
    const id = await apply('pid_terminal')
    await transition(id, 'rejected').expect(200)
    await transition(id, 'screening').expect(409)
  })

  it('researcher can list applicants for a study', async () => {
    await apply('pid_list_a')
    await apply('pid_list_b')
    const res = await request(app).get(`/research/studies/${OPEN_STUDY}/applications`).expect(200)
    expect(res.body.data).toHaveLength(2)
  })
})
