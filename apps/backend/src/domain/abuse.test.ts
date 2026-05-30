import { describe, expect, it } from 'vitest'

import { evaluate, isSpeeding, isStraightLining, minDwellMs, type AnswerSample } from './abuse.js'

const makeSample = (overrides: Partial<AnswerSample> = {}): AnswerSample => ({
  questionIndex: 0,
  selectedIndex: 0,
  latencyMs: 5_000,
  questionTextLength: 100,
  ...overrides,
})

describe('abuse / minDwellMs', () => {
  it('applies floor for very short questions', () => {
    expect(minDwellMs(10)).toBe(800)
  })

  it('scales linearly with question length', () => {
    expect(minDwellMs(160)).toBe(10_000)
  })
})

describe('abuse / isSpeeding', () => {
  it('flags responses below the minimum dwell time', () => {
    expect(isSpeeding(makeSample({ latencyMs: 200, questionTextLength: 80 }))).toBe(true)
  })

  it('accepts responses at or above the threshold', () => {
    expect(isSpeeding(makeSample({ latencyMs: 1_000, questionTextLength: 10 }))).toBe(false)
  })
})

describe('abuse / isStraightLining', () => {
  it('returns false when fewer than four samples', () => {
    const history = [makeSample(), makeSample(), makeSample()]
    expect(isStraightLining(history)).toBe(false)
  })

  it('returns true on four consecutive identical selections', () => {
    const history = Array.from({ length: 4 }, () => makeSample({ selectedIndex: 2 }))
    expect(isStraightLining(history)).toBe(true)
  })

  it('returns false when the streak is broken', () => {
    const history = [
      makeSample({ selectedIndex: 1 }),
      makeSample({ selectedIndex: 1 }),
      makeSample({ selectedIndex: 2 }),
      makeSample({ selectedIndex: 1 }),
    ]
    expect(isStraightLining(history)).toBe(false)
  })
})

describe('abuse / evaluate', () => {
  it('returns ok when no anomalies are detected', () => {
    const result = evaluate({
      history: [],
      sample: makeSample({ latencyMs: 5_000, questionTextLength: 40 }),
      currentStrikes: 0,
    })

    expect(result.level).toBe('ok')
    expect(result.reasons).toHaveLength(0)
    expect(result.newStrikes).toBe(0)
  })

  it('emits a warn level with one strike for speeding', () => {
    const result = evaluate({
      history: [],
      sample: makeSample({ latencyMs: 100, questionTextLength: 200 }),
      currentStrikes: 0,
    })

    expect(result.level).toBe('warn')
    expect(result.reasons).toContain('speeding')
    expect(result.newStrikes).toBe(1)
  })

  it('escalates to block after three strikes', () => {
    const result = evaluate({
      history: [
        makeSample({ selectedIndex: 0 }),
        makeSample({ selectedIndex: 0 }),
        makeSample({ selectedIndex: 0 }),
      ],
      sample: makeSample({ selectedIndex: 0, latencyMs: 50 }),
      currentStrikes: 2,
    })

    expect(result.level).toBe('block')
    expect(result.reasons).toEqual(expect.arrayContaining(['speeding', 'straight_lining']))
    expect(result.newStrikes).toBe(3)
  })
})
