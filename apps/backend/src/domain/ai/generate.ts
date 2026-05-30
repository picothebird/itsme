import type { Question, QuestionType } from '../types.js'

export type SurveyBrief = {
  objective: string
  audience?: string
  category?: string
  desiredCount?: number
  tone?: 'neutral' | 'friendly' | 'professional'
}

type Slot = {
  type: QuestionType
  text: string
  choices?: string[]
}

const STOPWORDS = new Set([
  '그리고',
  '하지만',
  '그러나',
  '이것은',
  '저것은',
  '관련',
  '대한',
  '대해',
  '있는',
  '있다',
  '하는',
  '하다',
  '되는',
  '되다',
  '위해',
  '통해',
  '대상',
  '이번',
  '저희',
  '우리',
  '입니다',
  '있습니다',
])

export const extractKeywords = (objective: string, limit = 5): string[] => {
  const tokens = objective
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))

  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tokens) {
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= limit) break
  }
  return out
}

const LIKERT_TEMPLATES = [
  (kw: string) => `${kw}에 대해 평소 만족하는 편이다.`,
  (kw: string) => `${kw}는 일상에서 중요한 요소라고 생각한다.`,
  (kw: string) => `${kw}와 관련된 새로운 시도에 적극적으로 참여한다.`,
]

const SINGLE_TEMPLATES: Array<{ text: (kw: string) => string; choices: string[] }> = [
  {
    text: (kw: string) => `${kw}를 가장 자주 이용하는 시간대는 언제인가요?`,
    choices: ['아침', '점심', '저녁', '심야'],
  },
  {
    text: (kw: string) => `${kw}와 관련된 정보를 주로 어디서 얻나요?`,
    choices: ['SNS', '지인 추천', '검색', '오프라인 매장'],
  },
  {
    text: (kw: string) => `${kw}에 한 달에 지출하는 금액은 어느 정도인가요?`,
    choices: ['1만원 미만', '1~5만원', '5~10만원', '10만원 이상'],
  },
]

const MULTI_TEMPLATES: Array<{ text: (kw: string) => string; choices: string[] }> = [
  {
    text: (kw: string) => `${kw}를 선택할 때 고려하는 요소를 모두 선택해 주세요.`,
    choices: ['가격', '품질', '브랜드', '디자인', '리뷰'],
  },
]

const TEXT_TEMPLATES = [
  (kw: string) => `${kw}와 관련해 가장 아쉬웠던 경험을 자유롭게 적어 주세요.`,
  (kw: string) => `${kw}에 바라는 점이 있다면 무엇인가요?`,
]

const SCREENER_TEMPLATES: Array<{ text: string; choices: string[] }> = [
  { text: '최근 1개월 내 관련 활동을 경험한 적이 있나요?', choices: ['예', '아니오'] },
  {
    text: '본 설문 주제에 대해 본인의 의견을 자유롭게 답할 의사가 있나요?',
    choices: ['예', '아니오'],
  },
]

const pickKeyword = (keywords: string[], i: number): string =>
  keywords.length === 0 ? '해당 주제' : keywords[i % keywords.length]

export const planSlots = (brief: SurveyBrief): Slot[] => {
  const count = Math.min(12, Math.max(5, brief.desiredCount ?? 8))
  const keywords = extractKeywords(brief.objective)

  const slots: Slot[] = []

  // 1. screener (single, yes/no)
  const screener = SCREENER_TEMPLATES[0]
  slots.push({ type: 'single', text: screener.text, choices: screener.choices })

  // 2. demographic-style single (frequency)
  const single0 = SINGLE_TEMPLATES[0]
  slots.push({
    type: 'single',
    text: single0.text(pickKeyword(keywords, 0)),
    choices: single0.choices,
  })

  // 3..(count-2): mix likert / single / multi
  let kwIdx = 1
  for (let i = slots.length; i < count - 1; i++) {
    const mod = i % 4
    if (mod === 0) {
      const t = LIKERT_TEMPLATES[i % LIKERT_TEMPLATES.length]
      slots.push({ type: 'likert', text: t(pickKeyword(keywords, kwIdx++)) })
    } else if (mod === 1) {
      const t = SINGLE_TEMPLATES[(i + 1) % SINGLE_TEMPLATES.length]
      slots.push({
        type: 'single',
        text: t.text(pickKeyword(keywords, kwIdx++)),
        choices: t.choices,
      })
    } else if (mod === 2) {
      const t = MULTI_TEMPLATES[0]
      slots.push({
        type: 'multi',
        text: t.text(pickKeyword(keywords, kwIdx++)),
        choices: t.choices,
      })
    } else {
      const t = LIKERT_TEMPLATES[(i + 2) % LIKERT_TEMPLATES.length]
      slots.push({ type: 'likert', text: t(pickKeyword(keywords, kwIdx++)) })
    }
  }

  // Last: open-ended text
  const tail = TEXT_TEMPLATES[0]
  slots.push({ type: 'text', text: tail(pickKeyword(keywords, kwIdx)) })

  return slots
}

export type DraftQuestion = Omit<Question, 'id' | 'choices' | 'required'> & {
  required?: boolean
  choices?: Array<{ label: string }>
}

export const slotsToDraft = (slots: Slot[]): DraftQuestion[] =>
  slots.map((s) => ({
    type: s.type,
    text: s.text,
    required: true,
    choices: s.choices ? s.choices.map((label) => ({ label })) : undefined,
  }))

export const generateDraft = (
  brief: SurveyBrief,
): { questions: DraftQuestion[]; keywords: string[] } => {
  const keywords = extractKeywords(brief.objective)
  const questions = slotsToDraft(planSlots(brief))
  return { questions, keywords }
}
