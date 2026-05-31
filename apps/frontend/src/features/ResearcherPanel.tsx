import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Lock, X as XIcon } from 'lucide-react'

import { api, type FeedCard, type PanelistSummary, type Survey } from '../lib/api'
import { WalletPanel } from './WalletPanel'
import { AiStudio } from './AiStudio'
import { DashboardOverview } from './DashboardOverview'
import { InfoDot } from '../components/ui/Tooltip'

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

/** Step number badge that reflects completion state at a glance. */
function StepNum({ n, state }: { n: number; state: StepState }) {
  return (
    <span className={`step__num step__num--${state}`} aria-hidden="true">
      {state === 'done' ? (
        <Check size={15} strokeWidth={3} />
      ) : state === 'idle' ? (
        <Lock size={13} strokeWidth={2.4} />
      ) : (
        n
      )}
    </span>
  )
}

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
    pushLog('데모 설문 초안을 만드는 중이에요…')
    try {
      const dupCount = surveys.filter((s) => s.title.startsWith(seedSurveyPayload.title)).length
      const title =
        dupCount === 0 ? seedSurveyPayload.title : `${seedSurveyPayload.title} #${dupCount + 1}`
      const created = await api.createSurvey({ ...seedSurveyPayload, title })
      pushLog(`초안 생성 완료 · ${created.id}`)
      await api.publishSurvey(created.id, {
        pointsPerUser: 500,
        targetCount: 200,
        estimatedReach: 300,
      })
      pushLog('라이브 피드에 올라갔어요.')
      showToast('설문이 라이브 피드에 올라갔어요.', 'success')
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      pushLog(`발행 실패 · ${message}`)
      showToast(`발행에 실패했어요. ${message}`, 'info')
    } finally {
      setBusy(false)
    }
  }, [pushLog, refresh, showToast, surveys])

  const runResponseFlow = useCallback(async () => {
    setBusy(true)
    pushLog('패널리스트 응답 흐름을 시작해요…')
    try {
      const liveSurvey = surveys.find((survey) => survey.status === 'live')
      if (!liveSurvey) {
        throw new Error('먼저 설문을 발행해 주세요.')
      }
      const started = await api.startResponse({ pid: DEMO_PID, surveyId: liveSurvey.id })
      pushLog(`응답 세션 시작 · ${started.id}`)

      for (const question of liveSurvey.questions) {
        await wait(150)
        const latencyMs = Math.max(1_800, question.text.length * 110)
        const answer = await api.submitAnswer(started.id, {
          questionId: question.id,
          selectedChoiceIds: question.choices ? [question.choices[0].id] : [],
          latencyMs,
        })
        if (answer.abuse.level !== 'ok') {
          pushLog(`어뷰즈 감지 · 단계 ${answer.abuse.level} · 누적 ${answer.abuse.strikes}회`)
        }
        if (answer.abuse.level === 'block') {
          showToast('어뷰즈가 감지돼 응답이 중단됐어요.', 'info')
          await refresh()
          return
        }
      }

      const completion = await api.completeResponse(started.id)
      pushLog(
        `보상 +${completion.pointsAwarded}P · 펫 EXP ${completion.pet.exp} (Lv ${completion.pet.level})`,
      )
      showToast(`보상 ${completion.pointsAwarded}P가 지급됐어요.`, 'success')
      await refresh()
      window.setTimeout(() => {
        collectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      pushLog(`응답 실패 · ${message}`)
      showToast(`응답에 실패했어요. ${message}`, 'info')
    } finally {
      setBusy(false)
    }
  }, [pushLog, refresh, showToast, surveys])

  const resetDemo = useCallback(async () => {
    if (busy) return
    if (!window.confirm('데모 데이터(설문·응답·지갑·펫)를 모두 초기화할까요?')) return
    setBusy(true)
    try {
      await api.resetDemo()
      setLog([])
      setError(null)
      showToast('데모 데이터를 초기화했어요.', 'info')
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      showToast(`초기화에 실패했어요. ${message}`, 'info')
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

      <DashboardOverview surveys={surveys} onLog={pushLog} />

      <section id="workflow" aria-labelledby="workflow-heading">
        <div className="section-header">
          <div>
            <h2 id="workflow-heading">설문에서 인사이트까지, 한 흐름</h2>
            <p>설계·발행·수집을 끊김 없이 이어가면서 어뷐즈와 포 보상까지 자동으로 연결합니다.</p>
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
              <XIcon size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="steps" style={{ marginTop: 16 }}>
          <article className="step" data-state={stateFor(1)}>
            <div className="step__head">
              <StepNum n={1} state={stateFor(1)} />
              <span className="step__title">설문 설계</span>
              <InfoDot label="질문 유형과 카테고리를 골라 초안을 만들어요. 데모는 단일선택·리커트 섞인 3문항이에요." />
            </div>
            <p className="step__body">질문 유형과 카테고리를 골라 초안을 만들어요.</p>
            <div className="step__footer">
              <span className="step__meta">초안 {surveys.length}개</span>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void seedSurvey()}
                disabled={busy}
              >
                {busy ? '처리하는 중…' : '예시 설문 만들어 보기'}
              </button>
            </div>
          </article>

          <article className="step" data-state={stateFor(2)}>
            <div className="step__head">
              <StepNum n={2} state={stateFor(2)} />
              <span className="step__title">타겟 발행</span>
              <InfoDot label="포인트와 타겟 규모를 설정해 라이브 피드에 노출해요. 도달 모수가 50명 미만이면 자동으로 차단돼요." />
            </div>
            <p className="step__body">포인트와 타겟 규모를 설정해 라이브 피드에 노출해요.</p>
            <div className="step__footer">
              <span className="step__meta">라이브 {liveCount}건</span>
              <span className={`pill ${liveCount > 0 ? 'pill--live' : 'pill--draft'}`}>
                {liveCount > 0 ? '송출 중' : '대기'}
              </span>
            </div>
          </article>

          <article className="step" data-state={stateFor(3)}>
            <div className="step__head">
              <StepNum n={3} state={stateFor(3)} />
              <span className="step__title">응답 수집</span>
              <InfoDot label="응답이 제출되면 보상 포인트와 펫 EXP가 자동 적립돼요. 어뷰즈 신호가 감지되면 즉시 차단돼요." />
            </div>
            <p className="step__body">응답이 제출되면 보상 포인트와 펫 EXP가 자동 적립돼요.</p>
            <div className="step__footer">
              <span className="step__meta">
                {panelist ? `${panelist.wallet.balance.toLocaleString()} P` : '0 P'}
              </span>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void runResponseFlow()}
                disabled={busy || liveCount === 0}
                title={liveCount === 0 ? '먼저 1·2단계를 진행해 주세요.' : undefined}
              >
                응답 흐름 미리 보기
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
              <span className="card__count">총 {surveys.length}개</span>
            </div>
            {surveys.length === 0 ? (
              <p className="empty">아직 만든 설문이 없어요. 1단계에서 데모를 시작해 보세요.</p>
            ) : (
              <ul className="survey-list">
                {surveys.map((survey) => (
                  <li key={survey.id} className="survey-list__item">
                    <span className="survey-list__title">{survey.title}</span>
                    <span className={`pill pill--${survey.status}`}>
                      {survey.status === 'live'
                        ? '라이브'
                        : survey.status === 'draft'
                          ? '초안'
                          : '종료'}
                    </span>
                    <span className="survey-list__meta">
                      {survey.category} · {survey.questions.length}문항 · 난이도 {survey.difficulty}
                      {survey.deployment
                        ? ` · ${survey.deployment.pointsPerUser}P · 목표 ${survey.deployment.targetCount}명`
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
              <span className="card__count">송출 중 {liveCount}건</span>
            </div>
            {liveCount === 0 ? (
              <p className="empty">지금 노출 중인 설문이 없어요.</p>
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
                          {card.questionCount}문항 · 약{' '}
                          {Math.max(1, Math.round(card.estimatedTimeSec / 60))}분
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="panelist" aria-label="데모 패널리스트 요약">
          <p className="panelist__label">데모 패널리스트</p>
          <p className="panelist__pid">{DEMO_PID}</p>

          {panelist ? (
            <>
              <div className="panelist__stat">
                <span className="panelist__stat-value num">
                  {panelist.wallet.balance.toLocaleString()}
                </span>
                <span className="panelist__stat-unit">P · 누적 포인트</span>
              </div>

              <div className="pet-bar">
                <div className="pet-bar__head">
                  <span>펫 · Lv {panelist.pet.level}</span>
                  <span>EXP {panelist.pet.exp}</span>
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
                  ? '주의가 필요해요'
                  : (panelist.pet.evolutionStage ?? '건강한 상태')}
              </span>
            </>
          ) : (
            <p className="panelist__empty">3단계 응답 흐름을 실행하면 통계가 채워져요.</p>
          )}
        </aside>
      </section>

      <section id="wallet" className="wallet-section" aria-label="리워드 상점">
        <WalletPanel
          pid={DEMO_PID}
          balance={panelist?.wallet.balance ?? null}
          onRedeemed={() => void refresh()}
        />
      </section>

      {log.length > 0 ? (
        <section className="card" aria-label="활동 기록">
          <div className="card__head">
            <h3>활동 기록</h3>
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
