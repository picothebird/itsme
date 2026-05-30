import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { app } from './app.js'

describe('GET /health', () => {
  it('returns 200 and service metadata', async () => {
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      service: 'backend',
      status: 'ok',
    })
  })
})
