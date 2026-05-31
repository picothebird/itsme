import { Router } from 'express'

import { asyncHandler } from '../../lib/asyncHandler.js'
import { parseOrThrow } from '../../lib/validate.js'
import { buildItsmeMarkdown } from '../../domain/ai/chat.js'
import { applyAuditFix, generateDraftSurvey, getAuditSession, runAudit } from './ai.service.js'
import { buildPanelistContext, streamChatReply } from './chat.service.js'
import { applyFixSchema, auditSurveySchema, chatSchema, generateDraftSchema } from './ai.schemas.js'

export const aiRouter = Router()

aiRouter.post(
  '/drafts',
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(generateDraftSchema, req.body, 'ai.draft')
    const result = await generateDraftSurvey(input)
    res.status(201).json({ ok: true, data: result })
  }),
)

aiRouter.post(
  '/audits',
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(auditSurveySchema, req.body, 'ai.audit')
    const result = await runAudit(input.surveyId)
    res.status(201).json({ ok: true, data: result })
  }),
)

aiRouter.get(
  '/audits/:id',
  asyncHandler((req, res) => {
    const session = getAuditSession(String(req.params.id))
    res.json({ ok: true, data: session })
  }),
)

aiRouter.post(
  '/audits/:id/apply',
  asyncHandler((req, res) => {
    const input = parseOrThrow(applyFixSchema, req.body, 'ai.apply')
    const result = applyAuditFix(String(req.params.id), input.findingId)
    res.json({ ok: true, data: result })
  }),
)

// "나를 이해하는 AI" 대화 — Server-Sent Events로 토큰을 흘려보낸다.
aiRouter.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(chatSchema, req.body, 'ai.chat')

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    let aborted = false
    res.on('close', () => {
      aborted = true
    })

    try {
      for await (const delta of streamChatReply(input.pid, input.messages)) {
        if (aborted) break
        res.write(`data: ${JSON.stringify({ delta })}\n\n`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '대화 생성 중 오류가 발생했어요'
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
    } finally {
      if (!aborted) res.write('data: [DONE]\n\n')
      res.end()
    }
  }),
)

// itsme.md — 사용자의 프로필·응답 데이터를 마크다운 카드로 내려받는다.
aiRouter.get(
  '/itsme/:pid',
  asyncHandler((req, res) => {
    const pid = String(req.params.pid)
    const profile = buildPanelistContext(pid)
    const markdown = buildItsmeMarkdown(profile)
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="itsme.md"')
    res.send(markdown)
  }),
)
