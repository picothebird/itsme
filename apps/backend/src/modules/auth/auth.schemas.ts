import { z } from 'zod'

export const PROVIDERS = ['kakao', 'apple', 'google'] as const

export const loginSchema = z.object({
  provider: z.enum(PROVIDERS),
  // In production this is the OAuth authorization code / id_token verified
  // against the provider. For the MVP it identifies the upstream user.
  providerUserId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(60).optional(),
})

export type LoginInput = z.infer<typeof loginSchema>

const currentYear = new Date().getFullYear()

export const onboardingSchema = z.object({
  birthYear: z
    .number()
    .int()
    .min(1900)
    .max(currentYear - 13), // panelists must be 14+
  gender: z.enum(['male', 'female', 'unspecified']),
  interests: z.array(z.string().min(1).max(40)).min(1).max(12),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>
