import { z } from 'zod'

export const briefSchema = z.object({
  objective: z.string().min(4).max(400),
  audience: z.string().max(120).optional(),
  category: z.string().max(40).optional(),
  desiredCount: z.number().int().min(5).max(12).optional(),
  tone: z.enum(['neutral', 'friendly', 'professional']).optional(),
})

export const generateDraftSchema = z.object({
  brief: briefSchema,
  title: z.string().min(1).max(120).optional(),
})

export const auditSurveySchema = z.object({
  surveyId: z.string().min(1),
})

export const applyFixSchema = z.object({
  findingId: z.string().min(1),
})

export type GenerateDraftInput = z.infer<typeof generateDraftSchema>
export type AuditSurveyInput = z.infer<typeof auditSurveySchema>
export type ApplyFixInput = z.infer<typeof applyFixSchema>
