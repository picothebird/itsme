const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

const TOKEN_KEY = 'itsme.session'

let authToken: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

export const setAuthToken = (token: string | null): void => {
  authToken = token
  if (typeof localStorage === 'undefined') return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export const getAuthToken = (): string | null => authToken

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
  pet: {
    exp: number
    level: number
    evolutionStage: string | null
    sick: boolean
    streak: number
    lastActiveDay: string | null
  }
}

export type DataPiece = {
  id: string
  pid: string
  surveyId: string
  responseId: string
  categoryTag: string
  bonusExp: number
  createdAt: string
  consumedAt?: string
}

export type Account = {
  pid: string
  provider: 'kakao' | 'apple' | 'google'
  displayName: string | null
  birthYear: number | null
  gender: 'male' | 'female' | 'unspecified' | null
  interests: string[]
  onboarded: boolean
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

/**
 * "나를 이해하는 AI" 대화를 SSE로 받아 토큰이 도착할 때마다 onDelta를 호출한다.
 * AbortSignal로 중단할 수 있다.
 */
export const streamChat = async (input: {
  pid: string
  messages: ChatMessage[]
  onDelta: (delta: string) => void
  signal?: AbortSignal
}): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ pid: input.pid, messages: input.messages }),
    signal: input.signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(`대화를 시작할 수 없어요 (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const block of events) {
      const lines = block.split('\n')
      let isError = false
      const dataParts: string[] = []
      for (const line of lines) {
        if (line.startsWith('event:') && line.slice(6).trim() === 'error') isError = true
        else if (line.startsWith('data:')) dataParts.push(line.slice(5).trimStart())
      }
      const data = dataParts.join('\n')
      if (!data) continue
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data) as { delta?: string; message?: string }
        if (isError) throw new Error(parsed.message ?? '대화 중 오류가 발생했어요')
        if (parsed.delta) input.onDelta(parsed.delta)
      } catch (err) {
        if (isError) throw err
        // 파싱 불가한 라인은 무시
      }
    }
  }
}

/** itsme.md(개인 데이터 요약 마크다운)를 내려받아 브라우저 다운로드를 트리거한다. */
export const downloadItsme = async (pid: string): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/ai/itsme/${encodeURIComponent(pid)}`, {
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  })
  if (!response.ok) {
    throw new Error(`파일을 내보낼 수 없어요 (${response.status})`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'itsme.md'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  auth: {
    login: (input: {
      provider: 'kakao' | 'apple' | 'google'
      providerUserId: string
      displayName?: string
    }) =>
      request<{
        token: string
        isNew: boolean
        nextStep: 'home' | 'onboarding'
        account: Account
      }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    onboarding: (input: {
      birthYear: number
      gender: 'male' | 'female' | 'unspecified'
      interests: string[]
    }) =>
      request<{ account: Account; pet: PanelistSummary['pet']; welcomeBonus: number }>(
        '/auth/onboarding',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    me: () =>
      request<{
        account: Account
        wallet: { balance: number }
        pet: PanelistSummary['pet']
      }>('/auth/me'),
    logout: () => request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),
  },
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
    input: {
      pointsPerUser: number
      targetCount: number
      estimatedReach: number
      targeting?: Targeting
    },
  ) =>
    request<Survey>(`/surveys/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  closeSurvey: (id: string) =>
    request<Survey>(`/surveys/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  listFeed: async () => {
    const data = await request<{ items: FeedCard[]; nextCursor: string | null }>('/feed')
    return data.items
  },
  startResponse: (input: { pid: string; surveyId: string }) =>
    request<{ id: string }>('/responses/start', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getActiveResponse: (pid: string, surveyId: string) =>
    request<{
      response: { id: string; surveyId: string; status: string }
      nextQuestionIndex: number
    } | null>(
      `/responses/active?pid=${encodeURIComponent(pid)}&surveyId=${encodeURIComponent(surveyId)}`,
    ),
  submitAnswer: (
    responseId: string,
    input: { questionId: string; selectedChoiceIds: string[]; latencyMs: number },
  ) =>
    request<{
      abuse: {
        level: 'ok' | 'warn' | 'block'
        reasons: string[]
        strikes: number
        blockedUntil?: string
      }
      nextQuestionIndex: number | null
    }>(`/responses/${responseId}/answer`, {
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
  dataPieces: (pid: string) =>
    request<{ pending: DataPiece[]; consumed: DataPiece[]; autoConsumed: number }>(
      `/panel/me/data-pieces?pid=${encodeURIComponent(pid)}`,
    ),
  feedPiece: (input: { pid: string; pieceId: string }) =>
    request<{
      piece: DataPiece
      pet: { exp: number; level: number; evolutionStage: string | null }
      leveledUp: boolean
      evolved: boolean
    }>('/panel/me/feed', { method: 'POST', body: JSON.stringify(input) }),
  resetDemo: () =>
    request<{ cleared: boolean }>('/dev/reset', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  ai: {
    generateDraft: (input: {
      brief: {
        objective: string
        audience?: string
        category?: string
        desiredCount?: number
        tone?: 'neutral' | 'friendly' | 'professional'
      }
      title?: string
    }) =>
      request<{
        surveyId: string
        title: string
        questions: Survey['questions']
        keywords: string[]
        providerName: string
      }>('/ai/drafts', { method: 'POST', body: JSON.stringify(input) }),
    runAudit: (surveyId: string) =>
      request<AuditResult>('/ai/audits', {
        method: 'POST',
        body: JSON.stringify({ surveyId }),
      }),
    applyFix: (sessionId: string, findingId: string) =>
      request<{
        sessionId: string
        surveyId: string
        appliedFindingId: string
        questions: Survey['questions']
        remaining: AuditFinding[]
        summary: AuditSummary
      }>(`/ai/audits/${sessionId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ findingId }),
      }),
  },
  analytics: {
    dashboardSummary: () => request<DashboardSummary>('/analytics/dashboard/summary'),
    survey: (surveyId: string) => request<SurveyAnalytics>(`/analytics/surveys/${surveyId}`),
    exportCsvUrl: (surveyId: string) => `${apiBaseUrl}/analytics/surveys/${surveyId}/export.csv`,
    estimateReach: (targeting: Targeting) =>
      request<ReachEstimate>('/analytics/estimate-reach', {
        method: 'POST',
        body: JSON.stringify({ targeting }),
      }),
  },
  wallet: {
    catalog: () => request<RewardItem[]>('/wallet/catalog'),
    me: (pid: string) =>
      request<{ pid: string; balance: number; transactions: WalletTxn[] }>(
        `/wallet/me?pid=${encodeURIComponent(pid)}`,
      ),
    orders: (pid: string) =>
      request<RewardOrder[]>(`/wallet/me/orders?pid=${encodeURIComponent(pid)}`),
    redeem: (input: { pid: string; itemId: string; idempotencyKey: string }) =>
      request<{ order: RewardOrder; idempotent: boolean }>('/wallet/redeem', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  },
  research: {
    studies: () => request<ManagedStudy[]>('/research/studies'),
    study: (id: string) => request<ManagedStudy>(`/research/studies/${id}`),
    apply: (input: {
      pid: string
      studyId: string
      screenerAnswers?: Array<{ questionId: string; answer: string }>
    }) =>
      request<Application>('/research/applications', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    myApplications: (pid: string) =>
      request<ApplicationWithStudy[]>(`/research/applications/me?pid=${encodeURIComponent(pid)}`),
    applicants: (studyId: string) =>
      request<Application[]>(`/research/studies/${studyId}/applications`),
    transition: (
      applicationId: string,
      input: { to: ApplicationStatus; note?: string; scheduledAt?: string },
    ) =>
      request<Application>(`/research/applications/${applicationId}/transition`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  },
  semantic: {
    search: (q: string, limit?: number) =>
      request<{ query: string; results: ScoredSurvey[] }>(
        `/semantic/search?q=${encodeURIComponent(q)}${limit ? `&limit=${limit}` : ''}`,
      ),
    similar: (surveyId: string, limit?: number) =>
      request<{ surveyId: string; neighbors: SurveyEdge[] }>(
        `/semantic/surveys/${surveyId}/similar${limit ? `?limit=${limit}` : ''}`,
      ),
    duplicates: (surveyId: string) =>
      request<{ surveyId: string; duplicates: DuplicatePair[] }>(
        `/semantic/surveys/${surveyId}/duplicates`,
      ),
  },
}

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

export type ManagedStudyType = 'interview' | 'usability' | 'diary'

export type ManagedStudy = {
  id: string
  title: string
  category: string
  type: ManagedStudyType
  summary: string
  incentivePoints: number
  estimatedMinutes: number
  capacity: number
  status: 'open' | 'closed'
  screener: Array<{ id: string; text: string }>
  createdAt: string
}

export type ApplicationStatus =
  | 'applied'
  | 'screening'
  | 'review'
  | 'selected'
  | 'rejected'
  | 'scheduled'
  | 'in_session'
  | 'completed'
  | 'paid'

export type Application = {
  id: string
  pid: string
  studyId: string
  status: ApplicationStatus
  screenerAnswers: Array<{ questionId: string; answer: string }>
  scheduledAt?: string
  history: Array<{ status: ApplicationStatus; note?: string; at: string }>
  createdAt: string
  updatedAt: string
}

export type ApplicationWithStudy = Application & { study: ManagedStudy | null }

export type RewardItem = {
  id: string
  label: string
  vendor: 'naverpay' | 'starbucks' | 'cu'
  cost: number
}

export type WalletTxn = {
  id: string
  type: 'grant' | 'spend' | 'penalty'
  amount: number
  refId?: string
  createdAt: string
}

export type RewardOrder = {
  id: string
  pid: string
  itemId: string
  itemLabel: string
  cost: number
  status: 'pending' | 'issued' | 'failed' | 'refunded'
  voucherCode?: string
  failureReason?: string
  createdAt: string
  updatedAt: string
}

export type AuditSeverity = 'info' | 'warn' | 'high'

export type AuditFinding = {
  id: string
  questionId: string
  questionIndex: number
  rule:
    | 'leading'
    | 'double_barreled'
    | 'contradiction'
    | 'jargon'
    | 'too_long'
    | 'duplicate'
    | 'missing_choices'
  severity: AuditSeverity
  message: string
  suggestion?: string
  fix?: { text: string }
}

export type AuditSummary = {
  total: number
  high: number
  warn: number
  info: number
  score: number
}

export type AuditResult = {
  sessionId: string
  surveyId: string
  findings: AuditFinding[]
  summary: AuditSummary
  providerName: string
}

export type Targeting = {
  ageMin?: number
  ageMax?: number
  genders?: Array<'male' | 'female' | 'unspecified'>
  interests?: string[]
}

export type ReachEstimate = {
  reach: number
  feasible: boolean
  reasons: string[]
}

export type DashboardSummary = {
  surveys: { draft: number; live: number; done: number; total: number }
  responses: { started: number; completed: number; blocked: number; completionRate: number }
  spendPoints: number
  estimatedBudget: number
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
  questions: Array<{
    questionId: string
    questionIndex: number
    type: 'single' | 'multi' | 'likert' | 'text'
    text: string
    reached: number
    answered: number
    dropoffRate: number
    averageLatencyMs: number
    choices?: Array<{ choiceId: string; label: string; count: number; ratio: number }>
  }>
}

export const apiBase = apiBaseUrl
