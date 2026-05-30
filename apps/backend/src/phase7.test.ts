import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { app } from './app.js'
import { resetStore } from './repositories/inMemory.js'
import { resetRateLimiter } from './middleware/rateLimit.js'

beforeEach(() => {
  resetStore()
  resetRateLimiter()
})

const createLiveSurvey = async () => {
  const survey = await request(app)
    .post('/surveys')
    .send({
      title: '커피 만족도',
      category: 'food',
      difficulty: 1,
      questions: [
        {
          type: 'single',
          text: '얼마나 자주 마시나요?',
          choices: [{ label: '매일' }, { label: '가끔' }],
        },
        { type: 'single', text: '주로 어디서?', choices: [{ label: '카페' }, { label: '집' }] },
      ],
    })
    .expect(201)
  await request(app)
    .post(`/surveys/${survey.body.data.id}/publish`)
    .send({ pointsPerUser: 300, targetCount: 100, estimatedReach: 500 })
    .expect(202)
  return survey.body.data as {
    id: string
    questions: Array<{ id: string; choices: Array<{ id: string }> }>
  }
}

const completeOnce = async (
  pid: string,
  surveyId: string,
  questions: Array<{ id: string; choices: Array<{ id: string }> }>,
) => {
  const start = await request(app).post('/responses/start').send({ pid, surveyId }).expect(201)
  const responseId = start.body.data.id as string
  for (const q of questions) {
    await request(app)
      .post(`/responses/${responseId}/answer`)
      .send({ pid, questionId: q.id, selectedChoiceIds: [q.choices[0].id], latencyMs: 1500 })
      .expect(200)
  }
  const done = await request(app).post(`/responses/${responseId}/complete`).send({}).expect(200)
  return { responseId, done: done.body.data }
}

describe('Phase 7.1 — resume in-progress response', () => {
  it('returns the existing response when start is called twice for the same (pid, surveyId)', async () => {
    const survey = await createLiveSurvey()
    const first = await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_resume', surveyId: survey.id })
      .expect(201)
    const second = await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_resume', surveyId: survey.id })
      .expect(201)
    expect(second.body.data.id).toBe(first.body.data.id)
  })

  it('GET /responses/active returns active response with nextQuestionIndex', async () => {
    const survey = await createLiveSurvey()
    const empty = await request(app)
      .get(`/responses/active?pid=pid_resume&surveyId=${survey.id}`)
      .expect(200)
    expect(empty.body.data).toBeNull()

    const start = await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_resume', surveyId: survey.id })
      .expect(201)
    const responseId = start.body.data.id as string
    await request(app)
      .post(`/responses/${responseId}/answer`)
      .send({
        pid: 'pid_resume',
        questionId: survey.questions[0].id,
        selectedChoiceIds: [survey.questions[0].choices[0].id],
        latencyMs: 1200,
      })
      .expect(200)

    const active = await request(app)
      .get(`/responses/active?pid=pid_resume&surveyId=${survey.id}`)
      .expect(200)
    expect(active.body.data.response.id).toBe(responseId)
    expect(active.body.data.nextQuestionIndex).toBe(1)
  })
})

describe('Phase 5.2.7 — DataPiece creation + feed-pet flow', () => {
  it('creates exactly one DataPiece per completed response and feeds it to the pet', async () => {
    const survey = await createLiveSurvey()
    const { done } = await completeOnce('pid_pet_a', survey.id, survey.questions)
    expect(done.dataPiece).not.toBeNull()
    expect(done.dataPiece.consumedAt).toBeUndefined()

    const list = await request(app).get('/panel/me/data-pieces?pid=pid_pet_a').expect(200)
    expect(list.body.data.pending).toHaveLength(1)
    expect(list.body.data.consumed).toHaveLength(0)

    const petBefore = await request(app).get('/panel/me?pid=pid_pet_a').expect(200)
    const expBefore = petBefore.body.data.pet.exp as number

    const feed = await request(app)
      .post('/panel/me/feed')
      .send({ pid: 'pid_pet_a', pieceId: done.dataPiece.id })
      .expect(200)
    expect(feed.body.data.pet.exp).toBeGreaterThan(expBefore)
    expect(feed.body.data.piece.consumedAt).toBeTruthy()

    const replay = await request(app)
      .post('/panel/me/feed')
      .send({ pid: 'pid_pet_a', pieceId: done.dataPiece.id })
      .expect(400)
    expect(replay.body.error.message).toMatch(/already consumed/i)

    const after = await request(app).get('/panel/me/data-pieces?pid=pid_pet_a').expect(200)
    expect(after.body.data.pending).toHaveLength(0)
    expect(after.body.data.consumed).toHaveLength(1)
  })

  it('does not duplicate DataPieces when complete is called twice (idempotent)', async () => {
    const survey = await createLiveSurvey()
    const { responseId } = await completeOnce('pid_pet_b', survey.id, survey.questions)
    const second = await request(app).post(`/responses/${responseId}/complete`).send({}).expect(200)
    expect(second.body.data.dataPiece).toBeNull()
    const list = await request(app).get('/panel/me/data-pieces?pid=pid_pet_b').expect(200)
    expect(list.body.data.pending).toHaveLength(1)
  })

  it('rejects feeding a piece owned by another panelist', async () => {
    const survey = await createLiveSurvey()
    const { done } = await completeOnce('pid_pet_owner', survey.id, survey.questions)
    const denied = await request(app)
      .post('/panel/me/feed')
      .send({ pid: 'pid_intruder', pieceId: done.dataPiece.id })
      .expect(403)
    expect(denied.body.error.code).toBe('FORBIDDEN')
  })
})
