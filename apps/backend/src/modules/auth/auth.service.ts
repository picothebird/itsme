import { randomBytes } from 'node:crypto'

import { accumulateTagVector } from '../../domain/pet.js'
import type { Account, Pet, Session } from '../../domain/types.js'
import { unauthorized } from '../../lib/errors.js'
import {
  accountRepo,
  generateId,
  petRepo,
  sessionRepo,
  walletRepo,
} from '../../repositories/inMemory.js'
import type { LoginInput, OnboardingInput } from './auth.schemas.js'

const WELCOME_POINTS = 500

const mintToken = (): string => `sess_${randomBytes(24).toString('hex')}`

const now = (): string => new Date().toISOString()

/**
 * Find-or-create an account for an upstream OAuth identity, then mint a
 * short-lived session. New accounts start un-onboarded (egg not yet hatched).
 */
export const loginWithProvider = (
  input: LoginInput,
): { account: Account; session: Session; isNew: boolean } => {
  const existing = accountRepo.findByProvider(input.provider, input.providerUserId)
  const account =
    existing ??
    accountRepo.save({
      pid: generateId('pid'),
      provider: input.provider,
      providerUserId: input.providerUserId,
      displayName: input.displayName,
      interests: [],
      onboarded: false,
      createdAt: now(),
      updatedAt: now(),
    })

  // Refresh display name on re-login if newly provided.
  if (existing && input.displayName && input.displayName !== existing.displayName) {
    account.displayName = input.displayName
    account.updatedAt = now()
    accountRepo.save(account)
  }

  const session: Session = {
    token: mintToken(),
    pid: account.pid,
    createdAt: now(),
  }
  sessionRepo.save(session)

  return { account, session, isNew: !existing }
}

/**
 * Resolve the account behind a bearer token. Throws 401 when the token is
 * missing or unknown.
 */
export const resolveSession = (token: string | undefined): Account => {
  if (!token) throw unauthorized()
  const session = sessionRepo.get(token)
  if (!session) throw unauthorized('Session expired or invalid')
  const account = accountRepo.get(session.pid)
  if (!account) throw unauthorized('Account no longer exists')
  return account
}

export const logout = (token: string | undefined): void => {
  if (token) sessionRepo.delete(token)
}

/**
 * Complete onboarding: persist demographics + interests, hatch the pet egg by
 * seeding its tag vector from interests, and grant a welcome bonus once.
 */
export const completeOnboarding = (
  account: Account,
  input: OnboardingInput,
): { account: Account; pet: Pet; welcomeBonus: number } => {
  const firstTime = !account.onboarded

  const updated: Account = {
    ...account,
    birthYear: input.birthYear,
    gender: input.gender,
    interests: input.interests,
    onboarded: true,
    updatedAt: now(),
  }
  accountRepo.save(updated)

  // Hatch the egg: seed the pet's tag vector so feed personalization works
  // from the very first session.
  const pet = petRepo.get(updated.pid)
  let tagVector = pet.tagVector
  for (const interest of input.interests) {
    tagVector = accumulateTagVector(tagVector, interest, 1)
  }
  const hatched = petRepo.save({ ...pet, tagVector })

  let welcomeBonus = 0
  if (firstTime) {
    welcomeBonus = WELCOME_POINTS
    walletRepo.credit(updated.pid, WELCOME_POINTS, 'grant', 'welcome_bonus')
  }

  return { account: updated, pet: hatched, welcomeBonus }
}
