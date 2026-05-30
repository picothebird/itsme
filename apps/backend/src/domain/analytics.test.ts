import { describe, expect, it } from 'vitest'

import { buildDashboardSummary, buildSurveyAnalytics, toCsv } from './analytics.js'
import type { Survey, SurveyResponse } from './types.js'

const makeSurvey = (overrides?: Partial<Survey>): Survey => ({
  id: 'sv_1',
  title: '데모 설문',
  category: 'general',
  difficulty: 1,
  status: 'live',
  locked: true,
  createdAt: '2026-05-30T00:00:00Z',
  updatedAt: '2026-05-30T00:00:00Z',
  deployment: {
    pointsPerUser: 500,
    targetCount: 100,
    targeting: {},
    startAt: '2026-05-30T00:00:00Z',
  },
  questions: [
    {
      id: 'q1',
      type: 'single',
      text: '커피를 좋아하시나요?',
      required: true,
      choices: [
        { id: 'c1a', label: '예' },
        { id: 'c1b', label: '아니오' },
      ],
    },
    {
      id: 'q2',
      type: 'single',
      text: '하루 몇 잔?',
      required: true,
      choices: [
        { id: 'c2a', label: '1잔' },
        { id: 'c2b', label: '2잔 이상' },
      ],
    },
  ],
  ...overrides,
})

const makeResponse = (overrides: Partial<SurveyResponse>): SurveyResponse => ({
  id: 'res_x',
  pid: 'pid_x',
  surveyId: 'sv_1',
  status: 'completed',
  startedAt: '2026-05-30T00:00:00Z',
  completedAt: '2026-05-30T00:00:10Z',
  strikes: 0,
  answers: [],
  ...overrides,
})

describe('buildSurveyAnalytics', () => {
  it('returns zero stats when no responses', () => {
    const a = buildSurveyAnalytics(makeSurvey(), [])
    expect(a.totals).toMatchObject({ started: 0, completed: 0, completionRate: 0, abuseRate: 0 })
    expect(a.questions).toHaveLength(2)
  })

  it('aggregates completion + dropoff + choice distribution', () => {
    const survey = makeSurvey()
    const responses: SurveyResponse[] = [
      makeResponse({
        id: 'r1',
        answers: [
          {
            questionId: 'q1',
            questionIndex: 0,
            selectedChoiceIds: ['c1a'],
            selectedIndex: 0,
            latencyMs: 3000,
            questionTextLength: 12,
            receivedAt: '',
          },
          {
            questionId: 'q2',
            questionIndex: 1,
            selectedChoiceIds: ['c2a'],
            selectedIndex: 0,
            latencyMs: 2000,
            questionTextLength: 8,
            receivedAt: '',
          },
        ],
      }),
      makeResponse({
        id: 'r2',
        status: 'in_progress',
        completedAt: undefined,
        answers: [
          {
            questionId: 'q1',
            questionIndex: 0,
            selectedChoiceIds: ['c1b'],
            selectedIndex: 1,
            latencyMs: 2500,
            questionTextLength: 12,
            receivedAt: '',
          },
        ],
      }),
      makeResponse({ id: 'r3', status: 'blocked', completedAt: undefined, strikes: 3 }),
    ]
    const a = buildSurveyAnalytics(survey, responses)
    expect(a.totals.started).toBe(3)
    expect(a.totals.completed).toBe(1)
    expect(a.totals.blocked).toBe(1)
    expect(a.totals.abuseRate).toBeGreaterThan(0)
    expect(a.questions[0].answered).toBe(2)
    expect(a.questions[0].choices?.find((c) => c.choiceId === 'c1a')?.count).toBe(1)
    expect(a.questions[1].answered).toBe(1)
  })
})

describe('buildDashboardSummary', () => {
  it('counts surveys by status and aggregates spend', () => {
    const surveys = [
      makeSurvey({ id: 'a', status: 'draft' }),
      makeSurvey({ id: 'b', status: 'live' }),
      makeSurvey({ id: 'c', status: 'done' }),
    ]
    const responses = [
      makeResponse({ id: 'r1', surveyId: 'b' }),
      makeResponse({ id: 'r2', surveyId: 'b', status: 'blocked', completedAt: undefined }),
    ]
    const summary = buildDashboardSummary(surveys, responses)
    expect(summary.surveys).toEqual({ draft: 1, live: 1, done: 1, total: 3 })
    expect(summary.responses).toMatchObject({ started: 2, completed: 1, blocked: 1 })
    expect(summary.spendPoints).toBe(500)
    expect(summary.estimatedBudget).toBe(500 * 100 * 3)
  })
})

describe('toCsv', () => {
  it('produces a CSV header and rows with question columns', () => {
    const survey = makeSurvey()
    const responses = [
      makeResponse({
        id: 'r1',
        answers: [
          {
            questionId: 'q1',
            questionIndex: 0,
            selectedChoiceIds: ['c1a'],
            selectedIndex: 0,
            latencyMs: 1000,
            questionTextLength: 12,
            receivedAt: '',
          },
        ],
      }),
    ]
    const csv = toCsv(survey, responses)
    const lines = csv.split('\n')
    expect(lines[0].split(',').slice(0, 6)).toEqual([
      'response_id',
      'pid',
      'status',
      'started_at',
      'completed_at',
      'strikes',
    ])
    expect(lines[1]).toContain('r1')
    expect(lines[1]).toContain('예')
  })
})
