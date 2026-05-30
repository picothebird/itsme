import { z } from 'zod'

export const estimateReachSchema = z.object({
  targeting: z
    .object({
      ageMin: z.number().int().min(13).max(99).optional(),
      ageMax: z.number().int().min(13).max(99).optional(),
      genders: z.array(z.enum(['male', 'female', 'unspecified'])).optional(),
      interests: z.array(z.string().min(1).max(20)).optional(),
    })
    .optional(),
})

export type EstimateReachInput = z.infer<typeof estimateReachSchema>
