export type QuestionType = 'single' | 'multi' | 'likert' | 'text'

export type Choice = {
  id: string
  label: string
}

export type Question = {
  id: string
  type: QuestionType
  text: string
  required: boolean
  choices?: Choice[]
  jumpTo?: Record<string, string>
}

export type Targeting = {
  ageMin?: number
  ageMax?: number
  genders?: Array<'male' | 'female' | 'unspecified'>
  interests?: string[]
}

export type Deployment = {
  pointsPerUser: number
  targetCount: number
  targeting: Targeting
  startAt: string
  endAt?: string
}

export type SurveyStatus = 'draft' | 'live' | 'done'

export type Survey = {
  id: string
  title: string
  category: string
  difficulty: number
  questions: Question[]
  status: SurveyStatus
  deployment?: Deployment
  locked: boolean
  createdAt: string
  updatedAt: string
}

export type AnswerRecord = {
  questionId: string
  questionIndex: number
  selectedChoiceIds: string[]
  selectedIndex: number | null
  textValue?: string
  latencyMs: number
  questionTextLength: number
  receivedAt: string
}

export type ResponseStatus = 'in_progress' | 'completed' | 'blocked'

export type SurveyResponse = {
  id: string
  pid: string
  surveyId: string
  status: ResponseStatus
  startedAt: string
  completedAt?: string
  strikes: number
  answers: AnswerRecord[]
}

export type WalletTransaction = {
  id: string
  pid: string
  type: 'earn' | 'spend' | 'grant'
  amount: number
  refId?: string
  createdAt: string
}

export type Wallet = {
  pid: string
  balance: number
  transactions: WalletTransaction[]
}

export type Pet = {
  pid: string
  exp: number
  level: number
  tagVector: Record<string, number>
  evolutionStage: string | null
  sick: boolean
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
