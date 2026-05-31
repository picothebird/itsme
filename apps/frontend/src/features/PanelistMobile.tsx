import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Check,
  Gem,
  Clock,
  ListChecks,
  Coins,
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
} from 'lucide-react'

import {
  api,
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

type Stage = 'deck' | 'responding' | 'complete'
type Tab = 'deck' | 'tasks' | 'pet' | 'shop'

type Reward = {
  pointsAwarded: number
  pet: { exp: number; level: number; evolutionStage: string | null }
}

type Props = {
  pid: string
  onClose?: () => void
}

export function PanelistMobile({ pid, onClose }: Props) {
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
  const [confirmExit, setConfirmExit] = useState(false)

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
    void loadAll()
  }, [loadAll])

  const currentCard = feed[topCardIndex]
  const nextCard = feed[topCardIndex + 1]

  const handlePass = useCallback(() => {
    setTopCardIndex((i) => i + 1)
  }, [])

  const handleAccept = useCallback(async () => {
    if (!currentCard) return
    setError(null)
    try {
      const surveys = await api.listSurveys()
      const survey = surveys.find((s) => s.id === currentCard.id)
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
  }, [currentCard, pid])

  const submitAnswer = useCallback(
    async (selectedChoiceIds: string[]) => {
      if (!responding) return
      const { survey, responseId, questionIndex, startedAt } = responding
      const question = survey.questions[questionIndex]
      if (!question) return
      setSubmitting(true)
      try {
        await api.submitAnswer(responseId, {
          questionId: question.id,
          selectedChoiceIds,
          latencyMs: Math.max(300, Date.now() - startedAt),
        })
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
    setStage('deck')
  }, [])

  const continueAfterReward = useCallback(() => {
    setReward(null)
    setStage('deck')
  }, [])

  return (
    <div
      className={`pm-root${onClose ? '' : ' pm-root--standalone'}`}
      role={onClose ? 'dialog' : undefined}
      aria-modal={onClose ? 'true' : undefined}
      aria-label="패널 모바일 체험"
    >
      <header className="pm-topbar">
        {stage === 'responding' || onClose ? (
          <button
            type="button"
            className="pm-iconbtn"
            onClick={stage === 'responding' ? () => setConfirmExit(true) : onClose}
            aria-label={stage === 'responding' ? '응답 닫기' : '체험 종료'}
          >
            <X size={22} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : (
          <div style={{ width: 44 }} />
        )}
        <div className="pm-topbar__center">
          {stage === 'responding' && responding ? (
            <ProgressDots
              total={responding.survey.questions.length}
              current={responding.questionIndex}
            />
          ) : (
            <span className="pm-topbar__title">잇츠미</span>
          )}
        </div>
        <div className="pm-balance" aria-label="현재 포인트">
          <Gem className="pm-balance__icon" size={15} strokeWidth={2.2} aria-hidden="true" />
          <span className="pm-balance__value">{me?.wallet.balance ?? 0}</span>
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

      {stage === 'deck' && tab === 'deck' ? (
        <DeckStage
          loading={loading}
          currentCard={currentCard}
          nextCard={nextCard}
          remaining={Math.max(0, feed.length - topCardIndex)}
          me={me}
          onPass={handlePass}
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
            className={`pm-bottomnav__item${tab === 'shop' ? ' is-active' : ''}`}
            onClick={() => setTab('shop')}
            aria-current={tab === 'shop' ? 'page' : undefined}
          >
            <Gift size={20} strokeWidth={2.2} aria-hidden="true" />
            <span>상점</span>
          </button>
        </nav>
      ) : null}

      {confirmExit ? (
        <div className="pm-sheet" role="dialog" aria-modal="true" aria-label="응답 중단 확인">
          <div className="pm-sheet__scrim" onClick={() => setConfirmExit(false)} aria-hidden />
          <div className="pm-sheet__panel">
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

function DeckStage({
  loading,
  currentCard,
  nextCard,
  remaining,
  me,
  onPass,
  onAccept,
  onRefresh,
}: {
  loading: boolean
  currentCard: FeedCard | undefined
  nextCard: FeedCard | undefined
  remaining: number
  me: PanelistSummary | null
  onPass: () => void
  onAccept: () => void
  onRefresh: () => void
}) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<{ dx: number; dy: number; active: boolean }>({
    dx: 0,
    dy: 0,
    active: false,
  })
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (!currentCard) return
    startRef.current = { x: e.clientX, y: e.clientY }
    setDrag({ dx: 0, dy: 0, active: true })
    cardRef.current?.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current || !drag.active) return
    setDrag({
      dx: e.clientX - startRef.current.x,
      dy: e.clientY - startRef.current.y,
      active: true,
    })
  }
  const onPointerUp = () => {
    if (!drag.active) return
    const threshold = 120
    if (drag.dx > threshold) {
      onAccept()
    } else if (drag.dx < -threshold) {
      onPass()
    }
    setDrag({ dx: 0, dy: 0, active: false })
    startRef.current = null
  }

  const rotate = drag.dx / 18
  const opacityAccept = Math.min(1, Math.max(0, drag.dx / 120))
  const opacityPass = Math.min(1, Math.max(0, -drag.dx / 120))

  if (loading) {
    return (
      <main className="pm-stage pm-stage--center">
        <p className="pm-muted">설문을 불러오는 중...</p>
      </main>
    )
  }

  if (!currentCard) {
    return (
      <main className="pm-stage pm-stage--center">
        <div className="pm-empty">
          <div className="pm-empty__glyph" aria-hidden />
          <h2 className="pm-empty__title">오늘의 설문을 모두 둘러봤어요</h2>
          <p className="pm-empty__body">잠시 후 새로운 설문이 도착해요.</p>
          <button type="button" className="pm-btn pm-btn--primary" onClick={onRefresh}>
            새로고침
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="pm-stage">
      <div className="pm-deck-meta">
        <span className="pm-deck-meta__count">남은 설문 {remaining}</span>
        {me?.pet ? (
          <span className="pm-deck-meta__pet">
            정령 Lv.{me.pet.level} · {me.pet.evolutionStage ?? '알'}
          </span>
        ) : null}
      </div>

      <div className="pm-deck">
        {nextCard ? (
          <article className="pm-card pm-card--back" aria-hidden>
            <CardBody card={nextCard} />
          </article>
        ) : null}
        <article
          ref={cardRef}
          className={`pm-card pm-card--top${drag.active ? ' is-dragging' : ''}`}
          style={{
            transform: `translate(${drag.dx}px, ${drag.dy * 0.4}px) rotate(${rotate}deg)`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="pm-stamp pm-stamp--accept" style={{ opacity: opacityAccept }}>
            참여
          </span>
          <span className="pm-stamp pm-stamp--pass" style={{ opacity: opacityPass }}>
            패스
          </span>
          <CardBody card={currentCard} />
        </article>
      </div>

      <div className="pm-deck-actions">
        <button
          type="button"
          className="pm-roundbtn pm-roundbtn--pass"
          onClick={onPass}
          aria-label="패스"
        >
          <X size={24} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button type="button" className="pm-btn pm-btn--primary pm-btn--xl" onClick={onAccept}>
          참여하고 {currentCard.pointsPerUser} P 받기
        </button>
        <button
          type="button"
          className="pm-roundbtn pm-roundbtn--accept"
          onClick={onAccept}
          aria-label="참여"
        >
          <Check size={24} strokeWidth={2.8} aria-hidden="true" />
        </button>
      </div>

      <p className="pm-hint">좌우로 스와이프해서 빠르게 탐색해요</p>
    </main>
  )
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  issued: '발급 완료',
  pending: '처리 중',
  failed: '실패',
  refunded: '환불',
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
          <p className="pm-task-card__desc">스와이프로 빠르게 참여하고 포인트를 모아요.</p>
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
        <p className="pm-muted">리서치를 불러오는 중...</p>
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

  return (
    <main className="pm-stage pm-pet">
      <section className={`pm-pet__hero${pet?.sick ? ' is-sick' : ''}`}>
        <div className="pm-pet__avatar" aria-hidden>
          <Sprout size={44} strokeWidth={1.8} />
        </div>
        <div className="pm-pet__meta">
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
          <div className="pm-pet__bar" aria-label="다음 레벨까지 진행도">
            <div className="pm-pet__bar-fill" style={{ width: `${progress.ratio * 100}%` }} />
            <span className="pm-pet__bar-text">
              {progress.max ? '최대 레벨' : `다음 레벨까지 ${progress.toNext} EXP`}
            </span>
          </div>
        ) : null}
      </section>

      <div className="pm-pet__statline">
        <span>먹인 데이터 {consumedCount}개</span>
        <span>대기 {pending.length}개</span>
      </div>

      <h2 className="pm-section-title">데이터 조각 먹이기</h2>
      {loading ? (
        <p className="pm-muted">데이터 조각을 불러오는 중...</p>
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
                className="pm-btn pm-btn--primary pm-btn--sm"
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
      <main className="pm-stage pm-stage--center">
        <p className="pm-muted">상점을 불러오는 중...</p>
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

      <h2 className="pm-shop__heading">기프티콘으로 교환</h2>
      <div className="pm-shop__grid">
        {sortedCatalog.map((item) => {
          const lack = balance != null && balance < item.cost
          return (
            <article key={item.id} className="pm-shop__card">
              <span className="pm-shop__vendor">{item.vendor}</span>
              <h3 className="pm-shop__label">{item.label}</h3>
              <div className="pm-shop__footer">
                <span className="pm-shop__cost">{item.cost.toLocaleString()} P</span>
                <button
                  type="button"
                  className="pm-btn pm-btn--primary pm-btn--sm"
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

      {orders.length > 0 ? (
        <div className="pm-shop__orders">
          <h2 className="pm-shop__heading">최근 교환 내역</h2>
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

function CardBody({ card }: { card: FeedCard }) {
  const minutes = Math.max(1, Math.round(card.estimatedTimeSec / 60))
  return (
    <>
      <header className="pm-card__head">
        <span className="pm-card__category">{card.category}</span>
        <span className="pm-card__time">
          <Clock size={13} strokeWidth={2} aria-hidden="true" />
          {minutes}분
        </span>
      </header>
      <h2 className="pm-card__title">{card.title}</h2>
      <div className="pm-card__stats">
        <div className="pm-card__stat">
          <ListChecks className="pm-card__stat-icon" size={18} strokeWidth={2} aria-hidden="true" />
          <span className="pm-card__stat-value">{card.questionCount}</span>
          <span className="pm-card__stat-label">문항</span>
        </div>
        <div className="pm-card__stat">
          <Coins className="pm-card__stat-icon" size={18} strokeWidth={2} aria-hidden="true" />
          <span className="pm-card__stat-value">{card.pointsPerUser}</span>
          <span className="pm-card__stat-label">포인트</span>
        </div>
        <div className="pm-card__stat">
          <Clock className="pm-card__stat-icon" size={18} strokeWidth={2} aria-hidden="true" />
          <span className="pm-card__stat-value">{minutes}</span>
          <span className="pm-card__stat-label">분</span>
        </div>
      </div>
    </>
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

  if (!question) return null

  const isLikert = question.type === 'likert'
  const isSingle = question.type === 'single'
  const isMulti = question.type === 'multi'
  const isText = question.type === 'text'

  const handleSingleTap = (choiceId: string) => {
    if (submitting) return
    setSelected([choiceId])
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
        ) : null}
      </div>

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
            <textarea
              className="pm-textarea"
              placeholder="자유롭게 적어 주세요"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
            />
          ) : (
            choices.map((c) => {
              const isSelected = selected.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`pm-choice${isSelected ? ' is-selected' : ''}`}
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
            onClick={() => onAnswer(isText ? [] : selected)}
            disabled={!canConfirm || submitting}
          >
            {submitting ? '전송 중...' : '다음'}
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
          <Sparkles className="pm-burst__spark" size={30} aria-hidden="true" />
        </div>
        <p className="pm-celebrate__eyebrow">응답 완료</p>
        <p className="pm-celebrate__points">
          +{reward.pointsAwarded}
          <span className="pm-celebrate__unit">P</span>
        </p>
        <p className="pm-celebrate__body">
          정령 Lv.{reward.pet.level} · {reward.pet.evolutionStage ?? '알'} · 누적 {newBalance} P
        </p>
        <div className="pm-celebrate__actions">
          <button type="button" className="pm-btn pm-btn--primary pm-btn--xl" onClick={onContinue}>
            다음 설문 보기
          </button>
        </div>
      </motion.div>
    </main>
  )
}
