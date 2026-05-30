import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { app } from './app.js'
import { resetRateLimiter } from './middleware/rateLimit.js'
import {
  dataPieceRepo,
  generateId,
  petRepo,
  responseRepo,
  resetStore,
  surveyRepo,
} from './repositories/inMemory.js'
import { sweepStalePieces, STALE_PIECE_MS } from './modules/panel/panel.service.js'
import type { DataPiece, Pet, Survey, SurveyResponse } from './domain/types.js'

beforeEach(() => {
  resetStore()
  resetRateLimiter()
})

const makeSurvey = (id: string): Survey => ({
  id,
  title: `Survey ${id}`,
  category: 'general',
  difficulty: 1,
  status: 'live',
  locked: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  questions: [
    {
      id: `${id}_q1`,
      type: 'single',
      required: true,
      text: '하루에 커피를 몇 잔 드십니까? 평소 패턴을 알려주세요.',
      choices: [
        { id: 'c1', label: '0잔' },
        { id: 'c2', label: '1잔' },
        { id: 'c3', label: '2잔 이상' },
      ],
    },
  ],
  deployment: {
    pointsPerUser: 100,
    targetCount: 50,
    startAt: new Date().toISOString(),
    targeting: {},
  },
})

describe('§7.7 multi-device exclusivity', () => {
  it('abandons previous in_progress response when starting a different one for the same pid', async () => {
    const s1 = surveyRepo.save(makeSurvey('sv_multi_a'))
    const s2 = surveyRepo.save(makeSurvey('sv_multi_b'))

    const a = await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_multi', surveyId: s1.id })
      .expect(201)
    const firstId = a.body.data.id as string

    const b = await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_multi', surveyId: s2.id })
      .expect(201)
    expect(b.body.data.id).not.toBe(firstId)

    const abandoned = responseRepo.get(firstId)
    expect(abandoned?.status).toBe('abandoned')
  })

  it('still resumes (returns same id) when starting the same survey twice', async () => {
    const s = surveyRepo.save(makeSurvey('sv_resume'))
    const first = await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_resume', surveyId: s.id })
      .expect(201)
    const second = await request(app)
      .post('/responses/start')
      .send({ pid: 'pid_resume', surveyId: s.id })
      .expect(201)
    expect(second.body.data.id).toBe(first.body.data.id)
  })
})

describe('§7.8 stale data piece auto-consume', () => {
  const makePet = (pid: string): Pet => {
    const pet: Pet = {
      pid,
      level: 1,
      exp: 0,
      tagVector: {},
      evolutionStage: null,
      sick: false,
    }
    petRepo.save(pet)
    return pet
  }

  const seedPiece = (pid: string, ageMs: number, bonusExp = 20): DataPiece => {
    const fakeResponse: SurveyResponse = {
      id: generateId('res'),
      pid,
      surveyId: 'sv_seed',
      status: 'completed',
      startedAt: new Date(Date.now() - ageMs).toISOString(),
      completedAt: new Date(Date.now() - ageMs).toISOString(),
      strikes: 0,
      answers: [],
    }
    responseRepo.save(fakeResponse)
    const piece: DataPiece = {
      id: generateId('pc'),
      pid,
      surveyId: 'sv_seed',
      responseId: fakeResponse.id,
      categoryTag: 'tech',
      bonusExp,
      createdAt: new Date(Date.now() - ageMs).toISOString(),
    }
    return dataPieceRepo.save(piece)
  }

  it('leaves fresh pieces untouched', () => {
    makePet('pid_fresh')
    seedPiece('pid_fresh', 60 * 60 * 1000) // 1h old
    const res = sweepStalePieces('pid_fresh')
    expect(res.consumed).toHaveLength(0)
    expect(dataPieceRepo.listByPid('pid_fresh')[0].consumedAt).toBeUndefined()
  })

  it('auto-consumes pieces older than 24h with halved bonus exp', () => {
    makePet('pid_stale')
    seedPiece('pid_stale', STALE_PIECE_MS + 1000, 20)
    const res = sweepStalePieces('pid_stale')
    expect(res.consumed).toHaveLength(1)
    expect(res.pet?.exp).toBe(10)
    expect(petRepo.get('pid_stale').exp).toBe(10)
    expect(dataPieceRepo.listByPid('pid_stale')[0].consumedAt).toBeTruthy()
  })

  it('GET /panel/me/data-pieces triggers the sweep lazily', async () => {
    makePet('pid_lazy')
    seedPiece('pid_lazy', STALE_PIECE_MS + 5000, 14)
    const res = await request(app).get('/panel/me/data-pieces?pid=pid_lazy').expect(200)
    expect(res.body.data.autoConsumed).toBe(1)
    expect(res.body.data.pending).toHaveLength(0)
    expect(res.body.data.consumed).toHaveLength(1)
  })
})
