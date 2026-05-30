/**
 * Semantic survey index — the vector + graph view over surveys.
 *
 * Surveys live in the in-memory repo as the source of truth; this service keeps
 * a derived embedding index on top of them. Because the corpus is small and
 * mutable, the index is computed lazily from a cheap fingerprint (survey count
 * + updatedAt hash) and rebuilt only when surveys change. That keeps reads fast
 * without any cache-invalidation bookkeeping at every write site.
 */
import { cosineSimilarity, embed, embedSurvey, type Embedding } from '../../domain/semantic.js'
import type { Survey } from '../../domain/types.js'
import { surveyRepo } from '../../repositories/inMemory.js'

export type ScoredSurvey = {
  surveyId: string
  title: string
  category: string
  score: number
}

export type SurveyEdge = {
  surveyId: string
  title: string
  score: number
}

export type DuplicatePair = {
  a: { index: number; text: string }
  b: { index: number; text: string }
  score: number
}

type IndexedSurvey = {
  survey: Survey
  embedding: Embedding
}

const SIMILAR_THRESHOLD = 0.18
const DUPLICATE_THRESHOLD = 0.82

let index: IndexedSurvey[] = []
let fingerprint = ''

const computeFingerprint = (surveys: Survey[]): string =>
  `${surveys.length}:${surveys
    .map((s) => `${s.id}@${s.updatedAt}`)
    .sort()
    .join('|')}`

/** Rebuild the embedding index if the survey corpus changed. */
const ensureIndex = (): IndexedSurvey[] => {
  const surveys = surveyRepo.list()
  const fp = computeFingerprint(surveys)
  if (fp !== fingerprint) {
    index = surveys.map((survey) => ({ survey, embedding: embedSurvey(survey) }))
    fingerprint = fp
  }
  return index
}

/** Force a rebuild on next read (used by tests / store resets). */
export const invalidateSemanticIndex = (): void => {
  fingerprint = ''
  index = []
}

/** Free-text semantic search across surveys, best matches first. */
export const searchSurveys = (query: string, limit = 5): ScoredSurvey[] => {
  const q = embed(query)
  if (Object.keys(q).length === 0) return []
  return ensureIndex()
    .map(({ survey, embedding }) => ({
      surveyId: survey.id,
      title: survey.title,
      category: survey.category,
      score: cosineSimilarity(q, embedding),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Graph neighbours: surveys most similar to the given one. */
export const similarSurveys = (surveyId: string, limit = 5): SurveyEdge[] => {
  const all = ensureIndex()
  const self = all.find((i) => i.survey.id === surveyId)
  if (!self) return []
  return all
    .filter((i) => i.survey.id !== surveyId)
    .map((i) => ({
      surveyId: i.survey.id,
      title: i.survey.title,
      score: cosineSimilarity(self.embedding, i.embedding),
    }))
    .filter((e) => e.score >= SIMILAR_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Personalized ranking for a panelist's interests. Embeds the interest list as
 * a pseudo-query and scores live surveys against it — used to order the feed so
 * day-one panelists see relevant surveys based on onboarding choices.
 */
export const rankForInterests = (interests: string[], limit = 10): ScoredSurvey[] => {
  if (interests.length === 0) return []
  return searchSurveys(interests.join(' '), limit)
}

/**
 * Near-duplicate question detection within a single survey (semantic, not just
 * exact string match). Surfaces redundant questions before deployment.
 */
export const findDuplicateQuestions = (survey: Survey): DuplicatePair[] => {
  const embeddings = survey.questions.map((q) => ({ text: q.text, vec: embed(q.text) }))
  const pairs: DuplicatePair[] = []
  for (let i = 0; i < embeddings.length; i += 1) {
    for (let j = i + 1; j < embeddings.length; j += 1) {
      const score = cosineSimilarity(embeddings[i].vec, embeddings[j].vec)
      if (score >= DUPLICATE_THRESHOLD) {
        pairs.push({
          a: { index: i, text: embeddings[i].text },
          b: { index: j, text: embeddings[j].text },
          score,
        })
      }
    }
  }
  return pairs.sort((a, b) => b.score - a.score)
}
