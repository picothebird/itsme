import type { ManagedStudy } from './types.js'

/**
 * Seed catalog of managed (application-based) studies shown to panelists.
 * These are deterministic demo fixtures, mirrored into the in-memory store on reset.
 */
export const MANAGED_STUDY_SEED: ManagedStudy[] = [
  {
    id: 'study_ut_shopping',
    title: '모바일 쇼핑 앱 사용성 테스트',
    category: '커머스',
    type: 'usability',
    summary: '새 장바구니 플로우를 30분간 함께 사용하며 의견을 들려주세요.',
    incentivePoints: 30000,
    estimatedMinutes: 30,
    capacity: 8,
    status: 'open',
    screener: [
      { id: 'q1', text: '최근 한 달 내 모바일로 쇼핑한 적이 있나요?' },
      { id: 'q2', text: '주로 사용하는 쇼핑 앱은 무엇인가요?' },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'study_interview_finance',
    title: '2030 자산관리 심층 인터뷰',
    category: '핀테크',
    type: 'interview',
    summary: '재테크 습관에 대해 1:1 화상 인터뷰(45분)를 진행합니다.',
    incentivePoints: 50000,
    estimatedMinutes: 45,
    capacity: 5,
    status: 'open',
    screener: [
      { id: 'q1', text: '현재 사용 중인 자산관리/투자 앱이 있나요?' },
      { id: 'q2', text: '월 평균 저축·투자 비중은 어느 정도인가요?' },
    ],
    createdAt: '2026-05-03T00:00:00.000Z',
  },
  {
    id: 'study_diary_health',
    title: '일주일 건강습관 다이어리',
    category: '헬스케어',
    type: 'diary',
    summary: '7일간 매일 식사·운동 기록을 남기는 일기형 리서치입니다.',
    incentivePoints: 40000,
    estimatedMinutes: 15,
    capacity: 12,
    status: 'open',
    screener: [{ id: 'q1', text: '평소 건강 관리 앱을 사용하고 있나요?' }],
    createdAt: '2026-05-05T00:00:00.000Z',
  },
]
