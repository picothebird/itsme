import { useCallback, useEffect, useState } from 'react'

import { ResearcherPanel } from './features/ResearcherPanel'
import type { ApiHealth } from './types'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

type HealthState = 'pending' | 'ok' | 'error'

function App() {
  const [health, setHealth] = useState<ApiHealth | null>(null)
  const [healthState, setHealthState] = useState<HealthState>('pending')

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
    return () => {
      isMounted = false
    }
  }, [requestHealth])

  const healthLabel =
    healthState === 'ok'
      ? `Connected · ${health?.service ?? 'api'}`
      : healthState === 'error'
        ? 'API unreachable'
        : 'Checking…'

  const healthPillClass =
    healthState === 'ok' ? 'pill--ok' : healthState === 'error' ? 'pill--err' : 'pill--warn'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__dot" aria-hidden />
          <span>itsme</span>
        </div>
        <nav className="topbar__nav" aria-label="Primary">
          <button type="button" aria-current="page">
            Dashboard
          </button>
          <button type="button" disabled aria-disabled="true" title="곧 출시">
            Surveys
          </button>
          <button type="button" disabled aria-disabled="true" title="곧 출시">
            Panel
          </button>
          <button type="button" disabled aria-disabled="true" title="곧 출시">
            Insights
          </button>
        </nav>
        <div className="topbar__meta">
          <span className={`pill ${healthPillClass}`}>{healthLabel}</span>
        </div>
      </header>

      <main className="page">
        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">itsme · researcher console</p>
            <h1 className="hero__title">설문 한 번에, 인사이트는 더 깊게.</h1>
            <p className="hero__lead">
              잇츠미는 패널의 진짜 응답을 모으는 보상형 리서치 플랫폼입니다. 설문을 설계하고
              발행하면 라이브 피드에서 응답이 쌓이고, 어뷰즈 탐지와 펫 성장 보상이 자동으로
              동작합니다.
            </p>
            <div className="hero__actions">
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => {
                  document
                    .getElementById('workflow')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                워크플로우 시작
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--lg"
                onClick={() => {
                  document
                    .getElementById('feed')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                라이브 피드 보기
              </button>
            </div>
          </div>

          <aside className="hero__metrics" aria-label="System summary">
            <h3>System</h3>
            <div className="metric-row">
              <div className="metric">
                <span className="metric__label">API</span>
                <span className="metric__value">{apiBaseUrl.replace(/^https?:\/\//, '')}</span>
              </div>
              <div className="metric">
                <span className="metric__label">Status</span>
                <span className="metric__value">{health?.status ?? '—'}</span>
              </div>
              <div className="metric">
                <span className="metric__label">Build</span>
                <span className="metric__value">MVP · alpha</span>
              </div>
            </div>
          </aside>
        </section>

        <ResearcherPanel />
      </main>

      <footer className="footer">
        <span>© 2026 itsme · 보상형 리서치 플랫폼</span>
        <span className="footer__health">
          <span className={`health-dot ${healthState === 'ok' ? '' : `is-${healthState}`}`} />
          {healthLabel}
          {health?.timestamp ? ` · ${new Date(health.timestamp).toLocaleTimeString()}` : ''}
        </span>
      </footer>
    </div>
  )
}

export default App
