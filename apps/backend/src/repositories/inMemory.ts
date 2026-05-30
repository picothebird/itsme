import { randomUUID } from 'node:crypto'

import type {
  DataPiece,
  Pet,
  RewardOrder,
  Survey,
  SurveyResponse,
  Wallet,
  WalletTransaction,
} from '../domain/types.js'

const surveys = new Map<string, Survey>()
const responses = new Map<string, SurveyResponse>()
const wallets = new Map<string, Wallet>()
const pets = new Map<string, Pet>()
const dataPieces = new Map<string, DataPiece>()
const rewardOrders = new Map<string, RewardOrder>()

export const generateId = (prefix: string): string => `${prefix}_${randomUUID().slice(0, 12)}`

export const resetStore = (): void => {
  surveys.clear()
  responses.clear()
  wallets.clear()
  pets.clear()
  dataPieces.clear()
  rewardOrders.clear()
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
