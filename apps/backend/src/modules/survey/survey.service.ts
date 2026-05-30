import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { generateId, responseRepo, surveyRepo } from '../../repositories/inMemory.js'
import { isTargetSizeFeasible } from '../../domain/reward.js'
import type { Question, Survey } from '../../domain/types.js'
import type { CreateSurveyInput, PublishSurveyInput, UpdateSurveyInput } from './survey.schemas.js'

type QuestionDraft = {
  id?: string
  type: Question['type']
  text: string
  required?: boolean
  choices?: Array<{ id?: string; label: string }>
  jumpTo?: Record<string, string>
}

const buildChoices = (
  source: Array<{ id?: string; label: string }> | undefined,
): Question['choices'] =>
  source?.map((choice) => ({
    id: choice.id ?? generateId('ch'),
    label: choice.label,
  }))

const normalizeQuestion = (input: QuestionDraft): Question => {
  const id = input.id ?? generateId('q')
  const required = input.required ?? true

  if (input.type === 'text') {
    return {
      id,
      type: 'text',
      text: input.text,
      required,
      jumpTo: input.jumpTo,
    }
  }

  if (input.type === 'likert' && (!input.choices || input.choices.length === 0)) {
    return {
      id,
      type: 'likert',
      text: input.text,
      required,
      jumpTo: input.jumpTo,
      choices: buildChoices(
        ['매우 그렇지 않다', '그렇지 않다', '보통', '그렇다', '매우 그렇다'].map((label) => ({
          label,
        })),
      ),
    }
  }

  if (!input.choices || input.choices.length < 2) {
    throw badRequest('Choice questions must have at least two options', { questionId: id })
  }

  return {
    id,
    type: input.type,
    text: input.text,
    required,
    jumpTo: input.jumpTo,
    choices: buildChoices(input.choices),
  }
}

export const createSurvey = (input: CreateSurveyInput): Survey => {
  const now = new Date().toISOString()
  const questions = input.questions.map((question) =>
    normalizeQuestion({ ...question, id: undefined }),
  )

  const survey: Survey = {
    id: generateId('sv'),
    title: input.title,
    category: input.category,
    difficulty: input.difficulty,
    questions,
    status: 'draft',
    locked: false,
    createdAt: now,
    updatedAt: now,
  }

  return surveyRepo.save(survey)
}

export const listSurveys = (): Survey[] => surveyRepo.list()

export const getSurvey = (id: string): Survey => {
  const survey = surveyRepo.get(id)
  if (!survey) {
    throw notFound('Survey', id)
  }
  return survey
}

export const updateSurvey = (id: string, input: UpdateSurveyInput): Survey => {
  const survey = getSurvey(id)

  if (survey.locked && input.questions) {
    throw conflict('This survey is locked; only text-only edits are allowed after publish')
  }

  const next: Survey = {
    ...survey,
    title: input.title ?? survey.title,
    category: input.category ?? survey.category,
    difficulty: input.difficulty ?? survey.difficulty,
    questions: input.questions
      ? input.questions.map((q) => normalizeQuestion({ ...q, id: undefined }))
      : survey.questions,
    updatedAt: new Date().toISOString(),
  }

  return surveyRepo.save(next)
}

export const publishSurvey = (id: string, input: PublishSurveyInput): Survey => {
  const survey = getSurvey(id)

  if (survey.status === 'live') {
    throw conflict('Survey is already live')
  }

  if (!isTargetSizeFeasible(input.estimatedReach)) {
    throw badRequest('Target audience is too small (<50)', {
      estimatedReach: input.estimatedReach,
    })
  }

  const startAt = input.startAt ?? new Date().toISOString()
  const next: Survey = {
    ...survey,
    status: 'live',
    locked: true,
    deployment: {
      pointsPerUser: input.pointsPerUser,
      targetCount: input.targetCount,
      targeting: input.targeting,
      startAt,
      endAt: input.endAt,
    },
    updatedAt: new Date().toISOString(),
  }

  return surveyRepo.save(next)
}

export const closeSurvey = (id: string): Survey => {
  const survey = getSurvey(id)
  const next: Survey = {
    ...survey,
    status: 'done',
    updatedAt: new Date().toISOString(),
  }
  return surveyRepo.save(next)
}

export const assertCanModifyStructure = (surveyId: string): void => {
  if (responseRepo.hasAnyAnswers(surveyId)) {
    throw conflict('Survey already has responses; clone it to make structural changes')
  }
}
