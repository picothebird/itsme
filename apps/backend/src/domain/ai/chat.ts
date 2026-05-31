import type { Gender } from '../types.js'

/**
 * "나를 이해하는 AI" — 패널의 응답·프로필 데이터로 구성한 대화 컨텍스트.
 * 순수 데이터 구조라 서비스 계층에서 조립해 주입한다.
 */
export type PanelistProfile = {
  displayName?: string
  age?: number
  gender?: Gender
  interests: string[]
  answeredCount: number
  categories: Array<{ name: string; count: number }>
  recentTexts: string[]
  pointsBalance: number
  petLevel: number
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const GENDER_LABEL: Record<Gender, string> = {
  male: '남성',
  female: '여성',
  unspecified: '비공개',
}

const topCategories = (profile: PanelistProfile, n: number): string[] =>
  profile.categories.slice(0, n).map((c) => c.name)

const joinKo = (items: string[]): string => {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')}, ${items[items.length - 1]}`
}

/** 프로필을 한 문단 자기소개로 요약한다(시스템 프롬프트/인트로에 재사용). */
export const summarizeProfile = (profile: PanelistProfile): string => {
  const bits: string[] = []
  if (profile.age) bits.push(`${Math.floor(profile.age / 10) * 10}대`)
  if (profile.gender && profile.gender !== 'unspecified') bits.push(GENDER_LABEL[profile.gender])
  if (profile.interests.length > 0) bits.push(`관심사: ${joinKo(profile.interests)}`)
  const cats = topCategories(profile, 3)
  if (cats.length > 0) bits.push(`자주 참여한 주제: ${joinKo(cats)}`)
  bits.push(`누적 응답 ${profile.answeredCount}건`)
  bits.push(`포인트 ${profile.pointsBalance.toLocaleString()}P`)
  bits.push(`정령 Lv.${profile.petLevel}`)
  return bits.join(' · ')
}

/** OpenAI 시스템 프롬프트. 사용자 데이터를 컨텍스트로 주입한다. */
export const buildSystemPrompt = (profile: PanelistProfile): string => {
  const name = profile.displayName?.trim() || '회원'
  return [
    '당신은 "itsme"의 개인 AI입니다. 사용자의 설문 응답과 프로필 데이터를 바탕으로,',
    '"나를 이해하는 AI"라는 컨셉으로 따뜻하고 간결하게 한국어로 대화합니다.',
    '- 반드시 사용자의 실제 데이터(관심사·참여 주제·응답 수)를 자연스럽게 인용합니다.',
    '- 답변은 2~4문장으로 짧게, 공감 + 인사이트 + 가벼운 후속 질문 흐름으로.',
    '- 모르는 사실은 지어내지 말고, 데이터가 부족하면 솔직히 말합니다.',
    '- 의료·법률·금융의 단정적 조언은 피하고 일반적 정보로 안내합니다.',
    '',
    `사용자(${name}) 프로필: ${summarizeProfile(profile)}`,
    profile.recentTexts.length > 0
      ? `최근 주관식 응답 일부: ${profile.recentTexts.map((t) => `"${t}"`).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

const hasAny = (text: string, words: string[]): boolean => words.some((w) => text.includes(w))

/**
 * 로컬 휴리스틱 응답기 — OpenAI 키가 없어도 "나를 이해하는 AI" 경험이 작동하도록
 * 사용자 데이터를 인용해 의도별 답변을 생성한다.
 */
export const heuristicChatReply = (profile: PanelistProfile, messages: ChatMessage[]): string => {
  const name = profile.displayName?.trim() || '회원'
  const last =
    [...messages]
      .reverse()
      .find((m) => m.role === 'user')
      ?.content.trim() ?? ''
  const interests = joinKo(profile.interests) || '아직 등록한 관심사'
  const cats = topCategories(profile, 3)
  const catsText = joinKo(cats)

  // 첫 진입(메시지 없음) — 데이터 기반 인사
  if (!last) {
    if (profile.answeredCount === 0) {
      return `안녕하세요 ${name}님, 저는 ${name}님을 이해하는 AI예요. 아직 응답 데이터가 많지 않지만, 설문에 참여할수록 제가 ${name}님을 더 잘 알게 돼요. 요즘 어떤 주제에 관심이 가세요?`
    }
    return `안녕하세요 ${name}님! 지금까지 ${profile.answeredCount}개의 응답을 남겨주셨네요. ${interests}에 관심이 많고, 특히 ${catsText || '여러'} 주제에 자주 참여하셨어요. 오늘은 무엇이 궁금하세요?`
  }

  // 관심사·취향 요약
  if (hasAny(last, ['관심', '취향', '좋아', '성향', '나는 어떤', '나에 대'])) {
    return `${name}님의 데이터를 보면, ${interests} 쪽에 꾸준히 반응하세요. ${catsText ? `참여 주제도 ${catsText}에 몰려 있고요. ` : ''}한마디로 "관심 분야가 또렷한 분"이에요. 더 깊게 들어가 볼 주제를 골라볼까요?`
  }

  // 추천
  if (hasAny(last, ['추천', '뭐 하면', '뭐할', '어떤 설문', '참여할'])) {
    const seed = cats[0] ?? profile.interests[0] ?? '관심사'
    return `${name}님은 ${seed} 관련 설문에서 응답이 가장 활발했어요. 비슷한 결의 새 리서치가 잘 맞을 가능성이 높아요. 설문 탭에서 ${seed} 주제를 먼저 살펴보시는 걸 추천드려요. 원하시면 다른 기준으로도 골라드릴게요.`
  }

  // 데이터/프라이버시
  if (hasAny(last, ['데이터', '개인정보', '프라이버시', '어떻게 쓰', '안전', '수집'])) {
    return `${name}님의 응답은 맞춤 설문 추천과 정령 성장에만 쓰이고, 설정에서 언제든 확인·삭제할 수 있어요. 외부에 개인을 식별하는 형태로 공유되지 않아요. 더 궁금한 부분이 있으면 알려주세요.`
  }

  // 포인트
  if (hasAny(last, ['포인트', '적립', '돈', '리워드', '환전', '상점'])) {
    return `현재 ${name}님의 잔액은 ${profile.pointsBalance.toLocaleString()}P예요. 설문을 완료할 때마다 포인트가 쌓이고, 우측 상단 포인트를 눌러 상점에서 교환할 수 있어요. 목표 금액이 있으면 페이스를 같이 계획해 볼까요?`
  }

  // 정령/펫
  if (hasAny(last, ['정령', '펫', '캐릭터', '레벨', '키우'])) {
    return `${name}님의 정령은 지금 Lv.${profile.petLevel}이에요. 응답을 남기고 데이터 조각을 먹일수록 함께 성장해요. ${catsText ? `${catsText} 주제에 답하면 그 결의 취향도 더 또렷해져요. ` : ''}오늘 한 걸음 더 키워볼까요?`
  }

  // 자기 분석
  if (hasAny(last, ['분석', '나 어때', '평가', '요약', '프로필'])) {
    return `요약하면, ${name}님은 ${interests}에 관심이 또렷하고 ${profile.answeredCount}건의 응답으로 꾸준함을 보여주셨어요. ${catsText ? `${catsText} 주제에서 특히 적극적이고요. ` : ''}데이터가 쌓일수록 추천 정확도도 올라가요. 어떤 면을 더 깊게 들여다볼까요?`
  }

  // 일반 — 데이터로 공감하고 후속 질문
  const anchor = cats[0] ?? profile.interests[0]
  return `좋은 이야기예요, ${name}님. ${anchor ? `평소 ${anchor}에 관심이 많으신 만큼 그 관점에서도 생각해 볼 수 있겠어요. ` : ''}조금 더 구체적으로 들려주시면, ${name}님의 응답 데이터와 연결해 함께 정리해 드릴게요.`
}

/**
 * 텍스트를 스트리밍용 작은 조각으로 자른다. 한국어는 단어 경계가 옅어
 * 1~2 글자 단위로 끊어 토큰이 흘러가는 느낌을 만든다.
 */
export const chunkForStream = (text: string): string[] => {
  const chunks: string[] = []
  const chars = Array.from(text)
  for (let i = 0; i < chars.length; ) {
    const size = chars[i] === ' ' ? 1 : Math.random() < 0.5 ? 1 : 2
    chunks.push(chars.slice(i, i + size).join(''))
    i += size
  }
  return chunks
}
