import { z } from 'zod'

export const choiceSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(120),
})

export const questionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['single', 'multi', 'likert', 'text']),
  text: z.string().min(1).max(400),
  required: z.boolean().default(true),
  choices: z.array(choiceSchema).optional(),
  jumpTo: z.record(z.string(), z.string()).optional(),
})

export const createSurveySchema = z.object({
  title: z.string().min(1).max(120),
  category: z.string().min(1).max(40),
  difficulty: z.number().int().min(1).max(5).default(1),
  questions: z.array(questionSchema).min(1).max(40),
})

export const updateSurveySchema = z.object({
  title: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(40).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  questions: z.array(questionSchema).min(1).max(40).optional(),
})

export const targetingSchema = z.object({
  ageMin: z.number().int().min(13).max(99).optional(),
  ageMax: z.number().int().min(13).max(99).optional(),
  genders: z.array(z.enum(['male', 'female', 'unspecified'])).optional(),
  interests: z.array(z.string().min(1).max(20)).optional(),
})

export const publishSurveySchema = z.object({
  pointsPerUser: z.number().int().min(1).max(100_000),
  targetCount: z.number().int().min(1).max(100_000),
  targeting: targetingSchema.default({}),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  estimatedReach: z.number().int().min(0).default(1_000),
})

export type CreateSurveyInput = z.infer<typeof createSurveySchema>
export type UpdateSurveyInput = z.infer<typeof updateSurveySchema>
export type PublishSurveyInput = z.infer<typeof publishSurveySchema>
