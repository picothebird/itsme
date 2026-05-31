import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard,
  FolderKanban,
  Wand2,
  BarChart3,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Sparkles,
  X as XIcon,
  ArrowRight,
  Clock,
  Users,
  type LucideIcon,
} from 'lucide-react'

import {
  api,
  type FeedCard,
  type PanelistSummary,
  type Survey,
  type ManagedStudy,
  type Application,
  type ApplicationStatus,
} from '../lib/api'
import { AiStudio } from './AiStudio'
import { DashboardOverview } from './DashboardOverview'
import { InfoDot } from '../components/ui/Tooltip'

const DEMO_PID = 'pid_demo_researcher'

const TINTS = ['tint-peach', 'tint-rose', 'tint-mint', 'tint-lavender', 'tint-sky', 'tint-yellow']

const STATUS_LABEL: Record<Survey['status'], string> = {
  draft: '초안',
  live: '라이브',
  done: '종료',
}

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

type LogEntry = { id: string; time: string; message: string }
type Toast = { id: number; kind: 'info' | 'success'; message: string }

const makeLogEntry = (message: string): LogEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  time: new Date().toLocaleTimeString(),
  message,
})

type PageId = 'dashboard' | 'surveys' | 'research' | 'studio' | 'insights'

const NAV: { id: PageId; label: string; icon: LucideIcon; hint: string }[] = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard, hint: '운영 현황 요약' },
  { id: 'surveys', label: '설문', icon: FolderKanban, hint: '초안·라이브·종료 관리' },
  { id: 'research', label: '관리 리서치', icon: Users, hint: '신청·선정·일정 관리' },
  { id: 'studio', label: '설계 스튜디오', icon: Wand2, hint: 'AI로 설문 만들기' },
  { id: 'insights', label: '인사이트', icon: BarChart3, hint: '응답 분석과 내보내기' },
]

export function ResearcherWorkspace() {
  const [page, setPage] = useState<PageId>('dashboard')
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [feed, setFeed] = useState<FeedCard[]>([])
  const [panelist, setPanelist] = useState<PanelistSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | null>(null)

  const pushLog = useCallback((message: string) => {
    setLog((prev) => [makeLogEntry(message), ...prev].slice(0, 12))
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      pushLog(`응답 실패 · ${message}`)
      showToast(`응답에 실패했어요. ${message}`, 'info')
    } finally {
      setBusy(false)
    }
  }, [pushLog, refresh, showToast, surveys])

  const closeSurvey = useCallback(
    async (survey: Survey) => {
      if (busy) return
      if (!window.confirm(`'${survey.title}' 설문을 종료할까요? 더 이상 노출되지 않아요.`)) return
      setBusy(true)
      try {
        await api.closeSurvey(survey.id)
        pushLog(`설문 종료 · ${survey.title}`)
        showToast('설문을 종료했어요.', 'success')
        await refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        showToast(`종료에 실패했어요. ${message}`, 'info')
      } finally {
        setBusy(false)
      }
    },
    [busy, pushLog, refresh, showToast],
  )

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
  const activePage = NAV.find((n) => n.id === page)

  return (
    <div className="workspace">
      <aside className="workspace__nav" aria-label="리서처 메뉴">
        <nav className="wnav">
          {NAV.map((item) => {
            const Icon = item.icon
            const isActive = item.id === page
            return (
              <button
                key={item.id}
                type="button"
                className={`wnav__item${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setPage(item.id)}
              >
                <Icon size={18} strokeWidth={2.1} aria-hidden="true" />
                <span className="wnav__label">{item.label}</span>
                <span className="wnav__hint">{item.hint}</span>
              </button>
            )
          })}
        </nav>
        <button
          type="button"
          className="wnav__cta"
          onClick={() => setPage('studio')}
          disabled={busy}
        >
          <Plus size={16} strokeWidth={2.6} aria-hidden="true" />새 설문 만들기
        </button>
      </aside>

      <main className="workspace__main">
        {busy ? <div className="busy-bar" aria-hidden /> : null}

        <header className="workspace__head">
          <div>
            <h1 className="workspace__title">{activePage?.label}</h1>
            <p className="workspace__sub">{activePage?.hint}</p>
          </div>
          <div className="workspace__actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => void refresh()}
              disabled={busy}
            >
              <RefreshCw size={15} strokeWidth={2.2} aria-hidden="true" />
              새로고침
            </button>
            {import.meta.env.PROD ? null : (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => void resetDemo()}
                disabled={busy}
              >
                <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
                데모 초기화
              </button>
            )}
          </div>
        </header>

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

        {page === 'dashboard' ? (
          <DashboardPage
            surveys={surveys}
            feed={feed}
            panelist={panelist}
            log={log}
            liveCount={liveCount}
            busy={busy}
            onLog={pushLog}
            onSeed={() => void seedSurvey()}
            onRunFlow={() => void runResponseFlow()}
            onGoStudio={() => setPage('studio')}
            onGoSurveys={() => setPage('surveys')}
            onGoInsights={() => setPage('insights')}
          />
        ) : null}

        {page === 'surveys' ? (
          <SurveysPage
            surveys={surveys}
            feed={feed}
            busy={busy}
            onGoStudio={() => setPage('studio')}
            onSeed={() => void seedSurvey()}
            onClose={(survey) => void closeSurvey(survey)}
          />
        ) : null}

        {page === 'research' ? <ResearchPage onLog={pushLog} onToast={showToast} /> : null}

        {page === 'studio' ? (
          <AiStudio onPublished={() => void refresh()} onLog={pushLog} onToast={showToast} />
        ) : null}

        {page === 'insights' ? (
          <DashboardOverview surveys={surveys} onLog={pushLog} view="insights" />
        ) : null}
      </main>

      {toast ? (
        <div className={`toast toast--${toast.kind}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dashboard page                                                      */
/* ------------------------------------------------------------------ */

type DashboardPageProps = {
  surveys: Survey[]
  feed: FeedCard[]
  panelist: PanelistSummary | null
  log: LogEntry[]
  liveCount: number
  busy: boolean
  onLog: (m: string) => void
  onSeed: () => void
  onRunFlow: () => void
  onGoStudio: () => void
  onGoSurveys: () => void
  onGoInsights: () => void
}

function DashboardPage({
  surveys,
  feed,
  panelist,
  log,
  liveCount,
  busy,
  onLog,
  onSeed,
  onRunFlow,
  onGoStudio,
  onGoSurveys,
  onGoInsights,
}: DashboardPageProps) {
  const draftCount = surveys.filter((s) => s.status === 'draft').length
  const petPercent = useMemo(() => {
    if (!panelist) return 0
    const base = panelist.pet.level * 100
    const next = (panelist.pet.level + 1) * 100
    return Math.min(100, Math.max(0, Math.round(((panelist.pet.exp - base) / (next - base)) * 100)))
  }, [panelist])

  return (
    <div className="page-grid">
      <DashboardOverview surveys={surveys} onLog={onLog} view="kpi" />

      <div className="dash-cols">
        <section className="card quickstart" aria-label="빠른 시작">
          <div className="card__head">
            <h3>
              빠른 시작
              <InfoDot label="설문을 직접 만들기 전에, 데모 데이터로 발행–응답–보상 흐름을 한 번에 체험해 볼 수 있어요." />
            </h3>
          </div>
          <ol className="quickstart__steps">
            <li className="quickstart__step">
              <span className="quickstart__num">1</span>
              <div className="quickstart__body">
                <strong>설문 만들기</strong>
                <span>AI 스튜디오에서 목적만 적으면 초안이 완성돼요.</span>
              </div>
              <button type="button" className="btn btn--primary btn--sm" onClick={onGoStudio}>
                <Wand2 size={14} strokeWidth={2.2} aria-hidden="true" />
                열기
              </button>
            </li>
            <li className="quickstart__step">
              <span className="quickstart__num">2</span>
              <div className="quickstart__body">
                <strong>데모 설문 발행</strong>
                <span>예시 설문을 즉시 라이브 피드에 올려 봐요.</span>
              </div>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={onSeed}
                disabled={busy}
              >
                {busy ? '처리 중…' : '발행'}
              </button>
            </li>
            <li className="quickstart__step">
              <span className="quickstart__num">3</span>
              <div className="quickstart__body">
                <strong>응답 흐름 체험</strong>
                <span>데모 패널이 응답하고 보상·EXP가 적립돼요.</span>
              </div>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={onRunFlow}
                disabled={busy || liveCount === 0}
                title={liveCount === 0 ? '먼저 설문을 발행해 주세요.' : undefined}
              >
                <Play size={14} strokeWidth={2.4} aria-hidden="true" />
                실행
              </button>
            </li>
          </ol>
        </section>

        <section className="card" aria-label="진행 현황">
          <div className="card__head">
            <h3>진행 현황</h3>
            <button type="button" className="card__link" onClick={onGoSurveys}>
              설문 관리 <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
          <div className="status-row">
            <div className="status-pill status-pill--draft">
              <span className="status-pill__value num">{draftCount}</span>
              <span className="status-pill__label">초안</span>
            </div>
            <div className="status-pill status-pill--live">
              <span className="status-pill__value num">{liveCount}</span>
              <span className="status-pill__label">라이브</span>
            </div>
            <div className="status-pill status-pill--done">
              <span className="status-pill__value num">
                {surveys.filter((s) => s.status === 'done').length}
              </span>
              <span className="status-pill__label">종료</span>
            </div>
          </div>

          {panelist ? (
            <div className="pet-mini">
              <div className="pet-mini__head">
                <span>데모 패널 · Lv {panelist.pet.level}</span>
                <span className="num">{panelist.wallet.balance.toLocaleString()} P</span>
              </div>
              <div className="pet-bar__track" aria-hidden="true">
                <div className="pet-bar__fill" style={{ width: `${petPercent}%` }} />
              </div>
            </div>
          ) : (
            <p className="empty">응답 흐름을 실행하면 패널 통계가 채워져요.</p>
          )}
        </section>
      </div>

      <div className="dash-cols">
        <section className="card" aria-label="진행 중인 설문">
          <div className="card__head">
            <h3>진행 중인 설문</h3>
            <button type="button" className="card__link" onClick={onGoInsights}>
              인사이트 <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
          {liveCount === 0 ? (
            <p className="empty">지금 노출 중인 설문이 없어요. 빠른 시작에서 발행해 보세요.</p>
          ) : (
            <div className="feed-grid">
              {feed.slice(0, 4).map((card, index) => {
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

        <section className="card" aria-label="최근 활동">
          <div className="card__head">
            <h3>최근 활동</h3>
            <span className="card__count">{log.length}건</span>
          </div>
          {log.length === 0 ? (
            <p className="empty">아직 활동 기록이 없어요.</p>
          ) : (
            <div className="log">
              {log.slice(0, 8).map((entry) => (
                <div key={entry.id} className="log__item">
                  <Clock size={12} strokeWidth={2.2} aria-hidden="true" />
                  <span className="log__time">{entry.time}</span>
                  {entry.message}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Surveys page                                                        */
/* ------------------------------------------------------------------ */

type SurveysPageProps = {
  surveys: Survey[]
  feed: FeedCard[]
  busy: boolean
  onGoStudio: () => void
  onSeed: () => void
  onClose: (survey: Survey) => void
}

function SurveysPage({ surveys, feed, busy, onGoStudio, onSeed, onClose }: SurveysPageProps) {
  const grouped: Record<Survey['status'], Survey[]> = {
    draft: surveys.filter((s) => s.status === 'draft'),
    live: surveys.filter((s) => s.status === 'live'),
    done: surveys.filter((s) => s.status === 'done'),
  }

  return (
    <div className="page-grid">
      <section className="card create-banner" aria-label="새 설문">
        <div className="create-banner__copy">
          <Sparkles size={20} strokeWidth={2.2} aria-hidden="true" />
          <div>
            <h3>새 설문을 만들어 볼까요?</h3>
            <p>조사 목적만 적으면 AI가 초안·검수·발행까지 도와드려요.</p>
          </div>
        </div>
        <div className="create-banner__actions">
          <button type="button" className="btn btn--primary" onClick={onGoStudio}>
            <Wand2 size={15} strokeWidth={2.2} aria-hidden="true" />
            스튜디오 열기
          </button>
          <button type="button" className="btn btn--ghost" onClick={onSeed} disabled={busy}>
            데모 설문 발행
          </button>
        </div>
      </section>

      <section className="board" aria-label="설문 보드">
        {(['draft', 'live', 'done'] as const).map((status) => (
          <div key={status} className={`board__col board__col--${status}`}>
            <header className="board__head">
              <span className="board__title">{STATUS_LABEL[status]}</span>
              <span className="board__count">{grouped[status].length}</span>
            </header>
            <div className="board__list">
              {grouped[status].length === 0 ? (
                <p className="board__empty">아직 없어요</p>
              ) : (
                grouped[status].map((s) => (
                  <article key={s.id} className="board__card">
                    <span className="board__cardTitle">{s.title}</span>
                    <span className="board__cardMeta">
                      {s.category} · {s.questions.length}문항 · 난이도 {s.difficulty}
                    </span>
                    {s.deployment ? (
                      <span className="board__cardDeploy">
                        {s.deployment.pointsPerUser}P · 목표 {s.deployment.targetCount}명
                      </span>
                    ) : null}
                    {status === 'live' ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm board__cardClose"
                        onClick={() => onClose(s)}
                        disabled={busy}
                      >
                        종료
                      </button>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="card" aria-labelledby="livefeed-heading">
        <div className="card__head">
          <h3 id="livefeed-heading">라이브 피드</h3>
          <span className="card__count">송출 중 {feed.length}건</span>
        </div>
        {feed.length === 0 ? (
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
  )
}

/* ------------------------------------------------------------------ */
/* Managed research page                                               */
/* ------------------------------------------------------------------ */

const STUDY_TYPE_LABEL: Record<ManagedStudy['type'], string> = {
  interview: '심층 인터뷰',
  usability: '사용성 테스트',
  diary: '다이어리',
}

const APP_STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: '신청 완료',
  screening: '스크리닝 중',
  review: '검토 중',
  selected: '선정됨',
  rejected: '미선정',
  scheduled: '일정 확정',
  in_session: '진행 중',
  completed: '완료',
  paid: '보상 지급',
}

const APP_STATUS_TONE: Record<ApplicationStatus, 'wait' | 'go' | 'stop' | 'done'> = {
  applied: 'wait',
  screening: 'wait',
  review: 'wait',
  selected: 'go',
  rejected: 'stop',
  scheduled: 'go',
  in_session: 'go',
  completed: 'done',
  paid: 'done',
}

// Mirrors backend APPLICATION_TRANSITIONS for offering valid next actions.
const APP_NEXT: Record<ApplicationStatus, ApplicationStatus[]> = {
  applied: ['screening', 'rejected'],
  screening: ['review', 'rejected'],
  review: ['selected', 'rejected'],
  selected: ['scheduled', 'rejected'],
  scheduled: ['in_session', 'rejected'],
  in_session: ['completed'],
  completed: ['paid'],
  rejected: [],
  paid: [],
}

// Linear happy-path used to render the progress stepper (rejected is off-path).
const APP_STATUS_FLOW: ApplicationStatus[] = [
  'applied',
  'screening',
  'review',
  'selected',
  'scheduled',
  'in_session',
  'completed',
  'paid',
]

type ResearchPageProps = {
  onLog: (m: string) => void
  onToast: (m: string, kind?: Toast['kind']) => void
}

function ResearchPage({ onLog, onToast }: ResearchPageProps) {
  const [studies, setStudies] = useState<ManagedStudy[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [applicants, setApplicants] = useState<Application[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const loadedRef = useRef(false)

  const loadApplicants = useCallback(
    async (studyId: string) => {
      try {
        const list = await api.research.applicants(studyId)
        setApplicants(list)
      } catch (err) {
        onToast(err instanceof Error ? err.message : '신청자를 불러오지 못했어요.', 'info')
        setApplicants([])
      }
    },
    [onToast],
  )

  const loadStudies = useCallback(async () => {
    try {
      const list = await api.research.studies()
      setStudies(list)
      const firstId = list[0]?.id ?? null
      setSelectedId((prev) => prev ?? firstId)
      if (firstId) await loadApplicants(firstId)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '스터디를 불러오지 못했어요.', 'info')
    }
  }, [onToast, loadApplicants])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void loadStudies()
  }, [loadStudies])

  const selectStudy = useCallback(
    (studyId: string) => {
      setSelectedId(studyId)
      setExpandedId(null)
      void loadApplicants(studyId)
    },
    [loadApplicants],
  )

  const closeStudy = useCallback(() => {
    setSelectedId(null)
    setExpandedId(null)
  }, [])

  const selectedStudy = useMemo(
    () => studies.find((s) => s.id === selectedId) ?? null,
    [studies, selectedId],
  )

  const counts = useMemo(() => {
    const selectedCount = applicants.filter((a) =>
      ['selected', 'scheduled', 'in_session', 'completed', 'paid'].includes(a.status),
    ).length
    return { total: applicants.length, selected: selectedCount }
  }, [applicants])

  const transition = useCallback(
    async (application: Application, to: ApplicationStatus) => {
      if (!selectedId) return
      if (to === 'rejected' && !window.confirm(`${application.pid} 신청자를 미선정 처리할까요?`)) {
        return
      }
      setBusyId(application.id)
      try {
        await api.research.transition(application.id, { to })
        onLog(`신청 ${application.id} → ${APP_STATUS_LABEL[to]}`)
        onToast(`${APP_STATUS_LABEL[to]}(으)로 변경했어요.`, 'success')
        await loadApplicants(selectedId)
      } catch (err) {
        onToast(err instanceof Error ? err.message : '상태를 변경하지 못했어요.', 'info')
      } finally {
        setBusyId(null)
      }
    },
    [selectedId, loadApplicants, onLog, onToast],
  )

  return (
    <div className="page-grid">
      <section className="card" aria-label="관리 리서치">
        <div className="card__head">
          <h3>관리 리서치</h3>
          <span className="card__count">스터디 {studies.length}개</span>
        </div>
        {studies.length === 0 ? (
          <p className="empty">진행 중인 관리 리서치가 없어요.</p>
        ) : (
          <div className="rs-studies">
            {studies.map((study) => {
              const isActive = study.id === selectedId
              return (
                <button
                  key={study.id}
                  type="button"
                  className={`rs-study${isActive ? ' is-active' : ''}`}
                  onClick={() => selectStudy(study.id)}
                  aria-pressed={isActive}
                >
                  <span className="rs-study__type">{STUDY_TYPE_LABEL[study.type]}</span>
                  <span className="rs-study__title">{study.title}</span>
                  <span className="rs-study__meta">
                    {study.incentivePoints.toLocaleString()}P · {study.estimatedMinutes}분 · 정원{' '}
                    {study.capacity}명
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {selectedStudy ? (
        <section className="card" aria-label="신청자 관리">
          <div className="card__head">
            <h3>{selectedStudy.title} · 신청자</h3>
            <div className="rs-app__headtools">
              <span className="card__count">
                {counts.total}명 신청 · {counts.selected}명 선정
              </span>
              <button type="button" className="btn btn--sm btn--ghost" onClick={closeStudy}>
                닫기
              </button>
            </div>
          </div>

          {applicants.length === 0 ? (
            <p className="empty">아직 신청자가 없어요.</p>
          ) : (
            <div className="rs-applist">
              {applicants.map((app) => {
                const tone = APP_STATUS_TONE[app.status]
                const nexts = APP_NEXT[app.status]
                const stepIndex = APP_STATUS_FLOW.indexOf(app.status)
                const isRejected = app.status === 'rejected'
                const isExpanded = expandedId === app.id
                return (
                  <article key={app.id} className="rs-app">
                    <div className="rs-app__main">
                      <span className="rs-app__pid">{app.pid}</span>
                      <span className={`rs-app__status rs-app__status--${tone}`}>
                        {APP_STATUS_LABEL[app.status]}
                      </span>
                    </div>
                    {isRejected ? (
                      <p className="rs-app__rejected">미선정 처리된 신청자예요.</p>
                    ) : (
                      <ol className="rs-stepper" aria-label="진행 단계">
                        {APP_STATUS_FLOW.map((step, idx) => (
                          <li
                            key={step}
                            className={`rs-stepper__step${
                              idx < stepIndex ? ' is-done' : idx === stepIndex ? ' is-current' : ''
                            }`}
                            title={APP_STATUS_LABEL[step]}
                          >
                            <span className="rs-stepper__dot" aria-hidden="true" />
                          </li>
                        ))}
                      </ol>
                    )}
                    <div className="rs-app__meta">
                      <button
                        type="button"
                        className="rs-app__answers-toggle"
                        onClick={() => setExpandedId(isExpanded ? null : app.id)}
                        aria-expanded={isExpanded}
                        disabled={app.screenerAnswers.length === 0}
                      >
                        응답 {app.screenerAnswers.length}개
                        {app.screenerAnswers.length > 0 ? (isExpanded ? ' 접기' : ' 보기') : ''}
                      </button>
                      <span>·</span>
                      <span>이력 {app.history.length}단계</span>
                      {app.scheduledAt ? (
                        <>
                          <span>·</span>
                          <span>일정 {new Date(app.scheduledAt).toLocaleString('ko-KR')}</span>
                        </>
                      ) : null}
                    </div>
                    {isExpanded && app.screenerAnswers.length > 0 ? (
                      <dl className="rs-app__answers">
                        {app.screenerAnswers.map((qa, idx) => (
                          <div key={`${qa.questionId}-${idx}`} className="rs-app__answer">
                            <dt>{qa.questionId}</dt>
                            <dd>{qa.answer}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {nexts.length > 0 ? (
                      <div className="rs-app__actions">
                        {nexts.map((to) => (
                          <button
                            key={to}
                            type="button"
                            className={`btn btn--sm ${
                              to === 'rejected' ? 'btn--ghost' : 'btn--secondary'
                            }`}
                            onClick={() => void transition(app, to)}
                            disabled={busyId === app.id}
                          >
                            {APP_STATUS_LABEL[to]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rs-app__final">최종 상태예요.</p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
