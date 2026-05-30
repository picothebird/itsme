export type RewardContext = {
  questionCount: number
  pointsPerUser: number
  qualityScore?: number
}

export const computeReward = (context: RewardContext): number => {
  const quality = Math.max(0, Math.min(1, context.qualityScore ?? 1))
  return Math.round(context.pointsPerUser * quality)
}

export const computeEstimatedBudget = (params: {
  pointsPerUser: number
  targetCount: number
  overheadRatio?: number
}): number => {
  const overhead = params.overheadRatio ?? 0.1
  return Math.round(params.pointsPerUser * params.targetCount * (1 + overhead))
}

export const MIN_TARGET_PANELISTS = 50

export const isTargetSizeFeasible = (estimatedReach: number): boolean =>
  estimatedReach >= MIN_TARGET_PANELISTS
