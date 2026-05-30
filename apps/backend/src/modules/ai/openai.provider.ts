import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

import { auditQuestions, type AuditFinding } from '../../domain/ai/audit.js'
import type { DraftQuestion, SurveyBrief } from '../../domain/ai/generate.js'
import { extractKeywords } from '../../domain/ai/generate.js'
import type { Question } from '../../domain/types.js'
import type { AiProvider } from './ai.provider.js'

// OpenAI structured outputs require strict mode: every field is required, and
// optionality is expressed via `.nullable()`. We mirror our domain shape with
// strict-friendly schemas just for the API boundary.
const strictChoice = z.object({
  label: z.string().min(1).max(120),
})

const strictQuestion = z.object({
  type: z.enum(['single', 'multi', 'likert', 'text']),
  text: z.string().min(1).max(400),
  required: z.boolean(),
  choices: z.array(strictChoice).nullable(),
})

const draftResponseSchema = z.object({
  questions: z.array(strictQuestion).min(3).max(15),
  keywords: z.array(z.string().min(1).max(40)).max(20),
})

const strictFinding = z.object({
  questionIndex: z.number().int().min(0),
  rule: z.enum([
    'leading',
    'double_barreled',
    'contradiction',
    'jargon',
    'too_long',
    'duplicate',
    'missing_choices',
  ]),
  severity: z.enum(['info', 'warn', 'high']),
  message: z.string().min(1).max(280),
  suggestion: z.string().max(280).nullable(),
  rewriteText: z.string().max(400).nullable(),
})

const auditResponseSchema = z.object({
  findings: z.array(strictFinding).max(30),
})

const SYSTEM_DRAFT = `당신은 한국 시장을 잘 아는 리서치 설문 디자이너입니다.
- 사용자의 리서치 목표(brief)를 바탕으로 한국어 설문 문항 초안을 만듭니다.
- 문항은 ${'5~12개'} 범위, 첫 문항은 스크리너(yes/no)로 시작합니다.
- single/multi/likert/text 유형을 적절히 섞고, 객관식에는 3~5개 선택지를 제공합니다.
- 유도형 표현("당연히", "훌륭한", "동의하시죠?"), 이중질문, 전문용어 남용을 피합니다.
- 모든 문항은 명확하고 80자 이내로 간결하게.
- 응답은 JSON 스키마(questions[], keywords[])만 출력합니다.`

const SYSTEM_AUDIT = `당신은 설문 품질 감수 전문가입니다. 주어진 한국어 문항 배열을 검사해
유도성(leading), 이중질문(double_barreled), 논리 모순(contradiction), 전문용어(jargon),
긴 문장(too_long), 중복(duplicate), 선택지 누락(missing_choices) 규칙별로
findings 배열을 반환합니다. 가능한 경우 rewriteText에 자동 수정안을 포함합니다.
응답은 JSON 스키마(findings[])만 출력합니다.`

const buildDraftInput = (brief: SurveyBrief): string => {
  const lines = [
    `리서치 목표: ${brief.objective}`,
    brief.audience ? `대상 응답자: ${brief.audience}` : null,
    brief.category ? `카테고리: ${brief.category}` : null,
    brief.desiredCount ? `희망 문항 수: ${brief.desiredCount}` : '희망 문항 수: 8',
    brief.tone ? `톤: ${brief.tone}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}

const buildAuditInput = (questions: Question[]): string =>
  questions
    .map(
      (q, i) =>
        `${i}. [${q.type}] ${q.text}${
          q.choices && q.choices.length > 0
            ? `\n   선택지: ${q.choices.map((c) => c.label).join(' | ')}`
            : ''
        }`,
    )
    .join('\n')

export const createOpenAIProvider = (params: { apiKey: string; model: string }): AiProvider => {
  const client = new OpenAI({ apiKey: params.apiKey })

  return {
    name: `openai:${params.model}`,
    generate: async (brief: SurveyBrief) => {
      const response = await client.responses.parse({
        model: params.model,
        input: [
          { role: 'system', content: SYSTEM_DRAFT },
          { role: 'user', content: buildDraftInput(brief) },
        ],
        text: { format: zodTextFormat(draftResponseSchema, 'survey_draft') },
      })
      const parsed = response.output_parsed
      if (!parsed) {
        throw new Error('OpenAI returned an empty draft')
      }
      const questions: DraftQuestion[] = parsed.questions.map((q) => ({
        type: q.type,
        text: q.text,
        required: q.required,
        choices: q.choices ? q.choices.map((c) => ({ label: c.label })) : undefined,
      }))
      const keywords =
        parsed.keywords.length > 0 ? parsed.keywords : extractKeywords(brief.objective)
      return { questions, keywords }
    },
    audit: async (questions: Question[]): Promise<AuditFinding[]> => {
      if (questions.length === 0) return []
      const response = await client.responses.parse({
        model: params.model,
        input: [
          { role: 'system', content: SYSTEM_AUDIT },
          { role: 'user', content: buildAuditInput(questions) },
        ],
        text: { format: zodTextFormat(auditResponseSchema, 'survey_audit') },
      })
      const parsed = response.output_parsed
      if (!parsed) return []
      return parsed.findings
        .filter((f) => f.questionIndex < questions.length)
        .map((f, i) => {
          const q = questions[f.questionIndex]
          return {
            id: `f_${f.questionIndex}_${f.rule}_${i}`,
            questionId: q.id,
            questionIndex: f.questionIndex,
            rule: f.rule,
            severity: f.severity,
            message: f.message,
            suggestion: f.suggestion ?? undefined,
            fix: f.rewriteText ? { text: f.rewriteText } : undefined,
          }
        })
    },
  }
}

/**
 * Fallback wrapper — if the OpenAI call fails (rate limit, network, invalid key),
 * fall back to the local heuristic provider so the researcher experience never
 * hard-breaks during a demo.
 */
export const withHeuristicFallback = (primary: AiProvider, fallback: AiProvider): AiProvider => ({
  name: `${primary.name}+fallback`,
  generate: async (brief) => {
    try {
      return await primary.generate(brief)
    } catch (err) {
      console.warn(`[ai] primary provider failed, using ${fallback.name}:`, err)
      const fb = await fallback.generate(brief)
      return fb
    }
  },
  audit: async (questions) => {
    try {
      return await primary.audit(questions)
    } catch (err) {
      console.warn(`[ai] primary audit failed, using ${fallback.name}:`, err)
      return auditQuestions(questions)
    }
  },
})
