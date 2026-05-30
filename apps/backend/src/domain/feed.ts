import type { Survey, SurveyResponse } from './types.js'

export type FeedCard = {
  id: string
  title: string
  category: string
  questionCount: number
  estimatedTimeSec: number
  pointsPerUser: number
  freshnessHours: number
  priorityScore: number
  alreadyCompleted: boolean
}

const HOUR_MS = 1000 * 60 * 60

const DEFAULT_INTERESTS: Record<string, number> = {
  beauty: 0.7,
  food: 0.7,
  tech: 0.7,
  fitness: 0.7,
  finance: 0.6,
  travel: 0.6,
  general: 0.5,
}

type Panelist = {
  pid: string
  interests?: string[]
}

const targetingMatch = (survey: Survey, panelist: Panelist | null): number => {
  const base = DEFAULT_INTERESTS[survey.category] ?? 0.5
  if (!panelist?.interests || panelist.interests.length === 0) return base
  const overlap = panelist.interests.includes(survey.category) ? 1 : 0
  const targetingOverlap = (survey.deployment?.targeting.interests ?? []).filter((i) =>
    panelist.interests!.includes(i),
  ).length
  return Math.min(1, base + overlap * 0.2 + targetingOverlap * 0.1)
}

const freshnessScore = (survey: Survey, now: number): { hours: number; score: number } => {
  const startedAt = survey.deployment?.startAt
    ? new Date(survey.deployment.startAt).getTime()
    : new Date(survey.createdAt).getTime()
  const hours = Math.max(0, (now - startedAt) / HOUR_MS)
  // exponential decay: 1.0 at start, 0.5 at 24h, ~0.1 at 7 days
  const score = Math.max(0.05, Math.exp(-hours / 36))
  return { hours, score }
}

const deadlineScore = (survey: Survey, now: number): number => {
  if (!survey.deployment?.endAt) return 0.5
  const remainingHours = (new Date(survey.deployment.endAt).getTime() - now) / HOUR_MS
  if (remainingHours <= 0) return 0
  if (remainingHours <= 6) return 1
  if (remainingHours <= 24) return 0.85
  if (remainingHours <= 72) return 0.6
  return 0.4
}

export const buildFeed = (
  surveys: Survey[],
  responses: SurveyResponse[],
  panelist: Panelist | null,
  now: number = Date.now(),
): FeedCard[] => {
  const completedSurveyIds = new Set(
    responses
      .filter((r) => r.pid === panelist?.pid && r.status === 'completed')
      .map((r) => r.surveyId),
  )

  return surveys
    .filter((s) => s.status === 'live')
    .map((survey) => {
      const fresh = freshnessScore(survey, now)
      const target = targetingMatch(survey, panelist)
      const deadline = deadlineScore(survey, now)
      const alreadyCompleted = completedSurveyIds.has(survey.id)
      // weighted: targeting 0.5 · deadline 0.3 · freshness 0.2
      let priority = target * 0.5 + deadline * 0.3 + fresh.score * 0.2
      if (alreadyCompleted) priority *= 0.1
      return {
        id: survey.id,
        title: survey.title,
        category: survey.category,
        questionCount: survey.questions.length,
        estimatedTimeSec: Math.max(20, survey.questions.length * 8),
        pointsPerUser: survey.deployment?.pointsPerUser ?? 0,
        freshnessHours: Math.round(fresh.hours * 10) / 10,
        priorityScore: Math.round(priority * 1000) / 1000,
        alreadyCompleted,
      } satisfies FeedCard
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
}

export type PaginatedFeed = {
  items: FeedCard[]
  nextCursor: string | null
}

export const paginate = (
  items: FeedCard[],
  cursor: string | null | undefined,
  limit: number,
): PaginatedFeed => {
  const startIdx = cursor ? Math.max(0, items.findIndex((i) => i.id === cursor) + 1) : 0
  const slice = items.slice(startIdx, startIdx + limit)
  const nextCursor =
    startIdx + slice.length < items.length && slice.length > 0 ? slice[slice.length - 1].id : null
  return { items: slice, nextCursor }
}
