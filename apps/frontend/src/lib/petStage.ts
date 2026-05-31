import type { PetCreatureStage } from '../features/PetCreature'

/** 레벨로 정령 진화 단계를 파생한다. (백엔드 evolutionStage는 Lv.10에서 확정) */
export function creatureStageFromLevel(level: number): PetCreatureStage {
  if (level >= 10) return 'adult'
  if (level >= 4) return 'baby'
  return 'egg'
}
