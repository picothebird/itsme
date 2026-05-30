import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { env } from './config/env.js'
import { errorHandler } from './middleware/error.js'
import { aiRouter } from './modules/ai/ai.routes.js'
import { analyticsRouter } from './modules/analytics/analytics.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { devRouter } from './modules/dev/dev.routes.js'
import { feedRouter } from './modules/feed/feed.routes.js'
import { panelRouter } from './modules/panel/panel.routes.js'
import { responseRouter } from './modules/response/response.routes.js'
import { semanticRouter } from './modules/semantic/semantic.routes.js'
import { surveyRouter } from './modules/survey/survey.routes.js'
import { walletRouter } from './modules/wallet/wallet.routes.js'
import { healthRouter } from './routes/health.js'

export const app = express()

app.use(helmet())
app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
  }),
)
app.use(express.json())

app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'itsme backend is running',
  })
})

app.use('/health', healthRouter)
app.use('/auth', authRouter)
app.use('/surveys', surveyRouter)
app.use('/responses', responseRouter)
app.use('/feed', feedRouter)
app.use('/semantic', semanticRouter)
app.use('/panel', panelRouter)
app.use('/ai', aiRouter)
app.use('/analytics', analyticsRouter)
app.use('/wallet', walletRouter)

if (env.NODE_ENV !== 'production') {
  app.use('/dev', devRouter)
}

app.use(errorHandler)
