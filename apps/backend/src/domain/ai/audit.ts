import type { Question } from '../types.js'

export type AuditSeverity = 'info' | 'warn' | 'high'

export type AuditFinding = {
  id: string
  questionId: string
  questionIndex: number
  rule: AuditRuleId
  severity: AuditSeverity
  message: string
  suggestion?: string
  fix?: { text: string }
}

export type AuditRuleId =
  | 'leading'
  | 'double_barreled'
  | 'contradiction'
  | 'jargon'
  | 'too_long'
  | 'duplicate'
  | 'missing_choices'

const LEADING_PATTERNS: Array<{ pattern: RegExp; rewrite: (text: string) => string }> = [
  {
    pattern: /당연히\s/,
    rewrite: (t) => t.replace(/당연히\s/g, ''),
  },
  {
    pattern: /훌륭한|뛰어난|최고의|놀라운/,
    rewrite: (t) => t.replace(/훌륭한|뛰어난|최고의|놀라운/g, ''),
  },
  {
    pattern: /좋다고\s*생각하지\s*않나요\??/,
    rewrite: (t) => t.replace(/좋다고\s*생각하지\s*않나요\??/g, '에 대해 어떻게 생각하나요?'),
  },
  {
    pattern: /동의하시죠\??/,
    rewrite: (t) => t.replace(/동의하시죠\??/g, '에 대한 의견은 무엇인가요?'),
  },
]

const DOUBLE_BARRELED_MARKERS = /(\s그리고\s|\s및\s|\s또는\s.*\?)/

const JARGON_TERMS = ['로열티', '코호트', '리텐션', '컨버전', 'LTV', 'CAC', '온보딩']

const CONTRADICTION_PAIRS: Array<[RegExp, RegExp, string]> = [
  [
    /만족/,
    /불만족|불편/,
    '동일 응답자에게 만족과 불만족을 같은 척도로 묻고 있어 모순될 수 있습니다.',
  ],
  [
    /사용한다|이용한다/,
    /사용하지\s*않/,
    '사용 여부와 비사용 여부를 동일 흐름에 배치해 응답이 충돌할 수 있습니다.',
  ],
]

const MAX_LENGTH = 80

const makeId = (qIdx: number, rule: AuditRuleId, salt = 0): string => `f_${qIdx}_${rule}_${salt}`

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim()

export const auditQuestions = (questions: Question[]): AuditFinding[] => {
  const findings: AuditFinding[] = []
  const normalizedSeen = new Map<string, number>()

  questions.forEach((q, idx) => {
    const text = q.text

    // 1. leading
    for (const { pattern, rewrite } of LEADING_PATTERNS) {
      if (pattern.test(text)) {
        const fixed = rewrite(text)
          .replace(/\s{2,}/g, ' ')
          .trim()
        findings.push({
          id: makeId(idx, 'leading', findings.length),
          questionId: q.id,
          questionIndex: idx,
          rule: 'leading',
          severity: 'high',
          message: '응답자를 특정 방향으로 유도하는 표현이 포함되어 있습니다.',
          suggestion: '중립적인 표현으로 다시 쓰는 것을 권장합니다.',
          fix: { text: fixed },
        })
        break
      }
    }

    // 2. double-barreled
    if (DOUBLE_BARRELED_MARKERS.test(text)) {
      findings.push({
        id: makeId(idx, 'double_barreled'),
        questionId: q.id,
        questionIndex: idx,
        rule: 'double_barreled',
        severity: 'warn',
        message: '두 가지 주제를 한 문항에 묶고 있어 해석이 어렵습니다.',
        suggestion: '서로 다른 두 문항으로 분리하세요.',
      })
    }

    // 3. jargon
    for (const term of JARGON_TERMS) {
      if (text.includes(term)) {
        findings.push({
          id: makeId(idx, 'jargon'),
          questionId: q.id,
          questionIndex: idx,
          rule: 'jargon',
          severity: 'info',
          message: `전문 용어 "${term}"가 사용되었습니다. 일반 응답자에게는 어려울 수 있습니다.`,
        })
        break
      }
    }

    // 4. too long
    if (text.length > MAX_LENGTH) {
      findings.push({
        id: makeId(idx, 'too_long'),
        questionId: q.id,
        questionIndex: idx,
        rule: 'too_long',
        severity: 'warn',
        message: `질문이 너무 깁니다 (${text.length}자 / 권장 ${MAX_LENGTH}자 이하).`,
      })
    }

    // 5. missing choices for single/multi
    if ((q.type === 'single' || q.type === 'multi') && (!q.choices || q.choices.length < 2)) {
      findings.push({
        id: makeId(idx, 'missing_choices'),
        questionId: q.id,
        questionIndex: idx,
        rule: 'missing_choices',
        severity: 'high',
        message: '선택형 질문에 보기가 2개 미만입니다.',
      })
    }

    // 6. duplicate text
    const key = normalize(text)
    if (key.length > 0) {
      if (normalizedSeen.has(key)) {
        const first = normalizedSeen.get(key)!
        findings.push({
          id: makeId(idx, 'duplicate'),
          questionId: q.id,
          questionIndex: idx,
          rule: 'duplicate',
          severity: 'warn',
          message: `${first + 1}번 문항과 거의 동일합니다.`,
        })
      } else {
        normalizedSeen.set(key, idx)
      }
    }
  })

  // 7. contradiction across pairs
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const a = questions[i].text
      const b = questions[j].text
      for (const [pa, pb, msg] of CONTRADICTION_PAIRS) {
        if ((pa.test(a) && pb.test(b)) || (pa.test(b) && pb.test(a))) {
          findings.push({
            id: makeId(j, 'contradiction', i),
            questionId: questions[j].id,
            questionIndex: j,
            rule: 'contradiction',
            severity: 'warn',
            message: `${i + 1}번 문항과 논리적으로 충돌할 수 있습니다. ${msg}`,
          })
          break
        }
      }
    }
  }

  return findings
}

export const summarizeAudit = (
  findings: AuditFinding[],
): { total: number; high: number; warn: number; info: number; score: number } => {
  const high = findings.filter((f) => f.severity === 'high').length
  const warn = findings.filter((f) => f.severity === 'warn').length
  const info = findings.filter((f) => f.severity === 'info').length
  // 100 base, -15 per high, -5 per warn, -1 per info, floor 0
  const score = Math.max(0, 100 - high * 15 - warn * 5 - info * 1)
  return { total: findings.length, high, warn, info, score }
}

export const applyFix = (
  questions: Question[],
  findings: AuditFinding[],
  findingId: string,
): Question[] => {
  const finding = findings.find((f) => f.id === findingId)
  if (!finding || !finding.fix) return questions
  return questions.map((q) => (q.id === finding.questionId ? { ...q, text: finding.fix!.text } : q))
}
