import OpenAI from 'openai'

import {
  buildSystemPrompt,
  chunkForStream,
  heuristicChatReply,
  type ChatMessage,
  type PanelistProfile,
} from '../../domain/ai/chat.js'
import { env } from '../../config/env.js'
import {
  accountRepo,
  petRepo,
  responseRepo,
  surveyRepo,
  walletRepo,
} from '../../repositories/inMemory.js'
import { sanitizeUserPrompt } from './ai.service.js'

const currentYear = new Date().getFullYear()

/** pid의 응답·프로필 데이터를 모아 대화 컨텍스트 프로필을 만든다. */
export const buildPanelistContext = (pid: string): PanelistProfile => {
  const account = accountRepo.get(pid)
  const wallet = walletRepo.get(pid)
  const pet = petRepo.get(pid)

  const responses = responseRepo.list().filter((r) => r.pid === pid)
  const completed = responses.filter((r) => r.answers.length > 0)

  const categoryCount = new Map<string, number>()
  const recentTexts: string[] = []
  for (const r of completed) {
    const survey = surveyRepo.get(r.surveyId)
    if (survey) {
      categoryCount.set(survey.category, (categoryCount.get(survey.category) ?? 0) + 1)
    }
    for (const a of r.answers) {
      if (a.textValue && a.textValue.trim().length > 1 && recentTexts.length < 3) {
        recentTexts.push(a.textValue.trim().slice(0, 80))
      }
    }
  }

  const categories = Array.from(categoryCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return {
    displayName: account?.displayName,
    provider: account?.provider,
    age: account?.birthYear ? currentYear - account.birthYear : undefined,
    gender: account?.gender,
    interests: account?.interests ?? [],
    answeredCount: completed.length,
    categories,
    recentTexts,
    pointsBalance: wallet.balance,
    petLevel: pet.level,
  }
}

const sanitizeMessages = (messages: ChatMessage[]): ChatMessage[] =>
  messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: m.role === 'user' ? sanitizeUserPrompt(m.content).slice(0, 1000) : m.content,
    }))

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function* heuristicStream(
  profile: PanelistProfile,
  messages: ChatMessage[],
): AsyncGenerator<string> {
  const reply = heuristicChatReply(profile, messages)
  for (const chunk of chunkForStream(reply)) {
    yield chunk
    await delay(16)
  }
}

async function* openaiStream(
  profile: PanelistProfile,
  messages: ChatMessage[],
  apiKey: string,
): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey })
  const stream = await client.responses.create({
    model: env.OPENAI_MODEL,
    stream: true,
    input: [
      { role: 'system', content: buildSystemPrompt(profile) },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  })
  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      yield event.delta
    }
  }
}

/**
 * "나를 이해하는 AI" 대화 응답을 토큰 단위로 스트리밍한다.
 * OpenAI 키가 있으면 실시간 스트리밍, 없거나 실패하면 휴리스틱으로 폴백한다.
 */
export async function* streamChatReply(
  pid: string,
  rawMessages: ChatMessage[],
): AsyncGenerator<string> {
  const profile = buildPanelistContext(pid)
  const messages = sanitizeMessages(rawMessages)

  if (env.OPENAI_API_KEY) {
    try {
      let any = false
      for await (const delta of openaiStream(profile, messages, env.OPENAI_API_KEY)) {
        any = true
        yield delta
      }
      if (any) return
    } catch (err) {
      console.warn('[ai.chat] openai stream failed, using heuristic:', err)
    }
  }

  yield* heuristicStream(profile, messages)
}
