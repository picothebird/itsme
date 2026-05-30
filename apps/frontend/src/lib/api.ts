const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export type Survey = {
  id: string
  title: string
  category: string
  difficulty: number
  status: 'draft' | 'live' | 'done'
  questions: Array<{
    id: string
    type: 'single' | 'multi' | 'likert' | 'text'
    text: string
    choices?: Array<{ id: string; label: string }>
  }>
  deployment?: {
    pointsPerUser: number
    targetCount: number
  }
}

export type FeedCard = {
  id: string
  title: string
  category: string
  questionCount: number
  estimatedTimeSec: number
  pointsPerUser: number
}

export type PanelistSummary = {
  pid: string
  wallet: { balance: number }
  pet: { exp: number; level: number; evolutionStage: string | null; sick: boolean }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const body = (await response.json()) as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } }

  if (!response.ok || body.ok !== true) {
    const message = body.ok === false ? body.error.message : `Request failed (${response.status})`
    throw new Error(message)
  }

  return body.data
}

export const api = {
  listSurveys: () => request<Survey[]>('/surveys'),
  createSurvey: (input: {
    title: string
    category: string
    difficulty?: number
    questions: Array<{
      type: 'single' | 'multi' | 'likert' | 'text'
      text: string
      choices?: Array<{ label: string }>
    }>
  }) =>
    request<Survey>('/surveys', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  publishSurvey: (
    id: string,
    input: { pointsPerUser: number; targetCount: number; estimatedReach: number },
  ) =>
    request<Survey>(`/surveys/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listFeed: () => request<FeedCard[]>('/feed'),
  startResponse: (input: { pid: string; surveyId: string }) =>
    request<{ id: string }>('/responses/start', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  submitAnswer: (
    responseId: string,
    input: { questionId: string; selectedChoiceIds: string[]; latencyMs: number },
  ) =>
    request<{ abuse: { level: string; strikes: number } }>(`/responses/${responseId}/answer`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  completeResponse: (responseId: string) =>
    request<{
      pointsAwarded: number
      pet: { exp: number; level: number; evolutionStage: string | null }
    }>(`/responses/${responseId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  panelistSummary: (pid: string) =>
    request<PanelistSummary>(`/panel/me?pid=${encodeURIComponent(pid)}`),
}

export const apiBase = apiBaseUrl
