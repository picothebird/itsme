import { z } from 'zod'

export const choiceOutSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(120),
})

export const questionOutSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['single', 'multi', 'likert', 'text']),
  text: z.string().min(1).max(400),
  required: z.boolean().optional(),
  choices: z.array(choiceOutSchema).optional(),
})

export const draftOutSchema = z.object({
  questions: z.array(questionOutSchema).min(3).max(15),
  keywords: z.array(z.string()).max(20),
})
