import { useEffect, useState } from 'react'

import { api, type DashboardSummary, type Survey, type SurveyAnalytics } from '../lib/api'

type Props = {
  surveys: Survey[]
  onLog?: (message: string) => void
  /** Which sections to render. 'kpi' = KPI strip only, 'insights' = board + analytics, 'full' = all. */
  view?: 'kpi' | 'insights' | 'full'
}

const formatDuration = (ms: number): string => {
  if (ms <= 0) return '-'
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const STATUS_LABEL: Record<Survey['status'], string> = {
  draft: '초안',
  live: '라이브',
  done: '종료',
}

export function DashboardOverview({ surveys, onLog, view = 'full' }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showKpi = view === 'kpi' || view === 'full'
  const showBoard = view === 'insights' || view === 'full'

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const data = await api.analytics.dashboardSummary()
        if (alive) setSummary(data)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 15000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [surveys.length])

  useEffect(() => {
    if (!selectedId) return
    let alive = true
    const tick = async () => {
      if (alive) setAnalyticsLoading(true)
      try {
        const data = await api.analytics.survey(selectedId)
        if (alive) setAnalytics(data)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (alive) setAnalyticsLoading(false)
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 10000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [selectedId])

  const grouped: Record<Survey['status'], Survey[]> = {
    draft: surveys.filter((s) => s.status === 'draft'),
    live: surveys.filter((s) => s.status === 'live'),
    done: surveys.filter((s) => s.status === 'done'),
  }

  return (
    <section className="dashboard" aria-labelledby="dashboard-heading">
      {view === 'full' ? (
        <div className="section-header">
          <div>
            <h2 id="dashboard-heading">운영 현황을 한 눈에</h2>
            <p>설문, 응답, 예산을 하나의 대시보드에서 확인하고 다음 행동으로 연결합니다.</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="banner" role="alert">
          <span>{error}</span>
          <button type="button" className="banner__close" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      ) : null}

      {showKpi ? (
        <div className="kpi-strip">
          <KpiCard
            label="누적 응답"
            value={summary?.responses.started ?? 0}
            sub={`완료 ${summary?.responses.completed ?? 0}건`}
            delta={summary?.responses.completed ? `+${summary.responses.completed}` : null}
            deltaTone="up"
          />
          <KpiCard
            label="전체 설문"
            value={summary?.surveys.total ?? 0}
            sub={`라이브 ${summary?.surveys.live ?? 0}개`}
          />
          <KpiCard
            label="완료율"
            value={`${summary?.responses.completionRate ?? 0}%`}
            sub={`차단 ${summary?.responses.blocked ?? 0}건`}
          />
          <KpiCard
            label="지급 포인트"
            value={(summary?.spendPoints ?? 0).toLocaleString()}
            sub={`예산 ${(summary?.estimatedBudget ?? 0).toLocaleString()}P`}
          />
        </div>
      ) : null}

      {showBoard ? (
        <>
          <div className="kanban">
            {(['draft', 'live', 'done'] as const).map((status) => (
              <div key={status} className={`kanban__col kanban__col--${status}`}>
                <header className="kanban__head">
                  <span className="kanban__title">{STATUS_LABEL[status]}</span>
                  <span className="kanban__count">{grouped[status].length}</span>
                </header>
                <div className="kanban__list">
                  {grouped[status].length === 0 ? (
                    <p className="kanban__empty">아직 없어요</p>
                  ) : (
                    grouped[status].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`kanban__card ${selectedId === s.id ? 'is-active' : ''}`}
                        onClick={() => {
                          setSelectedId(s.id === selectedId ? null : s.id)
                          onLog?.(`설문 선택: ${s.title}`)
                        }}
                      >
                        <span className="kanban__cardTitle">{s.title}</span>
                        <span className="kanban__cardMeta">
                          {s.category} · {s.questions.length}Q
                          {s.deployment ? ` · ${s.deployment.pointsPerUser}P` : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedId ? (
            <div className="analytics-card">
              <div className="analytics-card__head">
                <div>
                  <h3>응답 분석</h3>
                  <p className="analytics-card__sub">
                    {analytics ? analytics.surveyId : selectedId} · 10초마다 자동으로 갱신돼요
                  </p>
                </div>
                <div className="analytics-card__actions">
                  <a
                    className="btn btn--ghost"
                    href={api.analytics.exportCsvUrl(selectedId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    CSV 내보내기
                  </a>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setSelectedId(null)}
                  >
                    닫기
                  </button>
                </div>
              </div>

              {analyticsLoading && !analytics ? (
                <p className="empty">분석 데이터를 불러오는 중이에요…</p>
              ) : analytics ? (
                <>
                  <div className="analytics-totals">
                    <Stat label="시작" value={analytics.totals.started} />
                    <Stat label="완료" value={analytics.totals.completed} />
                    <Stat label="진행중" value={analytics.totals.inProgress} />
                    <Stat label="차단" value={analytics.totals.blocked} />
                    <Stat label="완료율" value={`${analytics.totals.completionRate}%`} />
                    <Stat
                      label="평균 소요"
                      value={formatDuration(analytics.totals.averageDurationMs)}
                    />
                  </div>

                  <ol className="analytics-questions">
                    {analytics.questions.map((q) => (
                      <li key={q.questionId} className="analytics-q">
                        <div className="analytics-q__head">
                          <span className="analytics-q__idx">Q{q.questionIndex + 1}</span>
                          <span className="analytics-q__text">{q.text}</span>
                          <span className="analytics-q__meta">
                            도달 {q.reached} · 응답 {q.answered} · 이탈 {q.dropoffRate}%
                          </span>
                        </div>
                        {q.choices && q.choices.length > 0 ? (
                          <div className="analytics-bars">
                            {q.choices.map((c) => (
                              <div key={c.choiceId} className="analytics-bar">
                                <span className="analytics-bar__label">{c.label}</span>
                                <div className="analytics-bar__track">
                                  <div
                                    className="analytics-bar__fill"
                                    style={{ width: `${c.ratio}%` }}
                                  />
                                </div>
                                <span className="analytics-bar__value">
                                  {c.count} ({c.ratio}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="analytics-q__noChoices">
                            서술형 문항입니다 · 객관식 분포 없음
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="empty">표시할 데이터가 없어요</p>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function KpiCard({
  label,
  value,
  sub,
  delta,
  deltaTone = 'flat',
}: {
  label: string
  value: number | string
  sub: string
  delta?: string | null
  deltaTone?: 'up' | 'down' | 'flat'
}) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <span className="kpi__value num">
        {value}
        {delta ? <span className={`delta delta--${deltaTone}`}>{delta}</span> : null}
      </span>
      <span className="kpi__sub">{sub}</span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  )
}
