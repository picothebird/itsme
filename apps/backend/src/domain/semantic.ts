/**
 * Lightweight in-process semantic layer for surveys & questions.
 *
 * This is an MVP stand-in for an external vector/graph database. It produces a
 * sparse bag-of-features embedding for any text and compares embeddings with
 * cosine similarity. Features mix word tokens (good for latin/number tokens)
 * with Korean character bigrams (good for the spaceless agglutinative text the
 * platform mostly deals with), so semantically related survey questions land
 * close together without an external model.
 */
import type { Survey } from './types.js'

export type Embedding = Record<string, number>

const STOPWORDS = new Set([
  '그리고',
  '하지만',
  '그러나',
  '또는',
  '에서',
  '으로',
  '하는',
  '있는',
  '대해',
  '대한',
  '경우',
  '정도',
  'the',
  'and',
  'for',
  'are',
  'you',
  'your',
  'with',
  'about',
])

const isHangul = (ch: string): boolean => ch >= '\uAC00' && ch <= '\uD7A3'

/**
 * Tokenize text into semantic features: lowercased latin/number words plus
 * Korean character bigrams. Punctuation and stopwords are dropped.
 */
export const tokenize = (text: string): string[] => {
  const lower = text.toLowerCase()
  const features: string[] = []

  // latin / digit words
  const words = lower.match(/[a-z0-9]+/g) ?? []
  for (const w of words) {
    if (w.length < 2 || STOPWORDS.has(w)) continue
    features.push(`w:${w}`)
  }

  // korean character bigrams (and unigrams as a fallback signal)
  const hangul = Array.from(lower).filter(isHangul)
  for (let i = 0; i < hangul.length; i += 1) {
    if (i + 1 < hangul.length) {
      features.push(`k:${hangul[i]}${hangul[i + 1]}`)
    }
  }

  return features
}

/** Build an L2-normalized sparse term-frequency embedding for the given text. */
export const embed = (text: string): Embedding => {
  const tokens = tokenize(text)
  if (tokens.length === 0) return {}

  const counts: Embedding = {}
  for (const t of tokens) {
    counts[t] = (counts[t] ?? 0) + 1
  }

  let norm = 0
  for (const v of Object.values(counts)) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return {}

  const normalized: Embedding = {}
  for (const [k, v] of Object.entries(counts)) {
    normalized[k] = v / norm
  }
  return normalized
}

/** Cosine similarity of two L2-normalized sparse embeddings (0..1). */
export const cosineSimilarity = (a: Embedding, b: Embedding): number => {
  // iterate the smaller map for efficiency
  const [small, large] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a]
  let dot = 0
  for (const [k, v] of Object.entries(small)) {
    const other = large[k]
    if (other !== undefined) dot += v * other
  }
  // clamp tiny float drift
  if (dot < 0) return 0
  return dot > 1 ? 1 : dot
}

/** The text we treat as a survey's semantic content. */
export const surveyText = (survey: Survey): string =>
  [survey.title, survey.category, ...survey.questions.map((q) => q.text)].join(' ')

/** Embedding for a whole survey (title + category + all question text). */
export const embedSurvey = (survey: Survey): Embedding => embed(surveyText(survey))
