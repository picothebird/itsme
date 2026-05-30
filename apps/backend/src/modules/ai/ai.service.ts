import {
  applyFix as applyFixDomain,
  auditQuestions,
  summarizeAudit,
  type AuditFinding,
} from '../../domain/ai/audit.js'
import type { Question } from '../../domain/types.js'
import { badRequest, notFound } from '../../lib/errors.js'
import { generateId, surveyRepo } from '../../repositories/inMemory.js'
import { createSurvey, getSurvey, updateSurvey } from '../survey/survey.service.js'
import { getAiProvider } from './ai.provider.js'
import type { GenerateDraftInput } from './ai.schemas.js'

type AuditSession = {
  id: string
  surveyId: string
  createdAt: string
  findings: AuditFinding[]
  summary: ReturnType<typeof summarizeAudit>
  providerName: string
}

const auditSessions = new Map<string, AuditSession>()

const PROMPT_INJECTION_PATTERNS = [
  /ignore (the |all )?(previous|prior|above) (instructions?|prompts?)/gi,
  /disregard (the |all )?(previous|prior|above) (instructions?|prompts?)/gi,
  /system\s*[:-]\s*/gi,
  /you are now (a |an )?/gi,
  /act as (a |an )?/gi,
  /\bjailbreak\b/gi,
  /<\/?(script|style|iframe|object|embed)\b[^>]*>?/gi,
]

export const sanitizeUserPrompt = (input: string): string => {
  let out = input
  for (const p of PROMPT_INJECTION_PATTERNS) {
    out = out.replace(p, '')
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

export const resetAiSessions = (): void => {
  auditSessions.clear()
}

const surveyTitleFromBrief = (objective: string, fallback?: string): string => {
  if (fallback && fallback.trim()) return fallback.trim().slice(0, 80)
  const snippet = objective
    .trim()
    .split(/[.!?\n]/)[0]
    .slice(0, 60)
  return snippet.length >= 4 ? `${snippet} 리서치` : '신규 리서치'
}

export type DraftResult = {
  surveyId: string
  title: string
  questions: Question[]
  keywords: string[]
  providerName: string
}

export const generateDraftSurvey = async (input: GenerateDraftInput): Promise<DraftResult> => {
  const provider = getAiProvider()
  const sanitizedBrief = {
    ...input.brief,
    objective: sanitizeUserPrompt(input.brief.objective),
  }
  if (sanitizedBrief.objective.length < 4) {
    throw badRequest(
      'Objective contains only restricted instructions; please describe your research goal',
    )
  }
  const { questions: draftQuestions, keywords } = await provider.generate(sanitizedBrief)

  if (draftQuestions.length === 0) {
    throw badRequest('AI provider returned no questions')
  }

  const title = surveyTitleFromBrief(sanitizedBrief.objective, input.title)
  const category = sanitizedBrief.category ?? 'general'

  const survey = createSurvey({
    title,
    category,
    difficulty: 1,
    questions: draftQuestions.map((q) => ({
      type: q.type,
      text: q.text,
      required: q.required ?? true,
      choices: q.choices,
    })),
  })

  return {
    surveyId: survey.id,
    title: survey.title,
    questions: survey.questions,
    keywords,
    providerName: provider.name,
  }
}

export type AuditResult = {
  sessionId: string
  surveyId: string
  findings: AuditFinding[]
  summary: ReturnType<typeof summarizeAudit>
  providerName: string
}

export const runAudit = async (surveyId: string): Promise<AuditResult> => {
  const survey = getSurvey(surveyId)
  const provider = getAiProvider()
  const findings = await provider.audit(survey.questions)
  const summary = summarizeAudit(findings)

  const session: AuditSession = {
    id: generateId('aud'),
    surveyId,
    createdAt: new Date().toISOString(),
    findings,
    summary,
    providerName: provider.name,
  }
  auditSessions.set(session.id, session)

  return {
    sessionId: session.id,
    surveyId,
    findings,
    summary,
    providerName: provider.name,
  }
}

export type ApplyFixResult = {
  sessionId: string
  surveyId: string
  appliedFindingId: string
  questions: Question[]
  remaining: AuditFinding[]
  summary: ReturnType<typeof summarizeAudit>
}

export const applyAuditFix = (sessionId: string, findingId: string): ApplyFixResult => {
  const session = auditSessions.get(sessionId)
  if (!session) {
    throw notFound('AuditSession', sessionId)
  }
  const finding = session.findings.find((f) => f.id === findingId)
  if (!finding) {
    throw notFound('Finding', findingId)
  }
  if (!finding.fix) {
    throw badRequest('Finding has no auto-fix; manual edit required', { findingId })
  }

  const survey = getSurvey(session.surveyId)
  if (survey.locked) {
    throw badRequest('Survey is locked; structural edits are disabled', { surveyId: survey.id })
  }

  const next = applyFixDomain(survey.questions, session.findings, findingId)
  updateSurvey(survey.id, {
    questions: next.map((q) => ({
      type: q.type,
      text: q.text,
      required: q.required,
      choices: q.choices,
    })),
  })

  // Re-audit so future apply calls reflect the new state
  const refreshed = getSurvey(survey.id)
  const newFindings = auditQuestions(refreshed.questions)
  const summary = summarizeAudit(newFindings)
  auditSessions.set(session.id, { ...session, findings: newFindings, summary })

  return {
    sessionId: session.id,
    surveyId: survey.id,
    appliedFindingId: findingId,
    questions: refreshed.questions,
    remaining: newFindings,
    summary,
  }
}

export const getAuditSession = (sessionId: string): AuditSession => {
  const session = auditSessions.get(sessionId)
  if (!session) {
    throw notFound('AuditSession', sessionId)
  }
  return session
}

// Internal helpers (test seam)
export const __testing = {
  clearSessions: resetAiSessions,
  sessionCount: (): number => auditSessions.size,
}

// Used by dev reset
export { surveyRepo }
