import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api, type FeedCard, type PanelistSummary, type Survey } from '../lib/api'
import { AiStudio } from './AiStudio'

const DEMO_PID = 'pid_demo_researcher'

const TINTS = ['tint-peach', 'tint-rose', 'tint-mint', 'tint-lavender', 'tint-sky', 'tint-yellow']

const seedSurveyPayload = {
  title: '커피 취향 테스트',
  category: 'beauty',
  difficulty: 2,
  questions: [
    {
      type: 'single' as const,
      text: '아메리카노와 라떼 중 더 좋아하는 음료는?',
      choices: [{ label: '아메리카노' }, { label: '라떼' }],
    },
    {
      type: 'likert' as const,
      text: '카페에서 머무는 시간을 즐기는 편이다.',
    },
    {
      type: 'single' as const,
      text: '커피를 마시는 주된 이유는 무엇인가요?',
      choices: [{ label: '집중력' }, { label: '맛' }, { label: '습관' }],
    },
  ],
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type StepState = 'idle' | 'active' | 'done'
type LogEntry = { id: string; time: string; message: string }
type Toast = { id: number; kind: 'info' | 'success'; message: string }

const makeLogEntry = (message: string): LogEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  time: new Date().toLocaleTimeString(),
  message,
})

export function ResearcherPanel() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [feed, setFeed] = useState<FeedCard[]>([])
  const [panelist, setPanelist] = useState<PanelistSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | null>(null)
  const collectRef = useRef<HTMLElement | null>(null)

  const pushLog = useCallback((message: string) => {
    setLog((prev) => [makeLogEntry(message), ...prev].slice(0, 8))
  }, [])

  const showToast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), kind, message })
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [surveyList, feedList, summary] = await Promise.all([
        api.listSurveys(),
        api.listFeed(),
        api.panelistSummary(DEMO_PID).catch(() => null),
      ])
      setSurveys(surveyList)
      setFeed(feedList)
      setPanelist(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const [surveyList, feedList, summary] = await Promise.all([
          api.listSurveys(),
          api.listFeed(),
          api.panelistSummary(DEMO_PID).catch(() => null),
        ])
        if (!isMounted) return
        setSurveys(surveyList)
        setFeed(feedList)
        setPanelist(summary)
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [])

  const seedSurvey = useCallback(async () => {
    setBusy(true)
    pushLog('데모 설문 초안을 생성합니다…')
    try {
      const dupCount = surveys.filter((s) => s.title.startsWith(seedSurveyPayload.title)).length
      const title =
        dupCount === 0 ? seedSurveyPayload.title : `${seedSurveyPayload.title} #${dupCount + 1}`
      const created = await api.createSurvey({ ...seedSurveyPayload, title })
      pushLog(`설문 초안 생성 완료 (${created.id})`)
      await api.publishSurvey(created.id, {
        pointsPerUser: 500,
        targetCount: 200,
        estimatedReach: 300,
      })
      pushLog('라이브 피드에 발행되었습니다.')
      showToast('설문이 라이브 피드에 발행되었습니다.', 'success')
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      pushLog(`설문 발행 실패: ${message}`)
      showToast(`발행 실패: ${message}`, 'info')
    } finally {
      setBusy(false)
    }
  }, [pushLog, refresh, showToast, surveys])

  const runResponseFlow = useCallback(async () => {
    setBusy(true)
    pushLog('패널리스트 응답 시뮬레이션을 시작합니다…')
    try {
      const liveSurvey = surveys.find((survey) => survey.status === 'live')
      if (!liveSurvey) {
        throw new Error('먼저 설문을 발행하세요.')
      }
      const started = await api.startResponse({ pid: DEMO_PID, surveyId: liveSurvey.id })
      pushLog(`응답 세션 시작 (${started.id})`)

      for (const question of liveSurvey.questions) {
        await wait(150)
        const latencyMs = Math.max(1_800, question.text.length * 110)
        const answer = await api.submitAnswer(started.id, {
          questionId: question.id,
          selectedChoiceIds: question.choices ? [question.choices[0].id] : [],
          latencyMs,
        })
        if (answer.abuse.level !== 'ok') {
          pushLog(`어뷰즈 ${answer.abuse.level} 감지 · strikes=${answer.abuse.strikes}`)
        }
        if (answer.abuse.level === 'block') {
          showToast('어뷰즈 차단 발생 — 응답이 중단되었습니다.', 'info')
          await refresh()
          return
        }
      }

      const completion = await api.completeResponse(started.id)
      pushLog(
        `보상 +${completion.pointsAwarded}P · 펫 EXP ${completion.pet.exp} (Lv${completion.pet.level})`,
      )
      showToast(`보상 ${completion.pointsAwarded}P가 지급되었습니다.`, 'success')
      await refresh()
      window.setTimeout(() => {
        collectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      pushLog(`응답 실패: ${message}`)
      showToast(`응답 실패: ${message}`, 'info')
    } finally {
      setBusy(false)
    }
  }, [pushLog, refresh, showToast, surveys])

  const resetDemo = useCallback(async () => {
    if (busy) return
    if (!window.confirm('데모 데이터(설문/응답/지갑/펫)를 모두 초기화합니다. 계속할까요?')) return
    setBusy(true)
    try {
      await api.resetDemo()
      setLog([])
      setError(null)
      showToast('데모 상태가 초기화되었습니다.', 'info')
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      showToast(`초기화 실패: ${message}`, 'info')
    } finally {
      setBusy(false)
    }
  }, [busy, refresh, showToast])

  const liveCount = feed.length
  const hasSurveys = surveys.length > 0
  const hasResponses = (panelist?.wallet.balance ?? 0) > 0

  const stepStates: { id: 1 | 2 | 3; state: StepState }[] = [
    { id: 1, state: hasSurveys ? 'done' : 'active' },
    { id: 2, state: liveCount > 0 ? 'done' : hasSurveys ? 'active' : 'idle' },
    { id: 3, state: hasResponses ? 'done' : liveCount > 0 ? 'active' : 'idle' },
  ]
  const stateFor = (id: 1 | 2 | 3) => stepStates.find((s) => s.id === id)?.state ?? 'idle'

  const petPercent = useMemo(() => {
    if (!panelist) return 0
    const thresholds = [0, 50, 120, 220, 360, 540, 760, 1020, 1320, 1660, 2040]
    const lvl = Math.min(panelist.pet.level, thresholds.length - 1)
    const base = thresholds[lvl - 1] ?? 0
    const next = thresholds[lvl] ?? base + 100
    if (next === base) return 100
    return Math.min(100, Math.max(0, Math.round(((panelist.pet.exp - base) / (next - base)) * 100)))
  }, [panelist])

  return (
    <>
      {busy ? <div className="busy-bar" aria-hidden /> : null}

      <AiStudio
        onPublished={() => {
          void refresh()
        }}
        onLog={pushLog}
        onToast={showToast}
      />

      <section id="workflow" aria-labelledby="workflow-heading">
        <div className="section-header">
          <div>
            <h2 id="workflow-heading">3단계 워크플로우</h2>
            <p>설계 · 발행 · 수집을 한 화면에서 흐르듯 실행합니다.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void refresh()}
              disabled={busy}
            >
              새로고침
            </button>
            {import.meta.env.PROD ? null : (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void resetDemo()}
                disabled={busy}
              >
                데모 초기화
              </button>
            )}
          </div>
        </div>

        {error ? (
          <div className="banner" role="alert">
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

        <div className="steps" style={{ marginTop: 16 }}>
          <article className="step" data-state={stateFor(1)}>
            <div className="step__head">
              <span className="step__num">1</span>
              <span className="step__title">설문 설계</span>
            </div>
            <p className="step__body">
              질문 유형과 카테고리를 선택해 초안을 만듭니다. 데모 설문은 단일선택과 리커트 척도를
              혼합한 3문항으로 구성됩니다.
            </p>
            <div className="step__footer">
              <span className="step__meta">{surveys.length} drafts</span>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void seedSurvey()}
                disabled={busy}
              >
                {busy ? '처리중…' : '데모 설문 생성'}
              </button>
            </div>
          </article>

          <article className="step" data-state={stateFor(2)}>
            <div className="step__head">
              <span className="step__num">2</span>
              <span className="step__title">타겟 발행</span>
            </div>
            <p className="step__body">
              포인트와 타겟 규모를 설정해 라이브 피드에 노출합니다. 타겟이 50명 미만이면 자동으로
              차단됩니다.
            </p>
            <div className="step__footer">
              <span className="step__meta">{liveCount} live</span>
              <span className={`pill ${liveCount > 0 ? 'pill--live' : 'pill--draft'}`}>
                {liveCount > 0 ? 'Broadcasting' : 'Pending'}
              </span>
            </div>
          </article>

          <article className="step" data-state={stateFor(3)}>
            <div className="step__head">
              <span className="step__num">3</span>
              <span className="step__title">응답 수집</span>
            </div>
            <p className="step__body">
              데모 패널리스트가 응답을 제출하고, 보상 포인트와 펫 EXP가 자동으로 적립됩니다. 어뷰즈
              신호가 감지되면 즉시 차단됩니다.
            </p>
            <div className="step__footer">
              <span className="step__meta">
                {panelist ? `${panelist.wallet.balance.toLocaleString()} P` : '0 P'}
              </span>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void runResponseFlow()}
                disabled={busy || liveCount === 0}
                title={liveCount === 0 ? '먼저 1·2단계를 실행하세요.' : undefined}
              >
                응답 시뮬레이션
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="cols" id="feed" aria-labelledby="library-heading">
        <div style={{ display: 'grid', gap: 24, minWidth: 0 }}>
          <div className="card">
            <div className="card__head">
              <h3 id="library-heading">설문 라이브러리</h3>
              <span className="card__count">{surveys.length} total</span>
            </div>
            {surveys.length === 0 ? (
              <p className="empty">아직 설문이 없습니다. 1단계에서 데모를 생성해 보세요.</p>
            ) : (
              <ul className="survey-list">
                {surveys.map((survey) => (
                  <li key={survey.id} className="survey-list__item">
                    <span className="survey-list__title">{survey.title}</span>
                    <span className={`pill pill--${survey.status}`}>{survey.status}</span>
                    <span className="survey-list__meta">
                      {survey.category} · {survey.questions.length}Q · difficulty{' '}
                      {survey.difficulty}
                      {survey.deployment
                        ? ` · ${survey.deployment.pointsPerUser}P · target ${survey.deployment.targetCount}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <section className="card" ref={collectRef} aria-labelledby="livefeed-heading">
            <div className="card__head">
              <h3 id="livefeed-heading">라이브 피드</h3>
              <span className="card__count">{liveCount} broadcasting</span>
            </div>
            {liveCount === 0 ? (
              <p className="empty">현재 발행된 설문이 없습니다.</p>
            ) : (
              <div className="feed-grid">
                {feed.map((card, index) => {
                  const tint = TINTS[index % TINTS.length]
                  return (
                    <article
                      key={card.id}
                      className="feed-card"
                      style={{ background: `var(--${tint})` }}
                    >
                      <span className="feed-card__category">{card.category}</span>
                      <h4 className="feed-card__title">{card.title}</h4>
                      <div className="feed-card__footer">
                        <span className="feed-card__reward">{card.pointsPerUser} P</span>
                        <span>
                          {card.questionCount}Q · ~
                          {Math.max(1, Math.round(card.estimatedTimeSec / 60))}m
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="panelist" aria-label="Demo panelist summary">
          <p className="panelist__label">Demo panelist</p>
          <p className="panelist__pid">{DEMO_PID}</p>

          {panelist ? (
            <>
              <div className="panelist__stat">
                <span className="panelist__stat-value">
                  {panelist.wallet.balance.toLocaleString()}
                </span>
                <span className="panelist__stat-unit">Points earned</span>
              </div>

              <div className="pet-bar">
                <div className="pet-bar__head">
                  <span>Pet · Lv {panelist.pet.level}</span>
                  <span>{panelist.pet.exp} EXP</span>
                </div>
                <div
                  className="pet-bar__track"
                  role="progressbar"
                  aria-label={`펫 레벨 ${panelist.pet.level} 경험치`}
                  aria-valuenow={petPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="pet-bar__fill" style={{ width: `${petPercent}%` }} />
                </div>
              </div>

              <span className={`pet-tag ${panelist.pet.sick ? 'is-sick' : ''}`}>
                {panelist.pet.sick
                  ? 'Sick · 어뷰즈 패널티'
                  : (panelist.pet.evolutionStage ?? 'Healthy')}
              </span>
            </>
          ) : (
            <p className="panelist__empty">3단계 응답 시뮬레이션을 실행하면 통계가 채워집니다.</p>
          )}
        </aside>
      </section>

      {log.length > 0 ? (
        <section className="card" aria-label="Activity log">
          <div className="card__head">
            <h3>Activity</h3>
            <span className="card__count">최근 {log.length}건</span>
          </div>
          <div className="log">
            {log.map((entry) => (
              <div key={entry.id} className="log__item">
                <span className="log__time">{entry.time}</span>
                {entry.message}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {toast ? (
        <div className={`toast toast--${toast.kind}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}
    </>
  )
}
