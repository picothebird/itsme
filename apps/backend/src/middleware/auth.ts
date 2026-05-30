import type { NextFunction, Request, Response } from 'express'

import type { Account } from '../domain/types.js'
import { resolveSession } from '../modules/auth/auth.service.js'

export const bearerToken = (req: Request): string | undefined => {
  const header = req.header('authorization') ?? req.header('Authorization')
  if (!header) return undefined
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined
  return token.trim()
}

/**
 * Hard auth guard. Attaches the resolved account to res.locals.account and
 * throws 401 (via resolveSession) when the bearer token is missing/invalid.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const account = resolveSession(bearerToken(req))
  res.locals.account = account
  next()
}

export const currentAccount = (res: Response): Account => res.locals.account as Account
