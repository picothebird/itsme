import { generateDraft, type DraftQuestion, type SurveyBrief } from '../../domain/ai/generate.js'
import { auditQuestions, type AuditFinding } from '../../domain/ai/audit.js'
import type { Question } from '../../domain/types.js'

export type AiProvider = {
  name: string
  generate: (brief: SurveyBrief) => Promise<{ questions: DraftQuestion[]; keywords: string[] }>
  audit: (questions: Question[]) => Promise<AuditFinding[]>
}

export const heuristicProvider: AiProvider = {
  name: 'heuristic',
  generate: async (brief) => generateDraft(brief),
  audit: async (questions) => auditQuestions(questions),
}

let activeProvider: AiProvider = heuristicProvider

export const setAiProvider = (provider: AiProvider): void => {
  activeProvider = provider
}

export const getAiProvider = (): AiProvider => activeProvider
