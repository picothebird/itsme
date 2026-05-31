import { evaluate, PENALTY_DURATION_MS, type AnswerSample } from '../../domain/abuse.js'
import { applyStreak, applySurveyCompletion } from '../../domain/pet.js'
import { computeReward } from '../../domain/reward.js'
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js'
import {
  dataPieceRepo,
  generateId,
  petRepo,
  responseRepo,
  surveyRepo,
  walletRepo,
} from '../../repositories/inMemory.js'
import type { AnswerRecord, DataPiece, SurveyResponse } from '../../domain/types.js'
import type { StartResponseInput, SubmitAnswerInput } from './response.schemas.js'

const penaltyUntil = new Map<string, number>()

export type AnswerOutcome = {
  response: SurveyResponse
  abuse: {
    level: 'ok' | 'warn' | 'block'
    reasons: string[]
    strikes: number
    blockedUntil?: string
  }
  nextQuestionIndex: number | null
}

const ensureNotPenalized = (pid: string): void => {
  const until = penaltyUntil.get(pid)
  if (until && until > Date.now()) {
    throw forbidden('Panelist is temporarily blocked due to abusive responses')
  }
}

export const startResponse = (input: StartResponseInput): SurveyResponse => {
  ensureNotPenalized(input.pid)

  const survey = surveyRepo.get(input.surveyId)
  if (!survey) {
    throw notFound('Survey', input.surveyId)
  }
  if (survey.status !== 'live') {
    throw conflict('Survey is not currently accepting responses')
  }

  // §7.1 Resume — if an in-progress response already exists for (pid, surveyId), return it
  const existing = responseRepo
    .list()
    .find((r) => r.pid === input.pid && r.surveyId === input.surveyId && r.status === 'in_progress')
  if (existing) {
    return existing
  }

  // §7.7 multi-device — only one active response per panelist; abandon others
  for (const other of responseRepo.list()) {
    if (other.pid === input.pid && other.status === 'in_progress') {
      responseRepo.save({ ...other, status: 'abandoned', completedAt: new Date().toISOString() })
    }
  }

  const response: SurveyResponse = {
    id: generateId('res'),
    pid: input.pid,
    surveyId: input.surveyId,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    strikes: 0,
    answers: [],
  }

  return responseRepo.save(response)
}

export const getActiveResponse = (
  pid: string,
  surveyId: string,
): { response: SurveyResponse; nextQuestionIndex: number } | null => {
  const survey = surveyRepo.get(surveyId)
  if (!survey) {
    throw notFound('Survey', surveyId)
  }
  const active = responseRepo
    .list()
    .find((r) => r.pid === pid && r.surveyId === surveyId && r.status === 'in_progress')
  if (!active) return null
  const nextQuestionIndex = Math.min(active.answers.length, survey.questions.length - 1)
  return { response: active, nextQuestionIndex }
}

export const submitAnswer = (responseId: string, input: SubmitAnswerInput): AnswerOutcome => {
  const response = responseRepo.get(responseId)
  if (!response) {
    throw notFound('Response', responseId)
  }
  if (response.status !== 'in_progress') {
    throw conflict('Response is no longer in progress')
  }

  ensureNotPenalized(response.pid)

  const survey = surveyRepo.get(response.surveyId)
  if (!survey) {
    throw notFound('Survey', response.surveyId)
  }

  const questionIndex = survey.questions.findIndex((q) => q.id === input.questionId)
  if (questionIndex < 0) {
    throw badRequest('Question not part of this survey', { questionId: input.questionId })
  }

  const question = survey.questions[questionIndex]
  const selectedIndex =
    input.selectedChoiceIds.length > 0 && question.choices
      ? question.choices.findIndex((choice) => choice.id === input.selectedChoiceIds[0])
      : null

  const sample: AnswerSample = {
    questionIndex,
    selectedIndex: selectedIndex !== null && selectedIndex >= 0 ? selectedIndex : null,
    latencyMs: input.latencyMs,
    questionTextLength: question.text.length,
  }

  const history: AnswerSample[] = response.answers.map((answer) => ({
    questionIndex: answer.questionIndex,
    selectedIndex: answer.selectedIndex,
    latencyMs: answer.latencyMs,
    questionTextLength: answer.questionTextLength,
  }))

  const outcome = evaluate({ history, sample, currentStrikes: response.strikes })

  const answerRecord: AnswerRecord = {
    questionId: question.id,
    questionIndex,
    selectedChoiceIds: input.selectedChoiceIds,
    selectedIndex:
      sample.selectedIndex !== null && sample.selectedIndex >= 0 ? sample.selectedIndex : null,
    textValue: input.textValue,
    latencyMs: input.latencyMs,
    questionTextLength: question.text.length,
    receivedAt: new Date().toISOString(),
  }

  const nextAnswers = [...response.answers, answerRecord]
  let nextResponse: SurveyResponse = {
    ...response,
    answers: nextAnswers,
    strikes: outcome.newStrikes,
  }

  let blockedUntil: string | undefined

  if (outcome.level === 'block') {
    const until = Date.now() + PENALTY_DURATION_MS
    penaltyUntil.set(response.pid, until)
    blockedUntil = new Date(until).toISOString()
    nextResponse = { ...nextResponse, status: 'blocked' }

    const pet = petRepo.get(response.pid)
    petRepo.save({ ...pet, sick: true })
  }

  responseRepo.save(nextResponse)

  const nextQuestionIndex =
    nextResponse.status === 'blocked' || questionIndex + 1 >= survey.questions.length
      ? null
      : questionIndex + 1

  return {
    response: nextResponse,
    abuse: {
      level: outcome.level,
      reasons: outcome.reasons,
      strikes: outcome.newStrikes,
      blockedUntil,
    },
    nextQuestionIndex,
  }
}

export type CompletionOutcome = {
  response: SurveyResponse
  pointsAwarded: number
  pet: {
    exp: number
    level: number
    evolutionStage: string | null
    /** EXP gained by this completion (growth track delta). */
    expGained: number
    /** Pet level before this completion. */
    prevLevel: number
    /** Whether this completion raised the pet's level. */
    leveledUp: boolean
    /** Consecutive-day participation streak after this completion. */
    streak: number
  }
  dataPiece: DataPiece | null
}

export const completeResponse = (responseId: string): CompletionOutcome => {
  const response = responseRepo.get(responseId)
  if (!response) {
    throw notFound('Response', responseId)
  }
  if (response.status === 'blocked') {
    throw forbidden('Response was blocked and cannot be completed')
  }
  if (response.status === 'completed') {
    return alreadyCompletedOutcome(response)
  }

  const survey = surveyRepo.get(response.surveyId)
  if (!survey) {
    throw notFound('Survey', response.surveyId)
  }
  if (!survey.deployment) {
    throw conflict('Survey has no active deployment')
  }
  if (response.answers.length !== survey.questions.length) {
    throw badRequest('All questions must be answered before completion', {
      answered: response.answers.length,
      total: survey.questions.length,
    })
  }

  const completedResponse: SurveyResponse = {
    ...response,
    status: 'completed',
    completedAt: new Date().toISOString(),
  }
  responseRepo.save(completedResponse)

  const pointsAwarded = computeReward({
    questionCount: survey.questions.length,
    pointsPerUser: survey.deployment.pointsPerUser,
  })
  walletRepo.credit(response.pid, pointsAwarded, 'earn', response.id)

  const pet = petRepo.get(response.pid)
  const prevLevel = pet.level
  const prevExp = pet.exp
  const nextPet = applySurveyCompletion(
    {
      exp: pet.exp,
      level: pet.level,
      tagVector: pet.tagVector,
      evolutionStage: pet.evolutionStage,
    },
    {
      questionCount: survey.questions.length,
      difficulty: survey.difficulty,
      tag: survey.category,
    },
  )
  petRepo.save({ ...pet, ...nextPet, sick: false })

  // §정령 연속 참여 스트릭 — 완료일 기준 갱신
  const today = new Date().toISOString().slice(0, 10)
  const streakNext = applyStreak({ streak: pet.streak, lastActiveDay: pet.lastActiveDay }, today)
  petRepo.save({
    ...petRepo.get(response.pid),
    streak: streakNext.streak,
    lastActiveDay: streakNext.lastActiveDay,
  })

  // §5.2.7 Create one DataPiece per completed response (idempotent by responseId)
  let dataPiece: DataPiece | null = null
  if (!dataPieceRepo.existsForResponse(response.id)) {
    dataPiece = dataPieceRepo.save({
      id: generateId('dp'),
      pid: response.pid,
      surveyId: response.surveyId,
      responseId: response.id,
      categoryTag: survey.category,
      bonusExp: Math.min(40, Math.max(10, survey.questions.length * 3)),
      createdAt: new Date().toISOString(),
    })
  }

  return {
    response: completedResponse,
    pointsAwarded,
    pet: {
      exp: nextPet.exp,
      level: nextPet.level,
      evolutionStage: nextPet.evolutionStage,
      expGained: nextPet.exp - prevExp,
      prevLevel,
      leveledUp: nextPet.level > prevLevel,
      streak: streakNext.streak,
    },
    dataPiece,
  }
}

const alreadyCompletedOutcome = (response: SurveyResponse): CompletionOutcome => {
  const pet = petRepo.get(response.pid)
  return {
    response,
    pointsAwarded: 0,
    pet: {
      exp: pet.exp,
      level: pet.level,
      evolutionStage: pet.evolutionStage,
      expGained: 0,
      prevLevel: pet.level,
      leveledUp: false,
      streak: pet.streak,
    },
    dataPiece: null,
  }
}

export const __testing = {
  clearPenalties: (): void => penaltyUntil.clear(),
}
