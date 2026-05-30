import { describe, expect, it } from 'vitest'

import { generateDraft, extractKeywords, planSlots } from './generate.js'

describe('extractKeywords', () => {
  it('returns deduplicated content words and skips stopwords', () => {
    const kws = extractKeywords('우리 회사의 커피 구독 서비스에 대한 사용자 만족도를 조사한다')
    expect(kws).toContain('커피')
    expect(kws).toContain('구독')
    expect(kws).not.toContain('대한')
    expect(kws.length).toBeLessThanOrEqual(5)
  })

  it('handles empty input gracefully', () => {
    expect(extractKeywords('')).toEqual([])
  })
})

describe('planSlots', () => {
  it('returns at least 5 questions and ends with a text question', () => {
    const slots = planSlots({ objective: '운동 앱 사용자 만족도 조사' })
    expect(slots.length).toBeGreaterThanOrEqual(5)
    expect(slots[slots.length - 1].type).toBe('text')
  })

  it('honors desiredCount within bounds', () => {
    const slots = planSlots({ objective: '커피 취향 조사', desiredCount: 10 })
    expect(slots.length).toBe(10)
  })

  it('starts with a screener single-choice question', () => {
    const slots = planSlots({ objective: '간식 선호 조사' })
    expect(slots[0].type).toBe('single')
    expect(slots[0].choices).toBeDefined()
  })
})

describe('generateDraft', () => {
  it('produces draft questions with normalized fields', () => {
    const { questions, keywords } = generateDraft({
      objective: '신규 배달 앱의 주문 경험 만족도와 재이용 의향 조사',
      desiredCount: 8,
    })

    expect(questions).toHaveLength(8)
    for (const q of questions) {
      expect(q.text.length).toBeGreaterThan(0)
      expect(q.required).toBe(true)
      if (q.type === 'single' || q.type === 'multi') {
        expect(q.choices?.length ?? 0).toBeGreaterThanOrEqual(2)
      }
    }
    expect(keywords.length).toBeGreaterThan(0)
  })
})
