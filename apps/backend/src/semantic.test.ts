import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { app } from './app.js'
import { resetStore } from './repositories/inMemory.js'

const createSurvey = async (body: object) => {
  const res = await request(app).post('/surveys').send(body).expect(201)
  return res.body.data as { id: string }
}

const beautySurvey = {
  title: '뷰티 화장품 구매 설문',
  category: 'beauty',
  difficulty: 2,
  questions: [
    {
      type: 'single',
      text: '화장품을 구매할 때 가장 중요하게 보는 요소는?',
      choices: [{ label: '성분' }, { label: '가격' }],
    },
    { type: 'likert', text: '새로운 뷰티 제품을 즐겨 사용한다.' },
  ],
}

const fitnessSurvey = {
  title: '운동 습관 설문',
  category: 'health',
  difficulty: 1,
  questions: [
    {
      type: 'single',
      text: '일주일에 운동을 몇 번 하시나요?',
      choices: [{ label: '0회' }, { label: '3회 이상' }],
    },
    { type: 'likert', text: '식단 관리를 꾸준히 하는 편이다.' },
  ],
}

const cosmeticsSurvey = {
  title: '코스메틱 사용 후기 설문',
  category: 'beauty',
  difficulty: 2,
  questions: [
    {
      type: 'text',
      text: '최근 구매한 화장품 제품의 사용 후기를 알려주세요.',
    },
  ],
}

beforeEach(() => {
  resetStore()
})

describe('GET /semantic/search', () => {
  it('ranks the topically-relevant survey first', async () => {
    await createSurvey(beautySurvey)
    await createSurvey(fitnessSurvey)

    const res = await request(app)
      .get('/semantic/search')
      .query({ q: '화장품 뷰티 추천' })
      .expect(200)

    const results = res.body.data.results as Array<{ title: string; score: number }>
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toBe('뷰티 화장품 구매 설문')
    expect(results[0].score).toBeGreaterThan(0)
  })

  it('reflects newly created surveys (index stays in sync)', async () => {
    const first = await request(app).get('/semantic/search').query({ q: '운동' }).expect(200)
    expect(first.body.data.results).toHaveLength(0)

    await createSurvey(fitnessSurvey)

    const second = await request(app).get('/semantic/search').query({ q: '운동' }).expect(200)
    expect(second.body.data.results.length).toBeGreaterThan(0)
  })

  it('rejects an empty query', async () => {
    await request(app).get('/semantic/search').query({ q: '' }).expect(400)
  })
})

describe('GET /semantic/surveys/:id/similar', () => {
  it('returns semantically related surveys as graph neighbours', async () => {
    const beauty = await createSurvey(beautySurvey)
    await createSurvey(cosmeticsSurvey)
    await createSurvey(fitnessSurvey)

    const res = await request(app).get(`/semantic/surveys/${beauty.id}/similar`).expect(200)

    const neighbors = res.body.data.neighbors as Array<{ title: string; score: number }>
    expect(neighbors.length).toBeGreaterThan(0)
    expect(neighbors[0].title).toBe('코스메틱 사용 후기 설문')
  })

  it('404s for an unknown survey', async () => {
    await request(app).get('/semantic/surveys/sv_missing/similar').expect(404)
  })
})

describe('GET /semantic/surveys/:id/duplicates', () => {
  it('detects near-duplicate questions inside a survey', async () => {
    const survey = await createSurvey({
      title: '중복 점검 설문',
      category: 'general',
      difficulty: 1,
      questions: [
        { type: 'text', text: '가장 좋아하는 색깔은 무엇인가요?' },
        { type: 'text', text: '가장 좋아하는 색깔은 무엇인가요?' },
        { type: 'text', text: '주로 사용하는 교통수단은 무엇인가요?' },
      ],
    })

    const res = await request(app).get(`/semantic/surveys/${survey.id}/duplicates`).expect(200)

    const duplicates = res.body.data.duplicates as Array<{ score: number }>
    expect(duplicates.length).toBe(1)
    expect(duplicates[0].score).toBeGreaterThanOrEqual(0.82)
  })
})
