import { useCallback, useEffect, useState } from 'react'

import { PanelistApp } from './features/PanelistApp'
import { ResearcherWorkspace } from './features/ResearcherWorkspace'
import type { ApiHealth } from './types'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

type HealthState = 'pending' | 'ok' | 'error'

function App() {
  const [health, setHealth] = useState<ApiHealth | null>(null)
  const [healthState, setHealthState] = useState<HealthState>('pending')
  const [responderOpen, setResponderOpen] = useState(false)

  const requestHealth = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/health`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`)
    }
    return (await response.json()) as ApiHealth
  }, [])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const payload = await requestHealth()
        if (!isMounted) return
        setHealth(payload)
        setHealthState('ok')
      } catch {
        if (!isMounted) return
        setHealthState('error')
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 15000)
    return () => {
      isMounted = false
      window.clearInterval(id)
    }
  }, [requestHealth])

  const healthLabel =
    healthState === 'ok'
      ? `정상 · ${health?.service ?? 'api'}`
      : healthState === 'error'
        ? '서버 연결 끊김'
        : '연결 확인 중'

  const healthPillClass =
    healthState === 'ok' ? 'pill--ok' : healthState === 'error' ? 'pill--err' : 'pill--warn'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__dot" aria-hidden />
          <span>itsme</span>
        </div>

        <div className="topbar__role" role="group" aria-label="역할 전환">
          <button type="button" className="role-tab is-active" aria-pressed="true">
            리서처
          </button>
          <button
            type="button"
            className="role-tab"
            aria-pressed="false"
            onClick={() => setResponderOpen(true)}
          >
            응답하기
          </button>
        </div>

        <div className="topbar__meta">
          <button
            type="button"
            className="btn btn--primary btn--sm topbar__try"
            onClick={() => setResponderOpen(true)}
          >
            응답 체험
          </button>
          <span className={`pill ${healthPillClass}`} title={healthLabel}>
            {healthLabel}
          </span>
        </div>
      </header>

      <ResearcherWorkspace />

      {responderOpen ? <PanelistApp onClose={() => setResponderOpen(false)} /> : null}
    </div>
  )
}

export default App
