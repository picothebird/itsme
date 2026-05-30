import { app } from './app.js'
import { env } from './config/env.js'

app.listen(env.PORT, () => {
  // Keep startup logs concise for local dev and CI output.
  console.log(`Backend listening on http://localhost:${env.PORT}`)
})
