import { describe, expect, it } from 'vitest'

import { buildFeed, paginate } from './feed.js'
import type { Survey, SurveyResponse } from './types.js'

const baseSurvey = (id: string, extras: Partial<Survey> = {}): Survey => ({
  id,
  title: `Survey ${id}`,
  category: 'general',
  difficulty: 1,
  status: 'live',
  locked: true,
  questions: [{ id: `q-${id}`, type: 'text', text: 'why?', required: true }],
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  updatedAt: new Date().toISOString(),
  deployment: {
    pointsPerUser: 100,
    targetCount: 200,
    targeting: {},
    startAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  ...extras,
})

const completedResponse = (surveyId: string, pid: string): SurveyResponse => ({
  id: `r-${surveyId}-${pid}`,
  surveyId,
  pid,
  status: 'completed',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  answers: [],
  strikes: 0,
})

describe('buildFeed', () => {
  it('only returns live surveys sorted by priority desc', () => {
    const surveys = [
      baseSurvey('a', { status: 'draft' }),
      baseSurvey('b', { category: 'food' }),
      baseSurvey('c', { category: 'beauty' }),
    ]
    const result = buildFeed(surveys, [], { pid: 'p1', interests: ['food'] })
    expect(result.map((c) => c.id)).toEqual(['b', 'c'])
    expect(result[0].priorityScore).toBeGreaterThan(result[1].priorityScore)
  })

  it('penalises surveys the panelist already completed', () => {
    const surveys = [baseSurvey('a'), baseSurvey('b')]
    const responses = [completedResponse('a', 'pid_1')]
    const result = buildFeed(surveys, responses, { pid: 'pid_1' })
    const a = result.find((r) => r.id === 'a')!
    const b = result.find((r) => r.id === 'b')!
    expect(a.alreadyCompleted).toBe(true)
    expect(a.priorityScore).toBeLessThan(b.priorityScore)
  })

  it('imminent deadline boosts priority', () => {
    const fresh = baseSurvey('fresh', {
      deployment: {
        pointsPerUser: 100,
        targetCount: 100,
        targeting: {},
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
      },
    })
    const stale = baseSurvey('stale')
    const result = buildFeed([stale, fresh], [], null)
    expect(result[0].id).toBe('fresh')
  })
})

describe('paginate', () => {
  it('returns cursor when more items remain', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
    })) as never as ReturnType<typeof buildFeed>
    const page = paginate(items, null, 2)
    expect(page.items).toHaveLength(2)
    expect(page.nextCursor).toBe('s1')
    const next = paginate(items, 's1', 2)
    expect(next.items.map((i) => i.id)).toEqual(['s2', 's3'])
  })
})
