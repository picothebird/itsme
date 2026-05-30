import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { env } from './config/env.js'
import { errorHandler } from './middleware/error.js'
import { feedRouter } from './modules/feed/feed.routes.js'
import { panelRouter } from './modules/panel/panel.routes.js'
import { responseRouter } from './modules/response/response.routes.js'
import { surveyRouter } from './modules/survey/survey.routes.js'
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
app.use('/surveys', surveyRouter)
app.use('/responses', responseRouter)
app.use('/feed', feedRouter)
app.use('/panel', panelRouter)

app.use(errorHandler)
