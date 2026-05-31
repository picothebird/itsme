import { randomUUID } from 'node:crypto'

import { MANAGED_STUDY_SEED } from '../domain/managedStudies.js'
import type {
  Account,
  Application,
  DataPiece,
  ManagedStudy,
  Pet,
  RewardOrder,
  Session,
  Survey,
  SurveyResponse,
  Wallet,
  WalletTransaction,
} from '../domain/types.js'

const accounts = new Map<string, Account>()
const sessions = new Map<string, Session>()
const surveys = new Map<string, Survey>()
const responses = new Map<string, SurveyResponse>()
const wallets = new Map<string, Wallet>()
const pets = new Map<string, Pet>()
const dataPieces = new Map<string, DataPiece>()
const rewardOrders = new Map<string, RewardOrder>()
const managedStudies = new Map<string, ManagedStudy>()
const applications = new Map<string, Application>()

const seedManagedStudies = (): void => {
  for (const study of MANAGED_STUDY_SEED) {
    managedStudies.set(study.id, { ...study, screener: study.screener.map((s) => ({ ...s })) })
  }
}
seedManagedStudies()

export const generateId = (prefix: string): string => `${prefix}_${randomUUID().slice(0, 12)}`

export const resetStore = (): void => {
  accounts.clear()
  sessions.clear()
  surveys.clear()
  responses.clear()
  wallets.clear()
  pets.clear()
  dataPieces.clear()
  rewardOrders.clear()
  managedStudies.clear()
  applications.clear()
  seedManagedStudies()
}

const providerKey = (provider: Account['provider'], providerUserId: string): string =>
  `${provider}:${providerUserId}`

export const accountRepo = {
  list: (): Account[] => Array.from(accounts.values()),
  get: (pid: string): Account | undefined => accounts.get(pid),
  findByProvider: (provider: Account['provider'], providerUserId: string): Account | undefined =>
    Array.from(accounts.values()).find(
      (a) => providerKey(a.provider, a.providerUserId) === providerKey(provider, providerUserId),
    ),
  save: (account: Account): Account => {
    accounts.set(account.pid, account)
    return account
  },
}

export const sessionRepo = {
  get: (token: string): Session | undefined => sessions.get(token),
  save: (session: Session): Session => {
    sessions.set(session.token, session)
    return session
  },
  delete: (token: string): void => {
    sessions.delete(token)
  },
}

export const surveyRepo = {
  list: (): Survey[] => Array.from(surveys.values()),
  listByStatus: (status: Survey['status']): Survey[] =>
    Array.from(surveys.values()).filter((survey) => survey.status === status),
  get: (id: string): Survey | undefined => surveys.get(id),
  save: (survey: Survey): Survey => {
    surveys.set(survey.id, survey)
    return survey
  },
  delete: (id: string): void => {
    surveys.delete(id)
  },
}

export const responseRepo = {
  list: (): SurveyResponse[] => Array.from(responses.values()),
  listBySurvey: (surveyId: string): SurveyResponse[] =>
    Array.from(responses.values()).filter((response) => response.surveyId === surveyId),
  get: (id: string): SurveyResponse | undefined => responses.get(id),
  save: (response: SurveyResponse): SurveyResponse => {
    responses.set(response.id, response)
    return response
  },
  hasAnyAnswers: (surveyId: string): boolean =>
    Array.from(responses.values()).some(
      (response) => response.surveyId === surveyId && response.answers.length > 0,
    ),
}

const ensureWallet = (pid: string): Wallet => {
  const existing = wallets.get(pid)
  if (existing) {
    return existing
  }
  const created: Wallet = { pid, balance: 0, transactions: [] }
  wallets.set(pid, created)
  return created
}

export const walletRepo = {
  get: (pid: string): Wallet => ensureWallet(pid),
  credit: (
    pid: string,
    amount: number,
    type: WalletTransaction['type'],
    refId?: string,
  ): WalletTransaction => {
    if (amount <= 0) {
      throw new Error('credit amount must be positive')
    }
    const wallet = ensureWallet(pid)
    const txn: WalletTransaction = {
      id: generateId('txn'),
      pid,
      type,
      amount,
      refId,
      createdAt: new Date().toISOString(),
    }
    wallet.balance += amount
    wallet.transactions.unshift(txn)
    return txn
  },
  debit: (pid: string, amount: number, refId?: string): WalletTransaction => {
    if (amount <= 0) {
      throw new Error('debit amount must be positive')
    }
    const wallet = ensureWallet(pid)
    if (wallet.balance < amount) {
      throw new Error('insufficient balance')
    }
    const txn: WalletTransaction = {
      id: generateId('txn'),
      pid,
      type: 'spend',
      amount,
      refId,
      createdAt: new Date().toISOString(),
    }
    wallet.balance -= amount
    wallet.transactions.unshift(txn)
    return txn
  },
}

export const petRepo = {
  get: (pid: string): Pet => {
    const existing = pets.get(pid)
    if (existing) {
      return existing
    }
    const created: Pet = {
      pid,
      exp: 0,
      level: 1,
      tagVector: {},
      evolutionStage: null,
      sick: false,
    }
    pets.set(pid, created)
    return created
  },
  save: (pet: Pet): Pet => {
    pets.set(pet.pid, pet)
    return pet
  },
}

export const dataPieceRepo = {
  list: (): DataPiece[] => Array.from(dataPieces.values()),
  listByPid: (pid: string): DataPiece[] =>
    Array.from(dataPieces.values()).filter((p) => p.pid === pid),
  get: (id: string): DataPiece | undefined => dataPieces.get(id),
  save: (piece: DataPiece): DataPiece => {
    dataPieces.set(piece.id, piece)
    return piece
  },
  existsForResponse: (responseId: string): boolean =>
    Array.from(dataPieces.values()).some((p) => p.responseId === responseId),
}

export const rewardOrderRepo = {
  list: (): RewardOrder[] => Array.from(rewardOrders.values()),
  listByPid: (pid: string): RewardOrder[] =>
    Array.from(rewardOrders.values()).filter((o) => o.pid === pid),
  get: (id: string): RewardOrder | undefined => rewardOrders.get(id),
  findByIdempotencyKey: (pid: string, key: string): RewardOrder | undefined =>
    Array.from(rewardOrders.values()).find((o) => o.pid === pid && o.idempotencyKey === key),
  save: (order: RewardOrder): RewardOrder => {
    rewardOrders.set(order.id, order)
    return order
  },
}

export const managedStudyRepo = {
  list: (): ManagedStudy[] => Array.from(managedStudies.values()),
  listOpen: (): ManagedStudy[] =>
    Array.from(managedStudies.values()).filter((s) => s.status === 'open'),
  get: (id: string): ManagedStudy | undefined => managedStudies.get(id),
  save: (study: ManagedStudy): ManagedStudy => {
    managedStudies.set(study.id, study)
    return study
  },
}

export const applicationRepo = {
  list: (): Application[] => Array.from(applications.values()),
  listByPid: (pid: string): Application[] =>
    Array.from(applications.values()).filter((a) => a.pid === pid),
  listByStudy: (studyId: string): Application[] =>
    Array.from(applications.values()).filter((a) => a.studyId === studyId),
  get: (id: string): Application | undefined => applications.get(id),
  findByPidAndStudy: (pid: string, studyId: string): Application | undefined =>
    Array.from(applications.values()).find((a) => a.pid === pid && a.studyId === studyId),
  save: (application: Application): Application => {
    applications.set(application.id, application)
    return application
  },
}
