import { z } from 'zod'

export const startResponseSchema = z.object({
  pid: z.string().min(1),
  surveyId: z.string().min(1),
})

export const submitAnswerSchema = z.object({
  questionId: z.string().min(1),
  selectedChoiceIds: z.array(z.string()).default([]),
  textValue: z.string().max(2_000).optional(),
  latencyMs: z
    .number()
    .int()
    .min(0)
    .max(10 * 60 * 1000),
})

export const completeResponseSchema = z.object({})

export type StartResponseInput = z.infer<typeof startResponseSchema>
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>
