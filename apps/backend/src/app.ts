import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { env } from './config/env.js'
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
