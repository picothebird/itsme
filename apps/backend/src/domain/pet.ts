export const LEVEL_THRESHOLDS = [0, 50, 120, 220, 360, 540, 760, 1020, 1320, 1660, 2040] as const

export type TagVector = Record<string, number>

export const computeExpFromSurvey = (questionCount: number, difficulty = 1): number => {
  const raw = Math.round(questionCount * 5 * difficulty)
  return Math.min(50, Math.max(10, raw))
}

export const accumulateTagVector = (current: TagVector, tag: string, weight = 1): TagVector => {
  if (!tag) {
    return current
  }
  return { ...current, [tag]: (current[tag] ?? 0) + weight }
}

export const levelFromExp = (exp: number): number => {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (exp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
    }
  }
  return Math.min(level, LEVEL_THRESHOLDS.length)
}

export const dominantTag = (vector: TagVector): string | null => {
  const entries = Object.entries(vector).sort(([a], [b]) => a.localeCompare(b))
  let winner: string | null = null
  let max = -Infinity

  for (const [tag, count] of entries) {
    if (count > max) {
      max = count
      winner = tag
    }
  }

  return winner
}

export const isEvolutionReady = (level: number): boolean => level >= 10

export type PetMutation = {
  exp: number
  level: number
  tagVector: TagVector
  evolutionStage: string | null
}

export const applySurveyCompletion = (
  pet: PetMutation,
  params: { questionCount: number; difficulty?: number; tag?: string },
): PetMutation => {
  const gained = computeExpFromSurvey(params.questionCount, params.difficulty)
  const exp = pet.exp + gained
  const tagVector = params.tag ? accumulateTagVector(pet.tagVector, params.tag) : pet.tagVector
  const level = levelFromExp(exp)
  const evolutionStage = isEvolutionReady(level) ? dominantTag(tagVector) : pet.evolutionStage

  return { exp, level, tagVector, evolutionStage }
}

/**
 * Consecutive-day participation streak. `today`/`lastActiveDay` are calendar
 * day strings (YYYY-MM-DD). Same day → unchanged; yesterday → +1; gap → reset to 1.
 */
export const applyStreak = (
  prev: { streak: number; lastActiveDay: string | null },
  today: string,
): { streak: number; lastActiveDay: string } => {
  if (prev.lastActiveDay === today) {
    return { streak: Math.max(1, prev.streak), lastActiveDay: today }
  }
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  const yesterday = d.toISOString().slice(0, 10)
  if (prev.lastActiveDay === yesterday) {
    return { streak: prev.streak + 1, lastActiveDay: today }
  }
  return { streak: 1, lastActiveDay: today }
}

export const feedDataPiece = (
  pet: PetMutation,
  params: { bonusExp: number; tag: string },
): PetMutation & { leveledUp: boolean; evolved: boolean } => {
  const exp = pet.exp + Math.max(0, params.bonusExp)
  const tagVector = accumulateTagVector(pet.tagVector, params.tag, 2)
  const level = levelFromExp(exp)
  const evolutionStage = isEvolutionReady(level) ? dominantTag(tagVector) : pet.evolutionStage
  return {
    exp,
    level,
    tagVector,
    evolutionStage,
    leveledUp: level > pet.level,
    evolved: evolutionStage !== pet.evolutionStage,
  }
}
