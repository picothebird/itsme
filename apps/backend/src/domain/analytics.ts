import type { Question, Survey, SurveyResponse } from './types.js'

export type QuestionAnalytics = {
  questionId: string
  questionIndex: number
  type: Question['type']
  text: string
  reached: number
  answered: number
  dropoffRate: number
  averageLatencyMs: number
  choices?: Array<{ choiceId: string; label: string; count: number; ratio: number }>
}

export type SurveyAnalytics = {
  surveyId: string
  totals: {
    started: number
    completed: number
    blocked: number
    inProgress: number
    completionRate: number
    abuseRate: number
    averageDurationMs: number
  }
  questions: QuestionAnalytics[]
}

const calcAverage = (xs: number[]): number =>
  xs.length === 0 ? 0 : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)

export const buildSurveyAnalytics = (
  survey: Survey,
  responses: SurveyResponse[],
): SurveyAnalytics => {
  const started = responses.length
  const completed = responses.filter((r) => r.status === 'completed').length
  const blocked = responses.filter((r) => r.status === 'blocked').length
  const inProgress = responses.filter((r) => r.status === 'in_progress').length

  const durations = responses
    .filter((r) => r.status === 'completed' && r.completedAt)
    .map((r) => new Date(r.completedAt!).getTime() - new Date(r.startedAt).getTime())
    .filter((ms) => ms >= 0)

  const totals: SurveyAnalytics['totals'] = {
    started,
    completed,
    blocked,
    inProgress,
    completionRate: started === 0 ? 0 : Math.round((completed / started) * 1000) / 10,
    abuseRate: started === 0 ? 0 : Math.round((blocked / started) * 1000) / 10,
    averageDurationMs: calcAverage(durations),
  }

  // Per-question stats (only counting non-blocked responses for content stats; reach uses all started)
  const questionsAnalytics: QuestionAnalytics[] = survey.questions.map((q, idx) => {
    const reached = responses.filter(
      (r) => r.answers.length > idx || r.answers.some((a) => a.questionIndex === idx),
    ).length
    const answers = responses.flatMap((r) => r.answers.filter((a) => a.questionIndex === idx))
    const answered = answers.length
    const dropoffRate = reached === 0 ? 0 : Math.round(((reached - answered) / reached) * 1000) / 10
    const averageLatencyMs = calcAverage(answers.map((a) => a.latencyMs))

    let choices: QuestionAnalytics['choices']
    if ((q.type === 'single' || q.type === 'multi' || q.type === 'likert') && q.choices) {
      const totalSelections = answers.reduce(
        (sum, a) => sum + Math.max(1, a.selectedChoiceIds.length),
        0,
      )
      choices = q.choices.map((c) => {
        const count = answers.filter((a) => a.selectedChoiceIds.includes(c.id)).length
        return {
          choiceId: c.id,
          label: c.label,
          count,
          ratio: totalSelections === 0 ? 0 : Math.round((count / totalSelections) * 1000) / 10,
        }
      })
    }

    return {
      questionId: q.id,
      questionIndex: idx,
      type: q.type,
      text: q.text,
      reached,
      answered,
      dropoffRate,
      averageLatencyMs,
      choices,
    }
  })

  return {
    surveyId: survey.id,
    totals,
    questions: questionsAnalytics,
  }
}

export type DashboardSummary = {
  surveys: { draft: number; live: number; done: number; total: number }
  responses: { started: number; completed: number; blocked: number; completionRate: number }
  spendPoints: number
  estimatedBudget: number
}

export const buildDashboardSummary = (
  surveys: Survey[],
  responses: SurveyResponse[],
): DashboardSummary => {
  const draft = surveys.filter((s) => s.status === 'draft').length
  const live = surveys.filter((s) => s.status === 'live').length
  const done = surveys.filter((s) => s.status === 'done').length
  const started = responses.length
  const completed = responses.filter((r) => r.status === 'completed').length
  const blocked = responses.filter((r) => r.status === 'blocked').length

  const spendPoints = responses
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => {
      const survey = surveys.find((s) => s.id === r.surveyId)
      return sum + (survey?.deployment?.pointsPerUser ?? 0)
    }, 0)

  const estimatedBudget = surveys
    .filter((s) => s.deployment)
    .reduce(
      (sum, s) => sum + (s.deployment!.pointsPerUser ?? 0) * (s.deployment!.targetCount ?? 0),
      0,
    )

  return {
    surveys: { draft, live, done, total: surveys.length },
    responses: {
      started,
      completed,
      blocked,
      completionRate: started === 0 ? 0 : Math.round((completed / started) * 1000) / 10,
    },
    spendPoints,
    estimatedBudget,
  }
}

export const toCsv = (survey: Survey, responses: SurveyResponse[]): string => {
  const header = [
    'response_id',
    'pid',
    'status',
    'started_at',
    'completed_at',
    'strikes',
    ...survey.questions.map((q, i) => `q${i + 1}_${q.id}`),
  ]
  const lines: string[] = [header.join(',')]

  for (const r of responses) {
    const cells = [
      r.id,
      r.pid,
      r.status,
      r.startedAt,
      r.completedAt ?? '',
      String(r.strikes),
      ...survey.questions.map((q) => {
        const ans = r.answers.find((a) => a.questionId === q.id)
        if (!ans) return ''
        if (ans.textValue) return csvEscape(ans.textValue)
        if (ans.selectedChoiceIds.length > 0) {
          const labels = ans.selectedChoiceIds
            .map((id) => q.choices?.find((c) => c.id === id)?.label ?? id)
            .join('|')
          return csvEscape(labels)
        }
        return ''
      }),
    ]
    lines.push(cells.join(','))
  }
  return lines.join('\n')
}

const csvEscape = (value: string): string => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
