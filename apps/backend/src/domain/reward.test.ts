import { describe, expect, it } from 'vitest'

import {
  computeEstimatedBudget,
  computeReward,
  isTargetSizeFeasible,
  MIN_TARGET_PANELISTS,
} from './reward.js'

describe('reward / computeReward', () => {
  it('returns full points by default', () => {
    expect(computeReward({ questionCount: 5, pointsPerUser: 500 })).toBe(500)
  })

  it('scales by quality score', () => {
    expect(computeReward({ questionCount: 5, pointsPerUser: 500, qualityScore: 0.5 })).toBe(250)
  })

  it('clamps quality score into [0,1]', () => {
    expect(computeReward({ questionCount: 5, pointsPerUser: 500, qualityScore: 1.6 })).toBe(500)
    expect(computeReward({ questionCount: 5, pointsPerUser: 500, qualityScore: -1 })).toBe(0)
  })
})

describe('reward / computeEstimatedBudget', () => {
  it('applies a 10% overhead by default', () => {
    expect(computeEstimatedBudget({ pointsPerUser: 100, targetCount: 100 })).toBe(11_000)
  })

  it('honors a custom overhead ratio', () => {
    expect(
      computeEstimatedBudget({ pointsPerUser: 100, targetCount: 100, overheadRatio: 0.2 }),
    ).toBe(12_000)
  })
})

describe('reward / isTargetSizeFeasible', () => {
  it('rejects target sizes below the platform minimum', () => {
    expect(isTargetSizeFeasible(MIN_TARGET_PANELISTS - 1)).toBe(false)
  })

  it('accepts target sizes at or above the minimum', () => {
    expect(isTargetSizeFeasible(MIN_TARGET_PANELISTS)).toBe(true)
  })
})
