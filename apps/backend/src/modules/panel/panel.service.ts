import { feedDataPiece } from '../../domain/pet.js'
import { dataPieceRepo, petRepo } from '../../repositories/inMemory.js'
import type { DataPiece } from '../../domain/types.js'

export const STALE_PIECE_MS = 24 * 60 * 60 * 1000

export type StaleSweepResult = {
  consumed: DataPiece[]
  pet: { exp: number; level: number; evolutionStage: string | null } | null
}

/**
 * §7.8 — auto-consume data pieces that have been pending for > 24h, with
 * reduced bonus (half) since the panelist missed the discretionary feed window.
 */
export const sweepStalePieces = (pid: string, now: number = Date.now()): StaleSweepResult => {
  const stalePieces = dataPieceRepo
    .listByPid(pid)
    .filter((p) => !p.consumedAt && now - Date.parse(p.createdAt) > STALE_PIECE_MS)

  if (stalePieces.length === 0) return { consumed: [], pet: null }

  const pet = petRepo.get(pid)
  let mutation = {
    exp: pet.exp,
    level: pet.level,
    tagVector: pet.tagVector,
    evolutionStage: pet.evolutionStage,
  }
  const consumed: DataPiece[] = []
  const isoNow = new Date(now).toISOString()
  for (const piece of stalePieces) {
    const next = feedDataPiece(mutation, {
      bonusExp: Math.max(1, Math.floor(piece.bonusExp / 2)),
      tag: piece.categoryTag,
    })
    mutation = {
      exp: next.exp,
      level: next.level,
      tagVector: next.tagVector,
      evolutionStage: next.evolutionStage,
    }
    const saved = dataPieceRepo.save({ ...piece, consumedAt: isoNow })
    consumed.push(saved)
  }
  petRepo.save({ ...pet, ...mutation })

  return {
    consumed,
    pet: { exp: mutation.exp, level: mutation.level, evolutionStage: mutation.evolutionStage },
  }
}
