import { describe, expect, it } from 'vitest'

import { estimateReach } from './targeting.js'

describe('estimateReach', () => {
  it('returns base pool when no targeting', () => {
    const r = estimateReach(undefined)
    expect(r.reach).toBeGreaterThan(1000)
    expect(r.feasible).toBe(true)
  })

  it('shrinks reach for narrow age band', () => {
    const r = estimateReach({ ageMin: 25, ageMax: 27 })
    expect(r.reach).toBeLessThan(700)
  })

  it('marks infeasible when target<50', () => {
    const r = estimateReach({ ageMin: 25, ageMax: 26, genders: ['female'], interests: ['뷰티'] })
    expect(r.feasible).toBe(r.reach >= 50)
  })

  it('returns reasons for each applied filter', () => {
    const r = estimateReach({ ageMin: 20, ageMax: 30, genders: ['male'], interests: ['게임'] })
    expect(r.reasons.length).toBeGreaterThanOrEqual(3)
  })
})
