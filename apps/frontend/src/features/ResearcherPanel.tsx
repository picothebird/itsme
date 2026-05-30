import { useCallback, useEffect, useState } from 'react'

import { api, type FeedCard, type PanelistSummary, type Survey } from '../lib/api'

const DEMO_PID = 'pid_demo_researcher'

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

export function ResearcherPanel() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [feed, setFeed] = useState<FeedCard[]>([])
  const [panelist, setPanelist] = useState<PanelistSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  const refresh = useCallback(async () => {
    try {
      setError(null)
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
        setError(null)
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
    setLog((prev) => ['Creating demo survey...', ...prev])
    try {
      const created = await api.createSurvey(seedSurveyPayload)
      setLog((prev) => [`Survey created (${created.id})`, ...prev])
      await api.publishSurvey(created.id, {
        pointsPerUser: 500,
        targetCount: 200,
        estimatedReach: 300,
      })
      setLog((prev) => ['Survey published to live feed', ...prev])
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const runResponseFlow = useCallback(async () => {
    setBusy(true)
    setLog((prev) => ['Running end-to-end response flow...', ...prev])
    try {
      const liveSurvey = surveys.find((survey) => survey.status === 'live')
      if (!liveSurvey) {
        throw new Error('Publish a survey first')
      }

      const started = await api.startResponse({ pid: DEMO_PID, surveyId: liveSurvey.id })
      setLog((prev) => [`Response started (${started.id})`, ...prev])

      for (const question of liveSurvey.questions) {
        await wait(120)
        const latencyMs = Math.max(1_500, question.text.length * 90)
        await api.submitAnswer(started.id, {
          questionId: question.id,
          selectedChoiceIds: question.choices ? [question.choices[0].id] : [],
          latencyMs,
        })
      }

      const completion = await api.completeResponse(started.id)
      setLog((prev) => [
        `Reward ${completion.pointsAwarded}P, pet exp ${completion.pet.exp} lv${completion.pet.level}`,
        ...prev,
      ])
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [refresh, surveys])

  return (
    <section className="panel-card">
      <div className="panel-card__head">
        <p className="status-label">Researcher console</p>
        <h2>Survey + Response control room</h2>
      </div>

      <div className="panel-card__actions">
        <button
          type="button"
          className="retry-button"
          onClick={() => void seedSurvey()}
          disabled={busy}
        >
          Seed demo survey
        </button>
        <button
          type="button"
          className="retry-button"
          onClick={() => void runResponseFlow()}
          disabled={busy || feed.length === 0}
        >
          Run panelist response
        </button>
        <button
          type="button"
          className="retry-button"
          onClick={() => void refresh()}
          disabled={busy}
        >
          Refresh data
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="panel-grid">
        <div>
          <h3>Surveys ({surveys.length})</h3>
          <ul className="panel-list">
            {surveys.length === 0 ? (
              <li className="panel-list__empty">No surveys yet — seed one above.</li>
            ) : (
              surveys.map((survey) => (
                <li key={survey.id}>
                  <strong>{survey.title}</strong>
                  <span className={`status-pill is-${survey.status === 'live' ? 'ok' : 'pending'}`}>
                    {survey.status}
                  </span>
                  <small>
                    {survey.category} · {survey.questions.length}Q
                  </small>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h3>Live feed ({feed.length})</h3>
          <ul className="panel-list">
            {feed.length === 0 ? (
              <li className="panel-list__empty">No live surveys.</li>
            ) : (
              feed.map((card) => (
                <li key={card.id}>
                  <strong>{card.title}</strong>
                  <small>
                    {card.pointsPerUser}P · ~{Math.round(card.estimatedTimeSec / 60)}min ·{' '}
                    {card.questionCount}Q
                  </small>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h3>Demo panelist</h3>
          {panelist ? (
            <dl className="panel-dl">
              <div>
                <dt>PID</dt>
                <dd>{panelist.pid}</dd>
              </div>
              <div>
                <dt>Wallet</dt>
                <dd>{panelist.wallet.balance.toLocaleString()} P</dd>
              </div>
              <div>
                <dt>Pet</dt>
                <dd>
                  Lv {panelist.pet.level} · {panelist.pet.exp} EXP
                  {panelist.pet.evolutionStage ? ` · ${panelist.pet.evolutionStage}` : ''}
                  {panelist.pet.sick ? ' · sick' : ''}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="panel-list__empty">Run the response flow to populate stats.</p>
          )}
        </div>
      </div>

      {log.length > 0 ? (
        <div className="panel-log">
          <h4>Activity</h4>
          <ol>
            {log.slice(0, 6).map((entry, index) => (
              <li key={`${index}-${entry}`}>{entry}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}
