export type AnswerSample = {
  questionIndex: number
  selectedIndex: number | null
  latencyMs: number
  questionTextLength: number
}

export type StrikeOutcome = {
  level: 'ok' | 'warn' | 'block'
  reasons: Array<'speeding' | 'straight_lining'>
  newStrikes: number
}

const READING_CHARS_PER_SEC = 16
const MIN_DWELL_FLOOR_MS = 800
const STRAIGHT_LINING_WINDOW = 4
const BLOCK_STRIKE_THRESHOLD = 3

export const minDwellMs = (questionTextLength: number): number => {
  const dynamic = Math.round((Math.max(0, questionTextLength) / READING_CHARS_PER_SEC) * 1000)
  return Math.max(MIN_DWELL_FLOOR_MS, dynamic)
}

export const isSpeeding = (sample: AnswerSample): boolean =>
  sample.latencyMs < minDwellMs(sample.questionTextLength)

export const isStraightLining = (history: AnswerSample[]): boolean => {
  if (history.length < STRAIGHT_LINING_WINDOW) {
    return false
  }

  const window = history.slice(-STRAIGHT_LINING_WINDOW)
  const first = window[0].selectedIndex
  if (first === null) {
    return false
  }
  return window.every((sample) => sample.selectedIndex === first)
}

export const evaluate = (params: {
  history: AnswerSample[]
  sample: AnswerSample
  currentStrikes: number
}): StrikeOutcome => {
  const reasons: StrikeOutcome['reasons'] = []
  const nextHistory = [...params.history, params.sample]

  if (isSpeeding(params.sample)) {
    reasons.push('speeding')
  }
  if (isStraightLining(nextHistory)) {
    reasons.push('straight_lining')
  }

  const newStrikes = params.currentStrikes + (reasons.length > 0 ? 1 : 0)

  if (newStrikes >= BLOCK_STRIKE_THRESHOLD) {
    return { level: 'block', reasons, newStrikes }
  }
  if (newStrikes > 0) {
    return { level: 'warn', reasons, newStrikes }
  }
  return { level: 'ok', reasons, newStrikes }
}

export const PENALTY_DURATION_MS = 10 * 60 * 1000
