import { useCallback, useMemo, useState } from 'react'

import { api, type AuditFinding, type AuditResult, type Survey, type Targeting } from '../lib/api'
import { MobilePreview } from './MobilePreview'
import { PublishModal } from './PublishModal'

const RULE_LABELS: Record<AuditFinding['rule'], string> = {
  leading: '유도성 표현',
  double_barreled: '이중 질문',
  contradiction: '논리 모순',
  jargon: '어려운 용어',
  too_long: '문장이 너무 길어요',
  duplicate: '중복 문항',
  missing_choices: '보기 부족',
}

const SEVERITY_RANK: Record<AuditFinding['severity'], number> = { high: 0, warn: 1, info: 2 }

type Step = 'idle' | 'drafting' | 'auditing' | 'ready' | 'publishing' | 'published'

type Props = {
  onPublished?: () => void
  onLog?: (message: string) => void
  onToast?: (message: string, kind?: 'info' | 'success') => void
}

const SAMPLE_BRIEFS = [
  '20대 직장인이 새로 나온 배달 앱을 어떻게 경험하고, 다시 쓸 의향이 있는지 알고 싶어요',
  '구독형 커피 서비스에 대한 만족도와 가격 민감도를 조사합니다',
  '대학생의 운동 앱 이용 패턴과 동기부여 요소를 파악하고 싶어요',
]

const initialBrief = SAMPLE_BRIEFS[0]

export function AiStudio({ onPublished, onLog, onToast }: Props) {
  const [objective, setObjective] = useState(initialBrief)
  const [desiredCount, setDesiredCount] = useState(8)
  const [step, setStep] = useState<Step>('idle')
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [audit, setAudit] = useState<AuditResult | null>(null)
  const [questions, setQuestions] = useState<Survey['questions']>([])
  const [providerName, setProviderName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)

  const isBusy = step === 'drafting' || step === 'auditing' || step === 'publishing'

  const sortedFindings = useMemo(() => {
    if (!audit) return []
    return [...audit.findings].sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.questionIndex - b.questionIndex,
    )
  }, [audit])

  const log = useCallback(
    (msg: string) => {
      onLog?.(msg)
    },
    [onLog],
  )

  const runDraftAndAudit = useCallback(async () => {
    if (!objective.trim()) return
    setError(null)
    setStep('drafting')
    log(`초안 생성 시작 · ${desiredCount}문항`)
    try {
      const draft = await api.ai.generateDraft({
        brief: { objective: objective.trim(), desiredCount },
      })
      setSurvey({
        id: draft.surveyId,
        title: draft.title,
        category: 'general',
        difficulty: 1,
        status: 'draft',
        questions: draft.questions,
      })
      setQuestions(draft.questions)
      setProviderName(draft.providerName)
      log(`초안 완성 · “${draft.title}” · ${draft.questions.length}문항 (${draft.providerName})`)

      setStep('auditing')
      const auditResult = await api.ai.runAudit(draft.surveyId)
      setAudit(auditResult)
      log(
        `검수 결과 · 총 ${auditResult.findings.length}건 (심각 ${auditResult.summary.high} · 주의 ${auditResult.summary.warn} · 참고 ${auditResult.summary.info}) · 점수 ${auditResult.summary.score}`,
      )
      setStep('ready')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      log(`초안 생성 실패 · ${message}`)
      onToast?.(`초안 생성에 실패했어요. ${message}`, 'info')
      setStep('idle')
    }
  }, [desiredCount, log, objective, onToast])

  const applyFinding = useCallback(
    async (finding: AuditFinding) => {
      if (!audit || !finding.fix) return
      setApplyingId(finding.id)
      try {
        const result = await api.ai.applyFix(audit.sessionId, finding.id)
        setQuestions(result.questions)
        setAudit({
          ...audit,
          findings: result.remaining,
          summary: result.summary,
        })
        log(`수정안 적용 · ${RULE_LABELS[finding.rule]} (Q${finding.questionIndex + 1})`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        log(`수정안 적용 실패 · ${message}`)
      } finally {
        setApplyingId(null)
      }
    },
    [audit, log],
  )

  const publish = useCallback(
    async (input: {
      pointsPerUser: number
      targetCount: number
      estimatedReach: number
      targeting: Targeting
    }) => {
      if (!survey) return
      setStep('publishing')
      log(
        `발행 요청 · 응답자당 ${input.pointsPerUser}P · 목표 ${input.targetCount}명 · 예상 모수 ${input.estimatedReach}`,
      )
      try {
        await api.publishSurvey(survey.id, input)
        setStep('published')
        setPublishOpen(false)
        log('라이브 피드에 올라갔어요.')
        onToast?.('설문이 라이브 피드에 올라갔어요.', 'success')
        onPublished?.()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        log(`발행 실패 · ${message}`)
        onToast?.(`발행에 실패했어요. ${message}`, 'info')
        setStep('ready')
        throw err
      }
    },
    [log, onPublished, onToast, survey],
  )

  const reset = useCallback(() => {
    setSurvey(null)
    setAudit(null)
    setQuestions([])
    setError(null)
    setStep('idle')
  }, [])

  const summary = audit?.summary
  const stage =
    step === 'idle'
      ? '준비'
      : step === 'drafting'
        ? '초안 생성 중'
        : step === 'auditing'
          ? '검수 중'
          : step === 'ready'
            ? '검수 완료'
            : step === 'publishing'
              ? '발행 중'
              : '발행 완료'

  return (
    <section className="card ai-studio" aria-labelledby="ai-studio-heading">
      <div className="card__head">
        <div>
          <h3 id="ai-studio-heading">AI 설문 빌더</h3>
          <p className="ai-studio__sub">
            조사 목적을 적으면 초안 문항을 만들고, 유도 표현이나 논리 모순을 짚어 수정안까지 제안해
            드려요.
          </p>
        </div>
        <span className={`pill pill--${step === 'published' ? 'live' : 'draft'}`}>{stage}</span>
      </div>

      <div className="ai-studio__form">
        <label className="ai-studio__label" htmlFor="ai-objective">
          조사 목적
        </label>
        <textarea
          id="ai-objective"
          className="ai-studio__textarea"
          rows={3}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isBusy) {
              e.preventDefault()
              void runDraftAndAudit()
            }
          }}
          placeholder="예: 20대 직장인의 새 배달 앱 경험과 재이용 의향을 알고 싶어요 (⌘/Ctrl+Enter로 시작)"
          disabled={isBusy}
        />
        <div className="ai-studio__samples">
          {SAMPLE_BRIEFS.map((s) => (
            <button
              key={s}
              type="button"
              className="ai-studio__sample"
              onClick={() => setObjective(s)}
              disabled={isBusy}
            >
              {s.slice(0, 26)}…
            </button>
          ))}
        </div>

        <div className="ai-studio__controls">
          <label className="ai-studio__label" htmlFor="ai-count">
            문항 수
          </label>
          <input
            id="ai-count"
            className="ai-studio__count"
            type="number"
            min={5}
            max={12}
            value={desiredCount}
            onChange={(e) =>
              setDesiredCount(Math.min(12, Math.max(5, Number(e.target.value) || 8)))
            }
            disabled={isBusy}
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void runDraftAndAudit()}
            disabled={isBusy || objective.trim().length < 4}
          >
            {step === 'drafting'
              ? '초안 생성 중…'
              : step === 'auditing'
                ? '검수 중…'
                : '초안 + 검수 시작'}
          </button>
          {survey ? (
            <button type="button" className="btn btn--ghost" onClick={reset} disabled={isBusy}>
              초기화
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="banner" role="alert" style={{ marginTop: 12 }}>
          <span>{error}</span>
          <button
            type="button"
            className="banner__close"
            onClick={() => setError(null)}
            aria-label="오류 메시지 닫기"
          >
            ✕
          </button>
        </div>
      ) : null}

      {survey ? (
        <div className="ai-studio__result">
          <div className="ai-studio__resultHead">
            <div>
              <h4>{survey.title}</h4>
              <span className="ai-studio__meta">
                {questions.length}문항 · 모델 {providerName}
              </span>
            </div>
            {summary ? (
              <div className="ai-studio__score" aria-label={`품질 점수 ${summary.score}`}>
                <span className="ai-studio__scoreNum">{summary.score}</span>
                <span className="ai-studio__scoreUnit">/ 100</span>
              </div>
            ) : null}
          </div>

          {summary ? (
            <div className="ai-studio__chips">
              <span className="chip chip--high">심각 {summary.high}</span>
              <span className="chip chip--warn">주의 {summary.warn}</span>
              <span className="chip chip--info">참고 {summary.info}</span>
            </div>
          ) : null}

          <ol className="ai-studio__questions">
            {questions.map((q, idx) => {
              const findingsForQ = sortedFindings.filter((f) => f.questionId === q.id)
              return (
                <li key={q.id} className="ai-studio__q">
                  <div className="ai-studio__qHead">
                    <span className="ai-studio__qIdx">Q{idx + 1}</span>
                    <span className="ai-studio__qType">{q.type}</span>
                  </div>
                  <p className="ai-studio__qText">{q.text}</p>
                  {q.choices && q.choices.length > 0 ? (
                    <ul className="ai-studio__choices">
                      {q.choices.map((c) => (
                        <li key={c.id}>{c.label}</li>
                      ))}
                    </ul>
                  ) : null}
                  {findingsForQ.length > 0 ? (
                    <ul className="ai-studio__findings">
                      {findingsForQ.map((f) => (
                        <li key={f.id} className={`finding finding--${f.severity}`}>
                          <div className="finding__head">
                            <span className="finding__rule">{RULE_LABELS[f.rule]}</span>
                            <span className={`finding__sev finding__sev--${f.severity}`}>
                              {f.severity === 'high'
                                ? '심각'
                                : f.severity === 'warn'
                                  ? '주의'
                                  : '참고'}
                            </span>
                          </div>
                          <p className="finding__msg">{f.message}</p>
                          {f.suggestion ? <p className="finding__sug">{f.suggestion}</p> : null}
                          {f.fix ? (
                            <div className="finding__fix">
                              <span className="finding__fixLabel">수정안</span>
                              <code className="finding__fixText">{f.fix.text}</code>
                              <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                onClick={() => void applyFinding(f)}
                                disabled={applyingId !== null || isBusy}
                              >
                                {applyingId === f.id ? '적용하는 중…' : '적용하기'}
                              </button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ol>

          <div className="ai-studio__publish">
            <span className="ai-studio__meta">
              {questions.length}문항 준비 완료 · 타겟과 보상을 설정해 발행하세요
            </span>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setPublishOpen(true)}
              disabled={
                isBusy || step === 'published' || (summary !== undefined && summary.high > 0)
              }
              title={
                summary && summary.high > 0
                  ? '심각 이슈가 남아 있어 발행할 수 없어요. 먼저 수정안을 적용해 주세요.'
                  : undefined
              }
            >
              {step === 'published'
                ? '발행 완료'
                : step === 'publishing'
                  ? '발행하는 중…'
                  : '발행 설정 열기'}
            </button>
          </div>
        </div>
      ) : null}

      {survey && questions.length > 0 ? (
        <MobilePreview title={survey.title} category={survey.category} questions={questions} />
      ) : null}

      <PublishModal
        open={publishOpen}
        surveyTitle={survey?.title ?? ''}
        questionCount={questions.length}
        onClose={() => setPublishOpen(false)}
        onConfirm={publish}
      />
    </section>
  )
}
