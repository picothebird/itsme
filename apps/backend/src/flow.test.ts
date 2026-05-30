import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { app } from './app.js'
import { resetStore } from './repositories/inMemory.js'
import { __testing } from './modules/response/response.service.js'

const goodLatencyForLength = (length: number) => Math.max(1_500, length * 80)

describe('survey + response flow', () => {
  beforeEach(() => {
    resetStore()
    __testing.clearPenalties()
  })

  it('creates a survey, publishes it, and accepts a panelist response end-to-end', async () => {
    const createRes = await request(app)
      .post('/surveys')
      .send({
        title: '커피 취향 테스트',
        category: 'beauty',
        difficulty: 2,
        questions: [
          {
            type: 'single',
            text: '아메리카노와 라떼 중 더 좋아하는 음료는?',
            choices: [{ label: '아메리카노' }, { label: '라떼' }],
          },
          {
            type: 'likert',
            text: '카페에서 머무는 시간을 즐기는 편이다.',
          },
        ],
      })
      .expect(201)

    const survey = createRes.body.data
    expect(survey.id).toMatch(/^sv_/)
    expect(survey.questions).toHaveLength(2)

    await request(app)
      .post(`/surveys/${survey.id}/publish`)
      .send({
        pointsPerUser: 500,
        targetCount: 200,
        estimatedReach: 300,
      })
      .expect(202)

    const feedRes = await request(app).get('/feed').expect(200)
    expect(feedRes.body.data).toHaveLength(1)
    expect(feedRes.body.data[0].pointsPerUser).toBe(500)

    const startRes = await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_demo_1', surveyId: survey.id })
      .expect(201)

    const responseId = startRes.body.data.id

    for (const question of survey.questions as Array<{
      id: string
      text: string
      choices?: Array<{ id: string }>
    }>) {
      await request(app)
        .post(`/responses/${responseId}/answer`)
        .send({
          questionId: question.id,
          selectedChoiceIds: question.choices ? [question.choices[0].id] : [],
          latencyMs: goodLatencyForLength(question.text.length),
        })
        .expect(200)
    }

    const completeRes = await request(app)
      .post(`/responses/${responseId}/complete`)
      .send({})
      .expect(200)

    expect(completeRes.body.data.pointsAwarded).toBe(500)
    expect(completeRes.body.data.pet.exp).toBeGreaterThan(0)

    const panelRes = await request(app).get('/panel/me').query({ pid: 'pid_demo_1' }).expect(200)
    expect(panelRes.body.data.wallet.balance).toBe(500)
    expect(panelRes.body.data.pet.exp).toBeGreaterThan(0)
  })

  it('blocks a panelist after sustained speeding and straight-lining', async () => {
    const createRes = await request(app)
      .post('/surveys')
      .send({
        title: '신뢰도 테스트',
        category: 'tech',
        difficulty: 1,
        questions: Array.from({ length: 5 }, (_, index) => ({
          type: 'single' as const,
          text: `질문 ${index + 1}: 충분히 긴 텍스트를 가진 문항입니다 ${'문항 '.repeat(20)}`,
          choices: [{ label: '선택지 A' }, { label: '선택지 B' }],
        })),
      })
      .expect(201)

    const survey = createRes.body.data as {
      id: string
      questions: Array<{ id: string; choices: Array<{ id: string }> }>
    }

    await request(app)
      .post(`/surveys/${survey.id}/publish`)
      .send({ pointsPerUser: 100, targetCount: 50, estimatedReach: 100 })
      .expect(202)

    const startRes = await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_abuser', surveyId: survey.id })
      .expect(201)
    const responseId = startRes.body.data.id

    let lastLevel = 'ok'
    for (const question of survey.questions) {
      const res = await request(app)
        .post(`/responses/${responseId}/answer`)
        .send({
          questionId: question.id,
          selectedChoiceIds: [question.choices[0].id],
          latencyMs: 50,
        })
        .expect(200)
      lastLevel = res.body.data.abuse.level
      if (lastLevel === 'block') {
        break
      }
    }

    expect(lastLevel).toBe('block')

    await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_abuser', surveyId: survey.id })
      .expect(403)
  })

  it('rejects publishing with too small a target audience', async () => {
    const createRes = await request(app)
      .post('/surveys')
      .send({
        title: '미니 설문',
        category: 'lifestyle',
        questions: [
          {
            type: 'single',
            text: '아침형 인간인가요?',
            choices: [{ label: '예' }, { label: '아니오' }],
          },
        ],
      })
      .expect(201)

    await request(app)
      .post(`/surveys/${createRes.body.data.id}/publish`)
      .send({ pointsPerUser: 100, targetCount: 10, estimatedReach: 10 })
      .expect(400)
  })
})
