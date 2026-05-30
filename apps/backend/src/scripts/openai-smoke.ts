// Standalone smoke test — not picked up by vitest (filename excludes `.test`).
// Run with: npx tsx src/scripts/openai-smoke.ts
import { env } from '../config/env.js'
import { createOpenAIProvider } from '../modules/ai/openai.provider.js'

const main = async () => {
  if (!env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set — abort')
    process.exit(1)
  }
  const provider = createOpenAIProvider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL })
  console.log(`[smoke] generating draft via ${provider.name}`)
  const draft = await provider.generate({
    objective: '20대 직장인의 모바일 커피 주문 앱 만족도 조사',
    desiredCount: 6,
    tone: 'friendly',
  })
  console.log(`[smoke] got ${draft.questions.length} questions, keywords:`, draft.keywords)
  console.log(draft.questions.map((q, i) => `${i + 1}. [${q.type}] ${q.text}`).join('\n'))
}

main().catch((err) => {
  console.error('[smoke] failed:', err)
  process.exit(1)
})
