import type { Targeting } from './types.js'

const BASE_POOL = 1200
const AGE_BUCKET_WEIGHT = 0.15
const GENDER_WEIGHT = 0.35
const INTEREST_WEIGHT = 0.08

export type ReachEstimate = {
  reach: number
  feasible: boolean
  reasons: string[]
}

export const estimateReach = (targeting: Targeting | undefined): ReachEstimate => {
  const reasons: string[] = []
  let reach = BASE_POOL

  if (targeting?.ageMin !== undefined || targeting?.ageMax !== undefined) {
    const min = targeting.ageMin ?? 13
    const max = targeting.ageMax ?? 99
    const span = Math.max(1, max - min)
    const ageMultiplier = Math.min(1, span * AGE_BUCKET_WEIGHT)
    reach = Math.round(reach * ageMultiplier)
    reasons.push(`age ${min}-${max} → ×${ageMultiplier.toFixed(2)}`)
  }

  if (targeting?.genders && targeting.genders.length > 0 && targeting.genders.length < 3) {
    const ratio = targeting.genders.length * GENDER_WEIGHT
    reach = Math.round(reach * Math.min(1, ratio))
    reasons.push(`gender ${targeting.genders.join(',')} → ×${ratio.toFixed(2)}`)
  }

  if (targeting?.interests && targeting.interests.length > 0) {
    const ratio = Math.min(1, targeting.interests.length * INTEREST_WEIGHT)
    reach = Math.round(reach * Math.max(0.1, ratio))
    reasons.push(`interests ×${targeting.interests.length} → ×${ratio.toFixed(2)}`)
  }

  const feasible = reach >= 50

  return { reach: Math.max(0, reach), feasible, reasons }
}
