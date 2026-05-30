import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { app } from './app.js'
import { heuristicProvider, setAiProvider } from './modules/ai/ai.provider.js'
import { resetStore } from './repositories/inMemory.js'
import { resetRateLimiter } from './middleware/rateLimit.js'

beforeEach(() => {
  resetStore()
  resetRateLimiter()
})
afterEach(() => {
  setAiProvider(heuristicProvider)
})

const createLiveSurvey = async (overrides?: { category?: string }) => {
  const survey = await request(app)
    .post('/surveys')
    .send({
      title: '테스트',
      category: overrides?.category ?? 'food',
      difficulty: 1,
      questions: [
        {
          type: 'single',
          text: '얼마나 자주 마시나요?',
          choices: [{ label: '매일' }, { label: '가끔' }],
        },
      ],
    })
    .expect(201)
  await request(app)
    .post(`/surveys/${survey.body.data.id}/publish`)
    .send({ pointsPerUser: 200, targetCount: 100, estimatedReach: 500 })
    .expect(202)
  return survey.body.data.id as string
}

describe('Phase 5.4 — feed priority + cursor', () => {
  it('returns sorted items with nextCursor pagination', async () => {
    await createLiveSurvey({ category: 'food' })
    await createLiveSurvey({ category: 'beauty' })
    await createLiveSurvey({ category: 'tech' })

    const page1 = await request(app).get('/feed?limit=2').expect(200)
    expect(page1.body.data.items).toHaveLength(2)
    expect(page1.body.data.nextCursor).not.toBeNull()
    const cursor = page1.body.data.nextCursor as string

    const page2 = await request(app).get(`/feed?limit=2&cursor=${cursor}`).expect(200)
    expect(page2.body.data.items).toHaveLength(1)
    expect(page2.body.data.nextCursor).toBeNull()
  })

  it('demotes surveys the panelist already completed', async () => {
    const surveyId = await createLiveSurvey()
    const start = await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_completed', surveyId })
      .expect(201)
    const responseId = start.body.data.id
    // answer the single question
    const survey = await request(app).get(`/surveys/${surveyId}`).expect(200)
    const q = survey.body.data.questions[0]
    await request(app)
      .post(`/responses/${responseId}/answer`)
      .send({
        pid: 'pid_completed',
        questionId: q.id,
        selectedChoiceIds: [q.choices[0].id],
        latencyMs: 1500,
      })
      .expect(200)
    await request(app)
      .post(`/responses/${responseId}/complete`)
      .send({ pid: 'pid_completed' })
      .expect(200)

    const feed = await request(app).get('/feed?pid=pid_completed').expect(200)
    const item = feed.body.data.items.find((c: { id: string }) => c.id === surveyId)
    expect(item.alreadyCompleted).toBe(true)
    expect(item.priorityScore).toBeLessThan(0.3)
  })
})

describe('Phase 7.2 — locked survey edits', () => {
  it('rejects question changes after publish with 409', async () => {
    const surveyId = await createLiveSurvey()
    const res = await request(app)
      .patch(`/surveys/${surveyId}`)
      .send({
        questions: [{ type: 'text', text: '추가 질문이 가능한가요?' }],
      })
      .expect(409)
    expect(res.body.error.code).toBe('CONFLICT')
    expect(res.body.error.message).toMatch(/locked|잠겨/)
  })

  it('allows title-only edits after publish', async () => {
    const surveyId = await createLiveSurvey()
    const res = await request(app)
      .patch(`/surveys/${surveyId}`)
      .send({ title: '제목만 수정' })
      .expect(200)
    expect(res.body.data.title).toBe('제목만 수정')
  })
})

describe('Phase 7.9 — AI provider zod retry', () => {
  it('retries once and then surfaces a 400 with detail when provider always returns invalid draft', async () => {
    let calls = 0
    setAiProvider({
      name: 'broken',
      generate: async () => {
        calls += 1
        return { questions: [], keywords: [] } // fails draftOutSchema min(3)
      },
      audit: async () => [],
    })
    const res = await request(app)
      .post('/ai/drafts')
      .send({ brief: { objective: '커피 취향을 조사하고 싶어요' } })
      .expect(400)
    expect(calls).toBe(2)
    expect(res.body.error.message).toMatch(/invalid draft/i)
  })

  it('passes after a single retry when second call succeeds', async () => {
    let calls = 0
    setAiProvider({
      name: 'flaky',
      generate: async () => {
        calls += 1
        if (calls === 1) return { questions: [], keywords: [] }
        return {
          questions: [
            {
              type: 'single',
              text: '얼마나 자주?',
              choices: [{ label: '매일' }, { label: '가끔' }],
            },
            { type: 'likert', text: '만족도는?' },
            { type: 'text', text: '한 줄 평을 남겨주세요' },
          ],
          keywords: ['coffee'],
        }
      },
      audit: async () => [],
    })
    const res = await request(app)
      .post('/ai/drafts')
      .send({ brief: { objective: '커피 취향 조사' } })
      .expect(201)
    expect(calls).toBe(2)
    expect(res.body.data.questions.length).toBeGreaterThanOrEqual(3)
  })
})
