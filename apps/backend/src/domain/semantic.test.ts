import { describe, expect, it } from 'vitest'

import { cosineSimilarity, embed, tokenize } from './semantic.js'

describe('semantic / tokenize', () => {
  it('extracts latin word features and drops short tokens', () => {
    const tokens = tokenize('IT tech a survey')
    expect(tokens).toContain('w:it')
    expect(tokens).toContain('w:tech')
    expect(tokens).toContain('w:survey')
    expect(tokens).not.toContain('w:a')
  })

  it('extracts korean character bigrams', () => {
    const tokens = tokenize('뷰티')
    expect(tokens).toContain('k:뷰티')
  })
})

describe('semantic / embed + cosine', () => {
  it('produces an l2-normalized vector', () => {
    const v = embed('운동 건강 운동')
    const norm = Math.sqrt(Object.values(v).reduce((acc, x) => acc + x * x, 0))
    expect(norm).toBeCloseTo(1, 5)
  })

  it('returns an empty vector for empty/punctuation-only text', () => {
    expect(embed('   !!! ')).toEqual({})
  })

  it('scores identical text as 1 and unrelated text near 0', () => {
    const a = embed('스마트폰 구매 경험 설문')
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5)

    const b = embed('운동 식단 관리 습관')
    expect(cosineSimilarity(a, b)).toBeLessThan(0.2)
  })

  it('scores related text higher than unrelated text', () => {
    const query = embed('화장품 뷰티 추천')
    const related = embed('뷰티 화장품 사용 후기')
    const unrelated = embed('자동차 보험 가입')
    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated))
  })
})
