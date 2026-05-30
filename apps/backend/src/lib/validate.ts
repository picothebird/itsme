import type { ZodType } from 'zod'

import { badRequest } from './errors.js'

export const parseOrThrow = <T>(schema: ZodType<T>, input: unknown, label = 'payload'): T => {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw badRequest(`Invalid ${label}`, result.error.flatten())
  }
  return result.data
}
