import { describe, expect, it } from 'vitest'

import { applyFix, auditQuestions, summarizeAudit } from './audit.js'
import type { Question } from '../types.js'

const q = (overrides: Partial<Question> & { id: string; text: string }): Question => ({
  type: 'single',
  required: true,
  choices: [
    { id: 'c1', label: 'A' },
    { id: 'c2', label: 'B' },
  ],
  ...overrides,
})

describe('auditQuestions — rules', () => {
  it('detects leading expressions and offers a rewrite', () => {
    const questions = [q({ id: 'q1', text: '당연히 우리 서비스가 좋다고 생각하지 않나요?' })]
    const findings = auditQuestions(questions)
    const leading = findings.find((f) => f.rule === 'leading')
    expect(leading).toBeDefined()
    expect(leading?.severity).toBe('high')
    expect(leading?.fix?.text).toBeDefined()
    expect(leading?.fix?.text).not.toContain('당연히')
  })

  it('detects double-barreled questions', () => {
    const questions = [q({ id: 'q1', text: '가격은 적정한가요 그리고 디자인은 마음에 드나요?' })]
    const findings = auditQuestions(questions)
    expect(findings.some((f) => f.rule === 'double_barreled')).toBe(true)
  })

  it('flags missing choices on single-choice questions', () => {
    const questions = [q({ id: 'q1', text: '어떤 색을 좋아하나요?', choices: [] })]
    const findings = auditQuestions(questions)
    expect(findings.some((f) => f.rule === 'missing_choices' && f.severity === 'high')).toBe(true)
  })

  it('detects duplicate question text', () => {
    const questions = [
      q({ id: 'q1', text: '커피를 자주 마시나요?' }),
      q({ id: 'q2', text: '커피를 자주 마시나요?' }),
    ]
    const findings = auditQuestions(questions)
    expect(findings.some((f) => f.rule === 'duplicate')).toBe(true)
  })

  it('detects logical contradictions across questions', () => {
    const questions = [
      q({ id: 'q1', text: '본 서비스에 만족하시나요?' }),
      q({ id: 'q2', text: '본 서비스가 불편한가요?' }),
    ]
    const findings = auditQuestions(questions)
    expect(findings.some((f) => f.rule === 'contradiction')).toBe(true)
  })

  it('returns an empty array for clean neutral questions', () => {
    const questions = [
      q({ id: 'q1', text: '주말에 운동을 하나요?' }),
      q({ id: 'q2', text: '평일에 책을 읽나요?' }),
    ]
    const findings = auditQuestions(questions)
    expect(findings).toEqual([])
  })
})

describe('summarizeAudit', () => {
  it('returns a score reflecting severity weights', () => {
    const findings = auditQuestions([
      q({ id: 'q1', text: '당연히 좋다고 생각하지 않나요?' }),
      q({ id: 'q2', text: '가격은 적정한가요 그리고 디자인은 어떤가요?' }),
    ])
    const summary = summarizeAudit(findings)
    expect(summary.high).toBeGreaterThanOrEqual(1)
    expect(summary.score).toBeLessThan(100)
    expect(summary.score).toBeGreaterThanOrEqual(0)
  })
})

describe('applyFix', () => {
  it('replaces only the targeted question text', () => {
    const questions = [
      q({ id: 'q1', text: '당연히 좋다고 생각하지 않나요?' }),
      q({ id: 'q2', text: '운동을 자주 하나요?' }),
    ]
    const findings = auditQuestions(questions)
    const leading = findings.find((f) => f.rule === 'leading')!
    const next = applyFix(questions, findings, leading.id)
    expect(next[0].text).not.toContain('당연히')
    expect(next[1].text).toBe('운동을 자주 하나요?')
  })
})
