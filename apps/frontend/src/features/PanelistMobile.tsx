import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  X,
  Check,
  Gem,
  Flame,
  ChevronRight,
  Angry,
  Frown,
  Meh,
  Smile,
  Laugh,
  Sparkles,
  Layers,
  Gift,
  Sprout,
  Heart,
  ClipboardList,
  Settings,
  LogOut,
  MessageCircle,
  ArrowUp,
  Download,
} from 'lucide-react'

import {
  api,
  streamChat,
  downloadItsme,
  type ChatMessage,
  type Account,
  type FeedCard,
  type PanelistSummary,
  type Survey,
  type RewardItem,
  type RewardOrder,
  type DataPiece,
  type ManagedStudy,
  type ApplicationWithStudy,
  type ApplicationStatus,
} from '../lib/api'
import { celebrate } from '../lib/celebrate'
import { readPmTheme, setPmTheme, type PmTheme } from '../lib/pmTheme'
import { useDialogA11y } from '../lib/useDialogA11y'
import { useAutoDismissToast } from '../lib/useAutoDismissToast'
import { PetCreature } from './PetCreature'
import { creatureStageFromLevel } from '../lib/petStage'

type Stage = 'deck' | 'responding' | 'complete'
type Tab = 'deck' | 'tasks' | 'pet' | 'chat' | 'shop'

type Reward = {
  pointsAwarded: number
  pet: {
    exp: number
    level: number
    evolutionStage: string | null
    expGained: number
    prevLevel: number
    leveledUp: boolean
    streak: number
  }
}

type Props = {
  pid: string
  account?: Account
  onClose?: () => void
  onLogout?: () => void
}

const PROVIDER_LABEL: Record<Account['provider'], string> = {
  kakao: '카카오',
  apple: 'Apple',
  google: 'Google',
}

const REDUCE_FX_KEY = 'pm-reduce-motion'
const readReduceFx = () =>
  typeof localStorage !== 'undefined' && localStorage.getItem(REDUCE_FX_KEY) === '1'

export function PanelistMobile({ pid, account, onClose, onLogout }: Props) {
  const [stage, setStage] = useState<Stage>('deck')
  const [tab, setTab] = useState<Tab>('deck')
  const [feed, setFeed] = useState<FeedCard[]>([])
  const [me, setMe] = useState<PanelistSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [topCardIndex, setTopCardIndex] = useState(0)

  const [responding, setResponding] = useState<{
    survey: Survey
    responseId: string
    questionIndex: number
    startedAt: number
  } | null>(null)
  const [reward, setReward] = useState<Reward | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reduceFx, setReduceFx] = useState(readReduceFx)
  const [theme, setTheme] = useState<PmTheme>(readPmTheme)
  const [exporting, setExporting] = useState(false)

  const loadAll = useCallback(async () => {
    const [feedList, summary] = await Promise.all([
      api.listFeed(),
      api.panelistSummary(pid).catch(() => null),
    ])
    setFeed(feedList)
    setMe(summary)
    setTopCardIndex(0)
    setLoading(false)
  }, [pid])

  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void (async () => {
      await loadAll()
      // §오프라인 복구 — 진행 중이던 응답이 있으면 이어서 시작
      const key = `pm-active-${pid}`
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
      if (!raw) return
      try {
        const saved = JSON.parse(raw) as { surveyId: string; responseId: string }
        const active = await api.getActiveResponse(pid, saved.surveyId)
        if (!active || active.response.id !== saved.responseId) {
          localStorage.removeItem(key)
          return
        }
        const surveys = await api.listSurveys()
        const survey = surveys.find((s) => s.id === saved.surveyId)
        if (!survey) {
          localStorage.removeItem(key)
          return
        }
        setResponding({
          survey,
          responseId: saved.responseId,
          questionIndex: Math.min(active.nextQuestionIndex, survey.questions.length - 1),
          startedAt: Date.now(),
        })
        setStage('responding')
        setWarning('이어서 응답을 계속할 수 있어요.')
      } catch {
        localStorage.removeItem(key)
      }
    })()
  }, [loadAll, pid])

  // §오프라인 복구 — 진행 상태를 로컬에 저장(중단/완료 시 정리)
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    const key = `pm-active-${pid}`
    if (responding) {
      localStorage.setItem(
        key,
        JSON.stringify({ surveyId: responding.survey.id, responseId: responding.responseId }),
      )
    } else {
      localStorage.removeItem(key)
    }
  }, [responding, pid])

  const currentCard = feed[topCardIndex]

  const handleAccept = useCallback(
    async (card?: FeedCard) => {
      const target = card ?? currentCard
      if (!target) return
      if (blockedUntil !== null && blockedUntil > Date.now()) {
        setWarning('아직 응답이 제한된 상태예요. 잠시 후 다시 참여해 주세요.')
        return
      }
      setError(null)
      try {
        const surveys = await api.listSurveys()
        const survey = surveys.find((s) => s.id === target.id)
        if (!survey) {
          setError('설문 정보를 불러오지 못했어요')
          return
        }
        const { id: responseId } = await api.startResponse({
          pid,
          surveyId: survey.id,
        })
        setResponding({
          survey,
          responseId,
          questionIndex: 0,
          startedAt: Date.now(),
        })
        setStage('responding')
      } catch (err) {
        setError(err instanceof Error ? err.message : '설문을 시작할 수 없어요')
      }
    },
    [currentCard, pid, blockedUntil],
  )

  const submitAnswer = useCallback(
    async (selectedChoiceIds: string[]) => {
      if (!responding) return
      const { survey, responseId, questionIndex, startedAt } = responding
      const question = survey.questions[questionIndex]
      if (!question) return
      setSubmitting(true)
      try {
        const outcome = await api.submitAnswer(responseId, {
          questionId: question.id,
          selectedChoiceIds,
          latencyMs: Math.max(300, Date.now() - startedAt),
        })
        if (outcome.abuse.level === 'block') {
          const until = outcome.abuse.blockedUntil
            ? new Date(outcome.abuse.blockedUntil).getTime()
            : Date.now() + 10 * 60 * 1000
          setBlockedUntil(until)
          setWarning(null)
          setResponding(null)
          setStage('deck')
          void loadAll()
          return
        }
        if (outcome.abuse.level === 'warn') {
          setWarning('너무 빠르거나 비슷한 응답이 감지됐어요. 천천히 정확하게 답해 주세요.')
        } else {
          setWarning(null)
        }
        const isLast = questionIndex >= survey.questions.length - 1
        if (isLast) {
          const result = await api.completeResponse(responseId)
          setReward(result)
          setStage('complete')
          setResponding(null)
          void loadAll()
        } else {
          setResponding({
            ...responding,
            questionIndex: questionIndex + 1,
            startedAt: Date.now(),
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '답변 전송에 실패했어요')
      } finally {
        setSubmitting(false)
      }
    },
    [responding, loadAll],
  )

  const exitResponse = useCallback(() => {
    setConfirmExit(false)
    setResponding(null)
    setWarning(null)
    setStage('deck')
  }, [])

  const continueAfterReward = useCallback(() => {
    setReward(null)
    setStage('deck')
  }, [])

  // §에러 토스트 자동 해제(6초) — 일시적 오류가 상단을 영구히 가리지 않도록(경고 토스트는 흐름상 유지)
  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(() => setError(null), 6000)
    return () => window.clearTimeout(id)
  }, [error])

  // §어뷰징 차단 쿨다운 카운트다운 (1초 틱, 종료 시 자동 해제)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  useEffect(() => {
    if (blockedUntil === null) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000))
      setCooldownLeft(left)
      if (left <= 0) setBlockedUntil(null)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [blockedUntil])

  // §바텀시트 다이얼로그 접근성(Escape·포커스 트랩·포커스 복원)
  const exitSheetRef = useDialogA11y<HTMLDivElement>(confirmExit, () => setConfirmExit(false))
  const blockSheetRef = useDialogA11y<HTMLDivElement>(
    blockedUntil !== null && cooldownLeft > 0,
    () => setBlockedUntil(null),
  )
  const settingsSheetRef = useDialogA11y<HTMLDivElement>(settingsOpen, () => setSettingsOpen(false))

  const toggleReduceFx = () => {
    setReduceFx((prev) => {
      const next = !prev
      try {
        localStorage.setItem(REDUCE_FX_KEY, next ? '1' : '0')
      } catch {
        // localStorage 접근 불가 시 무시 (세션 한정으로 동작)
      }
      return next
    })
  }

  useEffect(() => {
    setPmTheme(theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleExportItsme = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await downloadItsme(pid)
    } catch {
      setError('파일을 내보내지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className={`pm-root${onClose ? '' : ' pm-root--standalone'}`}
      role={onClose ? 'dialog' : undefined}
      aria-modal={onClose ? 'true' : undefined}
      aria-label="패널 모바일 체험"
    >
      <header className={`pm-topbar${stage === 'responding' ? ' pm-topbar--progress' : ''}`}>
        {stage === 'responding' ? (
          <>
            <button
              type="button"
              className="pm-iconbtn"
              onClick={() => setConfirmExit(true)}
              aria-label="응답 닫기"
            >
              <X size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <div className="pm-topbar__center">
              {responding ? (
                <ProgressDots
                  total={responding.survey.questions.length}
                  current={responding.questionIndex}
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="pm-topbar__brand">
            {onClose ? (
              <button
                type="button"
                className="pm-iconbtn pm-iconbtn--tight"
                onClick={onClose}
                aria-label="체험 종료"
              >
                <X size={20} strokeWidth={2.2} aria-hidden="true" />
              </button>
            ) : null}
            <span className="pm-topbar__logo" aria-hidden="true">
              <svg viewBox="0 0 28 28" width="26" height="26">
                <defs>
                  <linearGradient id="pm-logo-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#9C8CFF" />
                    <stop offset="1" stopColor="#6D5BE0" />
                  </linearGradient>
                </defs>
                <rect x="1" y="1" width="26" height="26" rx="9" fill="url(#pm-logo-grad)" />
                <circle cx="11" cy="13" r="2.4" fill="#fff" />
                <circle cx="18" cy="13" r="2.4" fill="#fff" />
                <path
                  d="M10.5 18.5q3.5 3 7 0"
                  stroke="#fff"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="pm-topbar__wordmark">itsme</span>
          </div>
        )}
        <div className="pm-topbar__actions">
          <button
            type="button"
            className="pm-balance pm-balance--btn"
            onClick={() => setTab('shop')}
            aria-label={`현재 포인트 ${me?.wallet.balance ?? 0}, 상점 열기`}
          >
            <Gem className="pm-balance__icon" size={15} strokeWidth={2.2} aria-hidden="true" />
            <span className="pm-balance__value" aria-live="polite" aria-atomic="true">
              {me?.wallet.balance ?? 0}
            </span>
          </button>
          {stage !== 'responding' ? (
            <button
              type="button"
              className="pm-iconbtn pm-iconbtn--sm"
              onClick={() => setSettingsOpen(true)}
              aria-label="설정"
            >
              <Settings size={20} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="pm-toast" role="alert">
          {error}
          <button
            type="button"
            className="pm-toast__close"
            onClick={() => setError(null)}
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      ) : null}

      {warning ? (
        <div className="pm-toast pm-toast--warn" role="status">
          {warning}
          <button
            type="button"
            className="pm-toast__close"
            onClick={() => setWarning(null)}
            aria-label="경고 닫기"
          >
            ×
          </button>
        </div>
      ) : null}

      {stage === 'deck' && tab === 'deck' ? (
        <DeckStage
          loading={loading}
          cards={feed.slice(topCardIndex)}
          onAccept={handleAccept}
          onRefresh={loadAll}
        />
      ) : null}

      {stage === 'deck' && tab === 'tasks' ? (
        <TasksStage
          pid={pid}
          available={Math.max(0, feed.length - topCardIndex)}
          onGoDeck={() => setTab('deck')}
        />
      ) : null}

      {stage === 'deck' && tab === 'pet' ? (
        <PetStage pid={pid} pet={me?.pet ?? null} onChanged={loadAll} />
      ) : null}

      {stage === 'deck' && tab === 'chat' ? <ChatStage pid={pid} account={account} /> : null}

      {stage === 'deck' && tab === 'shop' ? (
        <ShopStage pid={pid} balance={me?.wallet.balance ?? null} onRedeemed={loadAll} />
      ) : null}

      {stage === 'responding' && responding ? (
        <ResponseStage
          survey={responding.survey}
          questionIndex={responding.questionIndex}
          submitting={submitting}
          onAnswer={submitAnswer}
        />
      ) : null}

      {stage === 'complete' && reward ? (
        <CompleteStage reward={reward} me={me} onContinue={continueAfterReward} />
      ) : null}

      {stage === 'deck' ? (
        <nav className="pm-bottomnav" aria-label="메뉴">
          <button
            type="button"
            className={`pm-bottomnav__item${tab === 'deck' ? ' is-active' : ''}`}
            onClick={() => setTab('deck')}
            aria-current={tab === 'deck' ? 'page' : undefined}
          >
            <Layers size={20} strokeWidth={2.2} aria-hidden="true" />
            <span>설문</span>
          </button>
          <button
            type="button"
            className={`pm-bottomnav__item${tab === 'tasks' ? ' is-active' : ''}`}
            onClick={() => setTab('tasks')}
            aria-current={tab === 'tasks' ? 'page' : undefined}
          >
            <ClipboardList size={20} strokeWidth={2.2} aria-hidden="true" />
            <span>참여</span>
          </button>
          <button
            type="button"
            className={`pm-bottomnav__item${tab === 'pet' ? ' is-active' : ''}`}
            onClick={() => setTab('pet')}
            aria-current={tab === 'pet' ? 'page' : undefined}
          >
            <Sprout size={20} strokeWidth={2.2} aria-hidden="true" />
            <span>정령</span>
          </button>
          <button
            type="button"
            className={`pm-bottomnav__item${tab === 'chat' ? ' is-active' : ''}`}
            onClick={() => setTab('chat')}
            aria-current={tab === 'chat' ? 'page' : undefined}
          >
            <MessageCircle size={20} strokeWidth={2.2} aria-hidden="true" />
            <span>AI</span>
          </button>
        </nav>
      ) : null}

      {confirmExit ? (
        <div className="pm-sheet" role="dialog" aria-modal="true" aria-label="응답 중단 확인">
          <div className="pm-sheet__scrim" onClick={() => setConfirmExit(false)} aria-hidden />
          <div className="pm-sheet__panel" ref={exitSheetRef} tabIndex={-1}>
            <h3 className="pm-sheet__title">응답을 중단할까요?</h3>
            <p className="pm-sheet__body">
              지금 나가면 작성 중이던 답변은 저장되지 않아요. 마저 응답하면 포인트를 받을 수 있어요.
            </p>
            <div className="pm-sheet__actions">
              <button
                type="button"
                className="pm-btn pm-btn--ghost pm-btn--xl"
                onClick={exitResponse}
              >
                나가기
              </button>
              <button
                type="button"
                className="pm-btn pm-btn--primary pm-btn--xl"
                onClick={() => setConfirmExit(false)}
              >
                계속 응답하기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {blockedUntil !== null && cooldownLeft > 0 ? (
        <div className="pm-sheet" role="dialog" aria-modal="true" aria-label="응답 차단 안내">
          <div className="pm-sheet__scrim" aria-hidden />
          <div className="pm-sheet__panel" ref={blockSheetRef} tabIndex={-1}>
            <h3 className="pm-sheet__title">잠깐 쉬어 갈까요?</h3>
            <p className="pm-sheet__body">
              빠른 연속 응답이 감지돼 잠시 응답이 제한됐어요. 정령도 함께 쉬고 있어요. 잠시 후 다시
              정확하게 참여하면 포인트를 받을 수 있어요.
            </p>
            <p className="pm-sheet__countdown" aria-live="polite">
              {Math.floor(cooldownLeft / 60)}분 {String(cooldownLeft % 60).padStart(2, '0')}초 후
              다시 참여할 수 있어요
            </p>
            <div className="pm-sheet__actions">
              <button
                type="button"
                className="pm-btn pm-btn--primary pm-btn--xl"
                onClick={() => setBlockedUntil(null)}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="pm-sheet" role="dialog" aria-modal="true" aria-label="설정">
          <div className="pm-sheet__scrim" onClick={() => setSettingsOpen(false)} aria-hidden />
          <div className="pm-sheet__panel" ref={settingsSheetRef} tabIndex={-1}>
            <h3 className="pm-sheet__title">설정</h3>

            {account ? (
              <div className="pm-settings__account">
                <span className="pm-settings__avatar" aria-hidden>
                  {(account.displayName ?? '나').trim().charAt(0) || '나'}
                </span>
                <div className="pm-settings__id">
                  <span className="pm-settings__name">
                    {account.displayName ?? '데이터 정령 친구'}
                  </span>
                  <span className="pm-settings__provider">
                    {PROVIDER_LABEL[account.provider]}로 로그인 중
                  </span>
                </div>
              </div>
            ) : null}

            <ul className="pm-settings__list">
              <li className="pm-settings__row">
                <div className="pm-settings__rowtext">
                  <span className="pm-settings__label">다크 모드</span>
                  <span className="pm-settings__desc">어두운 배경으로 눈부심을 줄여요.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === 'dark'}
                  aria-label="다크 모드"
                  className={`pm-switch${theme === 'dark' ? ' is-on' : ''}`}
                  onClick={toggleTheme}
                >
                  <span className="pm-switch__dot" aria-hidden />
                </button>
              </li>
              <li className="pm-settings__row">
                <div className="pm-settings__rowtext">
                  <span className="pm-settings__label">효과·애니메이션 줄이기</span>
                  <span className="pm-settings__desc">보상 시 콘페티 등 화려한 효과를 꺼요.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reduceFx}
                  aria-label="효과·애니메이션 줄이기"
                  className={`pm-switch${reduceFx ? ' is-on' : ''}`}
                  onClick={toggleReduceFx}
                >
                  <span className="pm-switch__dot" aria-hidden />
                </button>
              </li>
              <li className="pm-settings__row">
                <div className="pm-settings__rowtext">
                  <span className="pm-settings__label">내 데이터 내보내기</span>
                  <span className="pm-settings__desc">
                    프로필·활동 요약을 itsme.md 파일로 저장해요.
                  </span>
                </div>
                <button
                  type="button"
                  className="pm-settings__action"
                  onClick={handleExportItsme}
                  disabled={exporting}
                >
                  <Download size={16} strokeWidth={2.2} aria-hidden="true" />
                  {exporting ? '준비 중…' : 'itsme.md'}
                </button>
              </li>
            </ul>

            {onLogout ? (
              <button
                type="button"
                className="pm-settings__logout"
                onClick={() => {
                  setSettingsOpen(false)
                  onLogout()
                }}
              >
                <LogOut size={18} strokeWidth={2.2} aria-hidden="true" />
                로그아웃
              </button>
            ) : null}

            <p className="pm-settings__version">itsme · v0.1.0</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="pm-dots" aria-label={`${current + 1} / ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`pm-dot${i < current ? ' is-done' : ''}${i === current ? ' is-active' : ''}`}
        />
      ))}
    </div>
  )
}

/** 리스트형 스켈레톤 행 — 아바타 + 2줄 텍스트 (참여/정령 탭 로딩) */
function SkeletonRows({ count = 3, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <div className="pm-skel" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="pm-skel__row">
          {avatar ? <span className="pm-skel__box pm-skel__box--avatar" /> : null}
          <span className="pm-skel__col">
            <span className="pm-skel__box pm-skel__box--line pm-skel__box--w60" />
            <span className="pm-skel__box pm-skel__box--line is-sm pm-skel__box--w40" />
          </span>
          <span className="pm-skel__box pm-skel__box--pill" />
        </div>
      ))}
    </div>
  )
}

function DeckStage({
  loading,
  cards,
  onAccept,
  onRefresh,
}: {
  loading: boolean
  cards: FeedCard[]
  onAccept: (card: FeedCard) => void
  onRefresh: () => void
}) {
  if (loading) {
    return (
      <main className="pm-stage pm-feed" aria-busy="true" aria-label="설문을 불러오는 중">
        <div className="pm-feed__head">
          <span
            className="pm-skel__box pm-skel__box--line pm-skel__box--w80"
            style={{ height: 24 }}
          />
          <span
            className="pm-skel__box pm-skel__box--line is-sm pm-skel__box--w40"
            style={{ marginTop: 12 }}
          />
        </div>
        <span className="pm-skel__box pm-skel__hero" aria-hidden="true" />
        <div style={{ marginTop: 16 }}>
          <SkeletonRows count={3} avatar={false} />
        </div>
      </main>
    )
  }

  if (cards.length === 0) {
    return (
      <main className="pm-stage pm-stage--center">
        <div className="pm-empty">
          <div className="pm-empty__glyph" aria-hidden />
          <h2 className="pm-empty__title">오늘의 설문을 모두 마쳤어요</h2>
          <p className="pm-empty__body">잠시 후 새로운 설문이 도착해요.</p>
          <button type="button" className="pm-btn pm-btn--primary" onClick={onRefresh}>
            새로고침
          </button>
        </div>
      </main>
    )
  }

  const [hero, ...rest] = cards
  const heroMin = Math.max(1, Math.round(hero.estimatedTimeSec / 60))

  return (
    <main className="pm-stage pm-feed">
      <header className="pm-feed__head">
        <h1 className="pm-feed__title">
          오늘 <em>{cards.length}개</em>의 설문이
          <br />
          기다리고 있어요
        </h1>
        <p className="pm-feed__sub">답하면 바로 포인트가 쌓여요</p>
      </header>

      <button type="button" className="pm-hero" onClick={() => onAccept(hero)}>
        <span className="pm-hero__badge">추천</span>
        <span className="pm-hero__meta">
          {hero.category} · 약 {heroMin}분 · {hero.questionCount}문항
        </span>
        <span className="pm-hero__title">{hero.title}</span>
        <span className="pm-hero__cta">
          <span className="pm-hero__reward">
            <Gem size={16} strokeWidth={2.2} aria-hidden="true" />
            {hero.pointsPerUser.toLocaleString()}P
          </span>
          <span className="pm-hero__go">
            참여하기
            <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
          </span>
        </span>
      </button>

      {rest.length > 0 ? (
        <section className="pm-feed-list" aria-label="설문 목록">
          {rest.map((card) => {
            const min = Math.max(1, Math.round(card.estimatedTimeSec / 60))
            return (
              <button
                key={card.id}
                type="button"
                className="pm-feed-row"
                onClick={() => onAccept(card)}
              >
                <span className="pm-feed-row__body">
                  <span className="pm-feed-row__cat">{card.category}</span>
                  <span className="pm-feed-row__title">{card.title}</span>
                  <span className="pm-feed-row__meta">
                    {min}분 · {card.questionCount}문항
                  </span>
                </span>
                <span className="pm-feed-row__reward">
                  <Gem size={14} strokeWidth={2.2} aria-hidden="true" />
                  {card.pointsPerUser.toLocaleString()}P
                </span>
                <ChevronRight
                  className="pm-feed-row__chev"
                  size={18}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </section>
      ) : null}
    </main>
  )
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  issued: '발급 완료',
  pending: '처리 중',
  failed: '실패',
  refunded: '환불',
}

const VENDOR_LABEL: Record<RewardItem['vendor'], string> = {
  naverpay: '네이버페이',
  starbucks: '스타벅스',
  cu: 'CU',
}

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

const APP_STATUS_HINT: Record<ApplicationStatus, string> = {
  applied: '신청이 접수됐어요. 검토 결과를 기다려 주세요.',
  screening: '스크리닝을 진행하고 있어요. 추가 질문이 올 수 있어요.',
  review: '연구팀이 신청서를 검토하고 있어요.',
  selected: '선정됐어요! 일정 조율 안내를 기다려 주세요.',
  rejected: '이번에는 선정되지 않았어요. 다음 리서치에 다시 신청할 수 있어요.',
  scheduled: '일정이 확정됐어요. 세션 준비를 해주세요.',
  in_session: '세션이 진행 중이에요.',
  completed: '참여가 끝났어요. 보상 지급을 준비하고 있어요.',
  paid: '보상이 지급됐어요. 감사합니다!',
}

const generateIdempotencyKey = (): string => {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return `idem-${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const PET_LEVEL_THRESHOLDS = [0, 50, 120, 220, 360, 540, 760, 1020, 1320, 1660, 2040]

const petProgress = (
  exp: number,
  level: number,
): { ratio: number; toNext: number; max: boolean } => {
  const idx = Math.min(Math.max(0, level - 1), PET_LEVEL_THRESHOLDS.length - 1)
  const base = PET_LEVEL_THRESHOLDS[idx] ?? 0
  const next = PET_LEVEL_THRESHOLDS[idx + 1]
  if (next == null) return { ratio: 1, toNext: 0, max: true }
  const span = next - base
  const ratio = span > 0 ? Math.max(0, Math.min(1, (exp - base) / span)) : 1
  return { ratio, toNext: Math.max(0, next - exp), max: false }
}

function TasksStage({
  pid,
  available,
  onGoDeck,
}: {
  pid: string
  available: number
  onGoDeck: () => void
}) {
  const [studies, setStudies] = useState<ManagedStudy[]>([])
  const [applications, setApplications] = useState<ApplicationWithStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  useAutoDismissToast(toast, () => setToast(null))

  const load = useCallback(async () => {
    try {
      const [studyList, mine] = await Promise.all([
        api.research.studies(),
        api.research.myApplications(pid),
      ])
      setStudies(studyList)
      setApplications(mine)
    } catch {
      setToast('리서치 정보를 불러오지 못했어요.')
    } finally {
      setLoading(false)
    }
  }, [pid])

  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void load()
  }, [load])

  const appliedStudyIds = useMemo(() => new Set(applications.map((a) => a.studyId)), [applications])
  const openStudies = useMemo(
    () => studies.filter((s) => !appliedStudyIds.has(s.id)),
    [studies, appliedStudyIds],
  )

  const apply = useCallback(
    async (study: ManagedStudy) => {
      if (busy) return
      setBusy(study.id)
      try {
        await api.research.apply({ pid, studyId: study.id })
        setToast(`신청 완료 · ${study.title}`)
        await load()
      } catch (err) {
        setToast(err instanceof Error ? err.message : '신청에 실패했어요')
      } finally {
        setBusy(null)
      }
    },
    [busy, pid, load],
  )

  return (
    <main className="pm-stage pm-tasks">
      <h2 className="pm-section-title">오늘의 빠른 설문</h2>
      <article className="pm-task-card">
        <div className="pm-task-card__icon" aria-hidden>
          <Layers size={22} strokeWidth={2.2} />
        </div>
        <div className="pm-task-card__body">
          <h3 className="pm-task-card__title">대기 중인 설문 {available}개</h3>
          <p className="pm-task-card__desc">바로 참여하고 포인트를 모아요.</p>
        </div>
        <button
          type="button"
          className="pm-btn pm-btn--ghost pm-btn--sm"
          onClick={onGoDeck}
          disabled={available === 0}
        >
          {available === 0 ? '완료' : '바로가기'}
        </button>
      </article>

      {applications.length > 0 ? (
        <>
          <h2 className="pm-section-title">내 신청 현황</h2>
          <ul className="pm-app-list">
            {applications.map((app) => (
              <li key={app.id} className="pm-app-card">
                <div className="pm-app-card__head">
                  <span className="pm-app-card__title">{app.study?.title ?? '리서치'}</span>
                  <span className={`pm-app-status pm-app-status--${APP_STATUS_TONE[app.status]}`}>
                    {APP_STATUS_LABEL[app.status]}
                  </span>
                </div>
                <p className="pm-app-card__meta">
                  {app.study ? `${STUDY_TYPE_LABEL[app.study.type]} · ` : ''}
                  보상 {(app.study?.incentivePoints ?? 0).toLocaleString()} P
                  {app.scheduledAt
                    ? ` · 일정 ${new Date(app.scheduledAt).toLocaleDateString('ko-KR')}`
                    : ''}
                </p>
                <p className="pm-app-card__hint">{APP_STATUS_HINT[app.status]}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2 className="pm-section-title">신청 가능한 리서치</h2>
      {loading ? (
        <SkeletonRows count={3} avatar={false} />
      ) : openStudies.length === 0 ? (
        <div className="pm-emptybox">
          <ClipboardList size={28} strokeWidth={1.8} aria-hidden="true" />
          <p>지금 신청할 수 있는 리서치가 없어요. 새로운 리서치가 곧 열려요.</p>
        </div>
      ) : (
        <ul className="pm-app-list">
          {openStudies.map((study) => (
            <li key={study.id} className="pm-study-card">
              <span className="pm-study-card__type">{STUDY_TYPE_LABEL[study.type]}</span>
              <h3 className="pm-study-card__title">{study.title}</h3>
              <p className="pm-study-card__summary">{study.summary}</p>
              <div className="pm-study-card__footer">
                <span className="pm-study-card__reward">
                  {study.incentivePoints.toLocaleString()} P · 약 {study.estimatedMinutes}분
                </span>
                <button
                  type="button"
                  className="pm-btn pm-btn--primary pm-btn--sm"
                  disabled={busy === study.id}
                  onClick={() => void apply(study)}
                >
                  {busy === study.id ? '신청 중…' : '신청'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {toast ? (
        <div className="pm-toast pm-toast--shop" role="status" aria-live="polite">
          {toast}
          <button
            type="button"
            className="pm-toast__close"
            onClick={() => setToast(null)}
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      ) : null}
    </main>
  )
}

function PetStage({
  pid,
  pet,
  onChanged,
}: {
  pid: string
  pet: PanelistSummary['pet'] | null
  onChanged: () => void
}) {
  const [pending, setPending] = useState<DataPiece[]>([])
  const [consumedCount, setConsumedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  useAutoDismissToast(toast, () => setToast(null))

  const load = useCallback(async () => {
    try {
      const data = await api.dataPieces(pid)
      setPending(data.pending)
      setConsumedCount(data.consumed.length)
    } catch {
      setToast('데이터 조각을 불러오지 못했어요.')
    } finally {
      setLoading(false)
    }
  }, [pid])

  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void load()
  }, [load])

  const feedOne = useCallback(
    async (piece: DataPiece) => {
      if (busy) return
      setBusy(piece.id)
      try {
        const result = await api.feedPiece({ pid, pieceId: piece.id })
        if (result.evolved) setToast('정령이 진화했어요! ✨')
        else if (result.leveledUp) setToast(`레벨 업! Lv.${result.pet.level}`)
        else setToast(`+${piece.bonusExp} EXP`)
        await load()
        onChanged()
      } catch (err) {
        setToast(err instanceof Error ? err.message : '급식에 실패했어요')
      } finally {
        setBusy(null)
      }
    },
    [busy, pid, load, onChanged],
  )

  const progress = pet ? petProgress(pet.exp, pet.level) : null
  const streak = pet?.streak ?? 0

  // §정령 터치 대사 — 상태(아픔/스트릭/레벨)에 따른 한 줄 반응
  const [dialogue, setDialogue] = useState<string | null>(null)
  const touchPet = useCallback(() => {
    const lines = pet?.sick
      ? ['배가 고파요…', '데이터 조각을 먹여주세요.', '조금만 기운 내볼게요.']
      : streak >= 3
        ? [
            `${streak}일 연속이라니, 최고예요!`,
            '오늘도 함께해줘서 고마워요!',
            '우리 계속 함께해요!',
          ]
        : ['안녕! 오늘도 반가워요.', '설문 한 개만 더 어때요?', '같이 성장해요!']
    setDialogue(lines[Math.floor(Math.random() * lines.length)])
  }, [pet?.sick, streak])

  return (
    <main className="pm-stage pm-pet">
      <section
        className={`pm-pet__hero${pet?.sick ? ' is-sick' : ''}${streak >= 3 ? ' is-streaking' : ''}`}
      >
        <div className="pm-pet__scene">
          <button
            type="button"
            className="pm-pet__avatar"
            onClick={touchPet}
            aria-label="정령 쓰다듬기"
          >
            <PetCreature
              stage={creatureStageFromLevel(pet?.level ?? 1)}
              mood={pet?.sick ? 'sick' : 'happy'}
              size={132}
            />
          </button>
        </div>
        <div className="pm-pet__meta" aria-live="polite" aria-atomic="true">
          <span className="pm-pet__stage">{pet?.evolutionStage ?? '알 단계'}</span>
          <h2 className="pm-pet__level">Lv.{pet?.level ?? 1}</h2>
          {pet?.sick ? (
            <span className="pm-pet__sick">
              <Heart size={13} strokeWidth={2.4} aria-hidden="true" /> 정령이 시들했어요 · 데이터를
              먹여주세요
            </span>
          ) : (
            <span className="pm-pet__exp">EXP {pet?.exp ?? 0}</span>
          )}
        </div>
        {progress ? (
          <div className="pm-pet__progress">
            <div className="pm-pet__bar" aria-label="다음 레벨까지 진행도">
              <div className="pm-pet__bar-fill" style={{ width: `${progress.ratio * 100}%` }} />
            </div>
            <span className="pm-pet__bar-text">
              {progress.max ? '최대 레벨' : `다음 레벨까지 ${progress.toNext} EXP`}
            </span>
          </div>
        ) : null}
      </section>

      {dialogue ? (
        <p className="pm-pet__bubble" role="status" aria-live="polite">
          {dialogue}
        </p>
      ) : null}

      <div className="pm-pet__statline">
        <span className={streak >= 1 ? 'pm-pet__streak' : undefined}>
          {streak >= 1 ? `🔥 ${streak}일 연속 참여` : '연속 참여 시작 전'}
        </span>
        <span>먹인 데이터 {consumedCount}개</span>
        <span>대기 {pending.length}개</span>
      </div>

      <h2 className="pm-section-title">데이터 조각 먹이기</h2>
      {loading ? (
        <SkeletonRows count={3} />
      ) : pending.length === 0 ? (
        <div className="pm-emptybox">
          <Sparkles size={28} strokeWidth={1.8} aria-hidden="true" />
          <p>설문에 응답하면 데이터 조각이 쌓여요. 모아서 정령에게 먹여주세요.</p>
        </div>
      ) : (
        <ul className="pm-pet__pieces">
          {pending.map((piece) => (
            <li key={piece.id} className="pm-pet__piece">
              <div className="pm-pet__piece-info">
                <span className="pm-pet__piece-tag">{piece.categoryTag}</span>
                <span className="pm-pet__piece-exp">+{piece.bonusExp} EXP</span>
              </div>
              <button
                type="button"
                className="pm-btn pm-btn--ghost pm-btn--sm"
                disabled={busy === piece.id}
                onClick={() => void feedOne(piece)}
              >
                {busy === piece.id ? '급식 중…' : '먹이기'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {toast ? (
        <div className="pm-toast pm-toast--shop" role="status" aria-live="polite">
          {toast}
          <button
            type="button"
            className="pm-toast__close"
            onClick={() => setToast(null)}
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      ) : null}
    </main>
  )
}

const CHAT_SUGGESTIONS = [
  '내 관심사를 분석해줘',
  '나한테 맞는 설문 추천해줘',
  '내 응답 데이터는 어떻게 쓰여?',
  '포인트를 더 잘 모으려면?',
]

function ChatStage({ pid, account }: { pid: string; account?: Account }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const name = account?.displayName?.trim() || '회원'

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streamingText, isStreaming])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return
      setError(null)
      setInput('')
      const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
      setMessages(nextMessages)
      setIsStreaming(true)
      setStreamingText('')

      const controller = new AbortController()
      abortRef.current = controller
      let acc = ''
      try {
        await streamChat({
          pid,
          messages: nextMessages,
          signal: controller.signal,
          onDelta: (delta) => {
            acc += delta
            setStreamingText(acc)
          },
        })
        setMessages((prev) => [...prev, { role: 'assistant', content: acc }])
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : '응답을 받지 못했어요')
          if (acc) setMessages((prev) => [...prev, { role: 'assistant', content: acc }])
        }
      } finally {
        setStreamingText('')
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [isStreaming, messages, pid],
  )

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <main className="pm-stage pm-chat" aria-label="나를 이해하는 AI">
      <div className="pm-chat__scroll" ref={scrollRef}>
        {isEmpty ? (
          <div className="pm-chat__welcome">
            <span className="pm-chat__welcomeicon" aria-hidden="true">
              <Sparkles size={22} strokeWidth={2} />
            </span>
            <h2 className="pm-chat__greeting">
              안녕하세요, <span className="pm-chat__greetingname">{name}</span>님
            </h2>
            <p className="pm-chat__greetingsub">
              설문 응답과 관심사를 바탕으로 무엇이든 편하게 물어보세요.
            </p>
          </div>
        ) : (
          <ul className="pm-chat__list">
            {messages.map((m, i) => (
              <li
                key={i}
                className={`pm-chat__msg pm-chat__msg--${m.role === 'user' ? 'user' : 'ai'}`}
              >
                {m.role === 'assistant' ? (
                  <span className="pm-chat__role" aria-hidden="true">
                    <span className="pm-chat__avatar">
                      <Sparkles size={12} strokeWidth={2.4} />
                    </span>
                    AI
                  </span>
                ) : null}
                <div className="pm-chat__bubble">{m.content}</div>
              </li>
            ))}
            {isStreaming ? (
              <li className="pm-chat__msg pm-chat__msg--ai">
                <span className="pm-chat__role" aria-hidden="true">
                  <span className="pm-chat__avatar">
                    <Sparkles size={12} strokeWidth={2.4} />
                  </span>
                  AI
                </span>
                <div className="pm-chat__bubble">
                  {streamingText || (
                    <span className="pm-chat__typing" aria-label="작성 중">
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                  {streamingText ? <span className="pm-chat__cursor" aria-hidden="true" /> : null}
                </div>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <div className="pm-chat__dock">
        {error ? (
          <p className="pm-chat__error" role="alert">
            {error}
          </p>
        ) : null}

        {isEmpty ? (
          <div className="pm-chat__suggestions" aria-label="추천 질문">
            {CHAT_SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="pm-chat__chip" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="pm-chat__composer"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <textarea
            className="pm-chat__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 132)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            placeholder="무엇이든 물어보세요"
            rows={1}
            aria-label="메시지 입력"
          />
          <button
            type="submit"
            className="pm-chat__send"
            disabled={isStreaming || !input.trim()}
            aria-label="보내기"
          >
            <ArrowUp size={18} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </form>
      </div>
    </main>
  )
}

function ShopStage({
  pid,
  balance,
  onRedeemed,
}: {
  pid: string
  balance: number | null
  onRedeemed: () => void
}) {
  const [catalog, setCatalog] = useState<RewardItem[]>([])
  const [orders, setOrders] = useState<RewardOrder[]>([])
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  useAutoDismissToast(toast, () => setToast(null))

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [items, recent] = await Promise.all([api.wallet.catalog(), api.wallet.orders(pid)])
        if (cancelled) return
        setCatalog(items)
        setOrders(recent)
      } catch {
        if (!cancelled) setToast('리워드 목록을 불러오지 못했어요.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [pid])

  const sortedCatalog = useMemo(() => [...catalog].sort((a, b) => a.cost - b.cost), [catalog])

  const redeem = useCallback(
    async (item: RewardItem) => {
      if (busyItem) return
      if (balance != null && balance < item.cost) {
        setToast('포인트가 부족해요.')
        return
      }
      setBusyItem(item.id)
      try {
        const { order, idempotent } = await api.wallet.redeem({
          pid,
          itemId: item.id,
          idempotencyKey: generateIdempotencyKey(),
        })
        setToast(idempotent ? '이미 처리된 주문이에요.' : `교환 완료 · ${order.itemLabel}`)
        const recent = await api.wallet.orders(pid)
        setOrders(recent)
        onRedeemed()
      } catch (err) {
        setToast(err instanceof Error ? err.message : '교환에 실패했어요')
      } finally {
        setBusyItem(null)
      }
    },
    [balance, busyItem, onRedeemed, pid],
  )

  if (loading) {
    return (
      <main className="pm-stage pm-shop" aria-busy="true" aria-label="상점을 불러오는 중">
        <span
          className="pm-skel__box"
          style={{ height: 64, borderRadius: 16 }}
          aria-hidden="true"
        />
        <span
          className="pm-skel__box pm-skel__box--line pm-skel__box--w40"
          style={{ marginTop: 4 }}
          aria-hidden="true"
        />
        <div className="pm-skel__grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="pm-skel__box pm-skel__card" />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="pm-stage pm-shop">
      <div className="pm-shop__balance">
        <span className="pm-shop__balance-label">사용 가능 포인트</span>
        <span className="pm-shop__balance-value">
          <Gem size={16} strokeWidth={2.2} aria-hidden="true" />
          {balance != null ? balance.toLocaleString() : '—'} P
        </span>
      </div>

      <h2 className="pm-section-title">기프티콘으로 교환</h2>
      {sortedCatalog.length === 0 ? (
        <div className="pm-emptybox">
          <Gift size={28} strokeWidth={1.8} aria-hidden="true" />
          <p>교환 가능한 기프티콘을 준비하고 있어요. 곧 새로운 상품이 열려요.</p>
        </div>
      ) : (
        <div className="pm-shop__grid">
          {sortedCatalog.map((item) => {
            const lack = balance != null && balance < item.cost
            return (
              <article key={item.id} className="pm-shop__card">
                <span className={`pm-shop__vendor pm-shop__vendor--${item.vendor}`}>
                  {VENDOR_LABEL[item.vendor] ?? item.vendor}
                </span>
                <h3 className="pm-shop__label">{item.label}</h3>
                <div className="pm-shop__footer">
                  <span className="pm-shop__cost">{item.cost.toLocaleString()} P</span>
                  <button
                    type="button"
                    className="pm-btn pm-btn--ghost pm-btn--sm"
                    disabled={busyItem === item.id || lack}
                    onClick={() => void redeem(item)}
                  >
                    {busyItem === item.id ? '교환 중…' : lack ? '포인트 부족' : '교환'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {orders.length > 0 ? (
        <div className="pm-shop__orders">
          <h2 className="pm-section-title">최근 교환 내역</h2>
          <ul>
            {orders.slice(0, 5).map((order) => (
              <li key={order.id} className="pm-shop__order">
                <span className={`pm-shop__order-status pm-shop__order-status--${order.status}`}>
                  {ORDER_STATUS_LABEL[order.status] ?? order.status}
                </span>
                <span className="pm-shop__order-label">{order.itemLabel}</span>
                <span className="pm-shop__order-code">{order.voucherCode ?? '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {toast ? (
        <div className="pm-toast pm-toast--shop" role="status" aria-live="polite">
          {toast}
          <button
            type="button"
            className="pm-toast__close"
            onClick={() => setToast(null)}
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      ) : null}
    </main>
  )
}

function ResponseStage({
  survey,
  questionIndex,
  submitting,
  onAnswer,
}: {
  survey: Survey
  questionIndex: number
  submitting: boolean
  onAnswer: (ids: string[]) => void
}) {
  return (
    <main className="pm-stage pm-stage--response" key={questionIndex}>
      <ResponseQuestion
        survey={survey}
        questionIndex={questionIndex}
        submitting={submitting}
        onAnswer={onAnswer}
      />
    </main>
  )
}

// 렌더 중 impure 호출을 피하기 위한 모듈 스코프 시간 헬퍼.
function nowMs(): number {
  return Date.now()
}

function ResponseQuestion({
  survey,
  questionIndex,
  submitting,
  onAnswer,
}: {
  survey: Survey
  questionIndex: number
  submitting: boolean
  onAnswer: (ids: string[]) => void
}) {
  const question = survey.questions[questionIndex]
  const [selected, setSelected] = useState<string[]>([])
  const [text, setText] = useState('')
  // 과속 사전 가드 — 설계: docs/설문4종_직관화_및_과속가드_설계.md
  const mountedAtRef = useRef(0)
  const guardWarnedRef = useRef(false)
  const [guard, setGuard] = useState<string | null>(null)

  useEffect(() => {
    mountedAtRef.current = nowMs()
  }, [questionIndex])

  useEffect(() => {
    if (!guard) return
    const t = window.setTimeout(() => setGuard(null), 1900)
    return () => window.clearTimeout(t)
  }, [guard])

  if (!question) return null

  const isLikert = question.type === 'likert'
  const isSingle = question.type === 'single'
  const isMulti = question.type === 'multi'
  const isText = question.type === 'text'

  // 정상 사용자는 막지 않는 느슨한 최소 숙독시간(차단이 아닌 1회 안내용).
  const clientMinDwellMs = Math.min(1600, Math.max(450, question.text.length * 22))
  const passesGuard = () => {
    const elapsed = nowMs() - mountedAtRef.current
    if (elapsed >= clientMinDwellMs || guardWarnedRef.current) return true
    guardWarnedRef.current = true
    setGuard('문항을 충분히 읽고 답해 주세요 🙂')
    return false
  }

  const handleSingleTap = (choiceId: string) => {
    if (submitting) return
    setSelected([choiceId])
    if (!passesGuard()) return
    window.setTimeout(() => onAnswer([choiceId]), 220)
  }

  const toggleMulti = (choiceId: string) => {
    setSelected((cur) =>
      cur.includes(choiceId) ? cur.filter((id) => id !== choiceId) : [...cur, choiceId],
    )
  }

  const canConfirm = isMulti ? selected.length > 0 : isText ? text.trim().length > 0 : false
  const choices = question.choices ?? []

  return (
    <>
      <div className="pm-q">
        <p className="pm-q__num">
          {questionIndex + 1} / {survey.questions.length}
        </p>
        <h2 className="pm-q__text">{question.text}</h2>
        {isLikert ? (
          <p className="pm-q__hint">가장 가까운 정도를 골라 주세요</p>
        ) : isMulti ? (
          <p className="pm-q__hint">해당하는 항목을 모두 선택할 수 있어요</p>
        ) : isSingle ? (
          <p className="pm-q__hint">하나만 골라 주세요 · 누르면 바로 다음으로</p>
        ) : isText ? (
          <p className="pm-q__hint">자유롭게 적어 주세요</p>
        ) : null}
      </div>

      {guard ? (
        <div className="pm-toast pm-toast--guard" role="status" aria-live="polite">
          {guard}
        </div>
      ) : null}

      {isLikert ? (
        <LikertScale
          choices={choices}
          selectedId={selected[0] ?? null}
          disabled={submitting}
          onPick={handleSingleTap}
        />
      ) : (
        <div className="pm-choices">
          {isText ? (
            <div>
              <textarea
                className="pm-textarea"
                placeholder="자유롭게 적어 주세요"
                aria-label="자유 응답"
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
              />
              <p className="pm-textarea__count" aria-live="polite">
                {text.length} / 500
              </p>
            </div>
          ) : (
            choices.map((c) => {
              const isSelected = selected.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`pm-choice${isSelected ? ' is-selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => (isSingle ? handleSingleTap(c.id) : toggleMulti(c.id))}
                  disabled={submitting}
                >
                  <span className="pm-choice__bullet" aria-hidden>
                    {isSelected ? <Check size={14} strokeWidth={3} /> : null}
                  </span>
                  <span className="pm-choice__label">{c.label}</span>
                </button>
              )
            })
          )}
        </div>
      )}

      {(isMulti || isText) && (
        <div className="pm-bottom-cta">
          <button
            type="button"
            className="pm-btn pm-btn--primary pm-btn--xl"
            onClick={() => {
              if (!passesGuard()) return
              onAnswer(isText ? [] : selected)
            }}
            disabled={!canConfirm || submitting}
          >
            {submitting
              ? '전송 중...'
              : isMulti && selected.length > 0
                ? `다음 · ${selected.length}개 선택`
                : '다음'}
          </button>
        </div>
      )}
    </>
  )
}

const LIKERT_FACES = [Angry, Frown, Meh, Smile, Laugh]

function likertFace(index: number, count: number) {
  if (count === 5) return LIKERT_FACES[index]
  // Map any scale length onto the 5 faces by relative position.
  const ratio = count <= 1 ? 0 : index / (count - 1)
  return LIKERT_FACES[Math.round(ratio * 4)]
}

function LikertScale({
  choices,
  selectedId,
  disabled,
  onPick,
}: {
  choices: { id: string; label: string }[]
  selectedId: string | null
  disabled: boolean
  onPick: (choiceId: string) => void
}) {
  if (choices.length === 0) return null
  const minLabel = choices[0]?.label
  const maxLabel = choices[choices.length - 1]?.label
  const selectedIndex = choices.findIndex((c) => c.id === selectedId)
  return (
    <div className="pm-likert" role="radiogroup" aria-label="동의 정도">
      <div className="pm-likert__scale" data-count={choices.length}>
        {choices.map((c, i) => {
          const isSelected = c.id === selectedId
          const Face = likertFace(i, choices.length)
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={c.label}
              className={`pm-likert__dot pm-likert__dot--${i + 1}${isSelected ? ' is-selected' : ''}`}
              onClick={() => onPick(c.id)}
              disabled={disabled}
            >
              <Face className="pm-likert__face" size={26} strokeWidth={2} aria-hidden="true" />
            </button>
          )
        })}
      </div>
      <div className="pm-likert__anchors">
        <span>{minLabel}</span>
        <span aria-live="polite" className="pm-likert__current">
          {selectedIndex >= 0 ? choices[selectedIndex]?.label : ''}
        </span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}

function CompleteStage({
  reward,
  me,
  onContinue,
}: {
  reward: Reward
  me: PanelistSummary | null
  onContinue: () => void
}) {
  const newBalance = useMemo(() => me?.wallet.balance ?? 0, [me])
  const reduceMotion = useReducedMotion()
  const expProgress = useMemo(
    () => petProgress(reward.pet.exp, reward.pet.level),
    [reward.pet.exp, reward.pet.level],
  )
  const fromRatio = useMemo(
    () =>
      reward.pet.leveledUp
        ? 0
        : petProgress(reward.pet.exp - reward.pet.expGained, reward.pet.prevLevel).ratio,
    [reward.pet.exp, reward.pet.expGained, reward.pet.leveledUp, reward.pet.prevLevel],
  )
  const firedRef = useRef(false)
  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    celebrate({ intensity: 'big' })
  }, [])
  return (
    <main className="pm-stage pm-stage--center pm-stage--celebrate">
      <motion.div
        className="pm-celebrate__inner"
        initial={{ opacity: 0, scale: 0.82, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      >
        <div className="pm-burst" aria-hidden>
          <div className="pm-burst__ring" />
          <div className="pm-burst__ring pm-burst__ring--2" />
          <PetCreature
            className="pm-burst__pet"
            stage={creatureStageFromLevel(reward.pet.level)}
            size={64}
            animated={false}
          />
        </div>
        <p className="pm-celebrate__eyebrow">응답을 완료했어요</p>
        <div className="pm-reward-tracks" aria-live="polite">
          <section className="pm-track pm-track--grow">
            <header className="pm-track__head">
              <span className="pm-track__icon" aria-hidden="true">
                <Sparkles size={18} strokeWidth={2.2} />
              </span>
              <span className="pm-track__titles">
                <span className="pm-track__label">정령 성장</span>
                <span className="pm-track__sub">쌓아서 진화</span>
              </span>
              <span className="pm-track__delta">+{reward.pet.expGained} EXP</span>
            </header>
            <div className="pm-track__bar" aria-hidden="true">
              <motion.div
                className="pm-track__bar-fill"
                initial={{ width: `${fromRatio * 100}%` }}
                animate={{ width: `${expProgress.ratio * 100}%` }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 120, damping: 20, delay: 0.3 }
                }
              />
            </div>
            <footer className="pm-track__foot">
              {reward.pet.leveledUp ? (
                <span className="pm-track__levelup">
                  레벨 업! Lv.{reward.pet.prevLevel} → Lv.{reward.pet.level}
                </span>
              ) : (
                <span>Lv.{reward.pet.level}</span>
              )}
              <span>
                {expProgress.max ? '최대 레벨' : `다음 레벨까지 ${expProgress.toNext} EXP`}
              </span>
            </footer>
          </section>
          <section className="pm-track pm-track--spend">
            <header className="pm-track__head">
              <span className="pm-track__icon" aria-hidden="true">
                <Gem size={18} strokeWidth={2.2} />
              </span>
              <span className="pm-track__titles">
                <span className="pm-track__label">포인트 적립</span>
                <span className="pm-track__sub">교환·현금화</span>
              </span>
              <span className="pm-track__delta">+{reward.pointsAwarded.toLocaleString()} P</span>
            </header>
            <footer className="pm-track__foot pm-track__foot--single">
              <span>교환 가능 · 누적 {newBalance.toLocaleString()} P</span>
            </footer>
          </section>
        </div>
        {reward.pet.streak >= 2 && (
          <p className="pm-streak-chip">
            <Flame size={16} strokeWidth={2.2} aria-hidden="true" />
            <strong>{reward.pet.streak}일</strong> 연속 참여 중
          </p>
        )}
        <div className="pm-celebrate__actions">
          <button type="button" className="pm-btn pm-btn--primary pm-btn--xl" onClick={onContinue}>
            다음 설문 보기
          </button>
        </div>
      </motion.div>
    </main>
  )
}
