import { Router } from 'express'

import { asyncHandler } from '../../lib/asyncHandler.js'
import { parseOrThrow } from '../../lib/validate.js'
import { petRepo, walletRepo } from '../../repositories/inMemory.js'
import { bearerToken, requireAuth, currentAccount } from '../../middleware/auth.js'
import { loginSchema, onboardingSchema } from './auth.schemas.js'
import { completeOnboarding, loginWithProvider, logout } from './auth.service.js'

export const authRouter = Router()

const publicAccount = (account: ReturnType<typeof currentAccount>) => ({
  pid: account.pid,
  provider: account.provider,
  displayName: account.displayName ?? null,
  birthYear: account.birthYear ?? null,
  gender: account.gender ?? null,
  interests: account.interests,
  onboarded: account.onboarded,
})

authRouter.post(
  '/login',
  asyncHandler((req, res) => {
    const input = parseOrThrow(loginSchema, req.body, 'login')
    const { account, session, isNew } = loginWithProvider(input)
    res.status(isNew ? 201 : 200).json({
      ok: true,
      data: {
        token: session.token,
        isNew,
        nextStep: account.onboarded ? 'home' : 'onboarding',
        account: publicAccount(account),
      },
    })
  }),
)

authRouter.post(
  '/onboarding',
  requireAuth,
  asyncHandler((req, res) => {
    const input = parseOrThrow(onboardingSchema, req.body, 'onboarding')
    const account = currentAccount(res)
    const { account: updated, pet, welcomeBonus } = completeOnboarding(account, input)
    res.json({
      ok: true,
      data: {
        account: publicAccount(updated),
        pet,
        welcomeBonus,
      },
    })
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler((_req, res) => {
    const account = currentAccount(res)
    res.json({
      ok: true,
      data: {
        account: publicAccount(account),
        wallet: walletRepo.get(account.pid),
        pet: petRepo.get(account.pid),
      },
    })
  }),
)

authRouter.post(
  '/logout',
  asyncHandler((req, res) => {
    logout(bearerToken(req))
    res.json({ ok: true, data: { loggedOut: true } })
  }),
)
