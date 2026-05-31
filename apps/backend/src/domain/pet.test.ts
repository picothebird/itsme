import { describe, expect, it } from 'vitest'

import {
  accumulateTagVector,
  applyStreak,
  applySurveyCompletion,
  computeExpFromSurvey,
  dominantTag,
  isEvolutionReady,
  levelFromExp,
} from './pet.js'

describe('pet / computeExpFromSurvey', () => {
  it('clamps to the minimum reward of 10 exp', () => {
    expect(computeExpFromSurvey(1, 1)).toBe(10)
  })

  it('clamps to the maximum reward of 50 exp', () => {
    expect(computeExpFromSurvey(20, 1)).toBe(50)
  })

  it('honors the difficulty multiplier', () => {
    expect(computeExpFromSurvey(4, 2)).toBe(40)
  })
})

describe('pet / accumulateTagVector', () => {
  it('initializes new tags', () => {
    expect(accumulateTagVector({}, 'beauty')).toEqual({ beauty: 1 })
  })

  it('increments existing tags with optional weight', () => {
    expect(accumulateTagVector({ tech: 2 }, 'tech', 3)).toEqual({ tech: 5 })
  })
})

describe('pet / levelFromExp', () => {
  it('starts at level 1', () => {
    expect(levelFromExp(0)).toBe(1)
  })

  it('reaches level 10 at the final threshold', () => {
    expect(levelFromExp(2040)).toBe(11)
  })
})

describe('pet / dominantTag', () => {
  it('returns null for an empty vector', () => {
    expect(dominantTag({})).toBeNull()
  })

  it('picks the tag with the highest count', () => {
    expect(dominantTag({ tech: 3, beauty: 5 })).toBe('beauty')
  })

  it('breaks ties alphabetically for determinism', () => {
    expect(dominantTag({ tech: 4, beauty: 4 })).toBe('beauty')
  })
})

describe('pet / applySurveyCompletion', () => {
  it('accumulates exp, level, and tag vector', () => {
    const next = applySurveyCompletion(
      { exp: 40, level: 1, tagVector: { tech: 1 }, evolutionStage: null },
      { questionCount: 4, tag: 'tech' },
    )

    expect(next.exp).toBe(60)
    expect(next.level).toBe(2)
    expect(next.tagVector).toEqual({ tech: 2 })
    expect(next.evolutionStage).toBeNull()
  })

  it('locks an evolution stage once level 10 is reached', () => {
    const next = applySurveyCompletion(
      { exp: 1660, level: 9, tagVector: { tech: 3, beauty: 7 }, evolutionStage: null },
      { questionCount: 8, tag: 'beauty' },
    )

    expect(isEvolutionReady(next.level)).toBe(true)
    expect(next.evolutionStage).toBe('beauty')
  })
})

describe('pet / applyStreak', () => {
  it('starts a streak at 1 on first activity', () => {
    expect(applyStreak({ streak: 0, lastActiveDay: null }, '2026-05-31')).toEqual({
      streak: 1,
      lastActiveDay: '2026-05-31',
    })
  })

  it('increments when the previous activity was yesterday', () => {
    expect(applyStreak({ streak: 3, lastActiveDay: '2026-05-30' }, '2026-05-31')).toEqual({
      streak: 4,
      lastActiveDay: '2026-05-31',
    })
  })

  it('keeps the streak unchanged for same-day activity', () => {
    expect(applyStreak({ streak: 4, lastActiveDay: '2026-05-31' }, '2026-05-31')).toEqual({
      streak: 4,
      lastActiveDay: '2026-05-31',
    })
  })

  it('resets to 1 after a gap of more than one day', () => {
    expect(applyStreak({ streak: 9, lastActiveDay: '2026-05-28' }, '2026-05-31')).toEqual({
      streak: 1,
      lastActiveDay: '2026-05-31',
    })
  })
})
