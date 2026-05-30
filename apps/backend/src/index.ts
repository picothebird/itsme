import { app } from './app.js'
import { env } from './config/env.js'
import { heuristicProvider, setAiProvider } from './modules/ai/ai.provider.js'
import { createOpenAIProvider, withHeuristicFallback } from './modules/ai/openai.provider.js'

if (env.OPENAI_API_KEY) {
  const primary = createOpenAIProvider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL })
  setAiProvider(withHeuristicFallback(primary, heuristicProvider))
  console.log(`[ai] OpenAI provider enabled (model=${env.OPENAI_MODEL})`)
} else {
  console.log('[ai] OPENAI_API_KEY not set — using heuristic provider')
}

app.listen(env.PORT, () => {
  // Keep startup logs concise for local dev and CI output.
  console.log(`Backend listening on http://localhost:${env.PORT}`)
})
