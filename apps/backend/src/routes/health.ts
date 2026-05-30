import { Router } from 'express'

export const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  res.status(200).json({
    service: 'backend',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})
