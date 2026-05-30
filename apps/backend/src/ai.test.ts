import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'

import { app } from './app.js'
import { resetStore } from './repositories/inMemory.js'
import { resetAiSessions } from './modules/ai/ai.service.js'

const okData = <T>(body: unknown): T => {
  expect(body).toMatchObject({ ok: true })
  return (body as { data: T }).data
}

describe('AI orchestration', () => {
  beforeEach(() => {
    resetStore()
    resetAiSessions()
  })

  it('generates a draft survey from a brief', async () => {
    const res = await request(app)
      .post('/ai/drafts')
      .send({ brief: { objective: '커피 구독 서비스 만족도 조사', desiredCount: 8 } })
    expect(res.status).toBe(201)
    const data = okData<{ surveyId: string; questions: unknown[]; providerName: string }>(res.body)
    expect(data.surveyId).toMatch(/^sv_/)
    expect(data.questions).toHaveLength(8)
    expect(data.providerName).toBe('heuristic')
  })

  it('rejects an objective that is too short', async () => {
    const res = await request(app)
      .post('/ai/drafts')
      .send({ brief: { objective: 'a' } })
    expect(res.status).toBe(400)
  })

  it('runs an audit and returns findings + score', async () => {
    const draft = await request(app)
      .post('/ai/drafts')
      .send({ brief: { objective: '운동 앱 만족도 조사' } })
    const surveyId = (draft.body as { data: { surveyId: string } }).data.surveyId

    // Inject a known-bad question by patching the survey
    await request(app)
      .patch(`/surveys/${surveyId}`)
      .send({
        questions: [
          {
            type: 'single',
            text: '당연히 좋다고 생각하지 않나요?',
            required: true,
            choices: [{ label: '예' }, { label: '아니오' }],
          },
        ],
      })

    const audit = await request(app).post('/ai/audits').send({ surveyId })
    expect(audit.status).toBe(201)
    const data = okData<{
      sessionId: string
      findings: Array<{ rule: string; id: string }>
      summary: { score: number; high: number }
    }>(audit.body)

    expect(data.sessionId).toMatch(/^aud_/)
    expect(data.findings.some((f) => f.rule === 'leading')).toBe(true)
    expect(data.summary.high).toBeGreaterThan(0)
    expect(data.summary.score).toBeLessThan(100)
  })

  it('applies a fix and re-audits the survey', async () => {
    const draft = await request(app)
      .post('/ai/drafts')
      .send({ brief: { objective: '운동 앱 만족도 조사' } })
    const surveyId = (draft.body as { data: { surveyId: string } }).data.surveyId

    const patched = await request(app)
      .patch(`/surveys/${surveyId}`)
      .send({
        questions: [
          {
            type: 'single',
            text: '당연히 좋다고 생각하지 않나요?',
            required: true,
            choices: [{ label: '예' }, { label: '아니오' }],
          },
        ],
      })
    expect(patched.status).toBe(200)

    const audit = await request(app).post('/ai/audits').send({ surveyId })
    expect(audit.status).toBe(201)
    const session = (
      audit.body as {
        data: {
          sessionId: string
          findings: Array<{ id: string; rule: string; fix?: { text: string } }>
        }
      }
    ).data
    const leading = session.findings.find((f) => f.rule === 'leading')!
    expect(leading).toBeDefined()

    const apply = await request(app)
      .post(`/ai/audits/${session.sessionId}/apply`)
      .send({ findingId: leading.id })
    expect(apply.status).toBe(200)
    const applied = (
      apply.body as {
        data: {
          questions: Array<{ text: string }>
          remaining: Array<{ id: string; rule: string; fix?: { text: string } }>
        }
      }
    ).data
    expect(applied.questions[0].text).not.toContain('당연히')
    // Same fix should not be offered again (text is already applied)
    const sameFix = applied.remaining.find(
      (f) => f.fix && leading.fix && f.fix.text === leading.fix.text,
    )
    expect(sameFix).toBeUndefined()
  })
})
