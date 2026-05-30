import { useCallback, useEffect, useState } from 'react'

import { ResearcherPanel } from './features/ResearcherPanel'
import type { ApiHealth } from './types'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

type HealthState = 'pending' | 'ok' | 'error'

function App() {
  const [health, setHealth] = useState<ApiHealth | null>(null)
  const [healthState, setHealthState] = useState<HealthState>('pending')
  const [scrollPct, setScrollPct] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const pct = docHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / docHeight)) : 0
      setScrollPct(pct)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

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
      ? `정상 · ${health?.service ?? 'api'}`
      : healthState === 'error'
        ? '서버 연결 끊김'
        : '연결 확인 중'

  const healthPillClass =
    healthState === 'ok' ? 'pill--ok' : healthState === 'error' ? 'pill--err' : 'pill--warn'

  return (
    <div className="app">
      <div className="scroll-progress" style={{ transform: `scaleX(${scrollPct})` }} aria-hidden />
      <header className="topbar">
        <div className="brand">
          <span className="brand__dot" aria-hidden />
          <span>itsme</span>
        </div>
        <nav className="topbar__nav" aria-label="주요 메뉴">
          <button type="button" aria-current="page">
            대시보드
          </button>
          <button type="button" disabled aria-disabled="true" title="준비 중인 메뉴예요">
            설문
          </button>
          <button type="button" disabled aria-disabled="true" title="준비 중인 메뉴예요">
            패널
          </button>
          <button type="button" disabled aria-disabled="true" title="준비 중인 메뉴예요">
            인사이트
          </button>
        </nav>
        <div className="topbar__meta">
          <span className={`pill ${healthPillClass}`}>{healthLabel}</span>
        </div>
      </header>

      <main className="page">
        <nav className="subnav" aria-label="페이지 내 이동">
          <a href="#dashboard-heading">대시보드</a>
          <a href="#workflow-heading">워크플로우</a>
          <a href="#library-heading">설문 라이브러리</a>
          <a href="#feed">진행 중인 설문</a>
        </nav>

        <section className="hero reveal">
          <div className="hero__copy">
            <p className="eyebrow">잇츠미 · 리서처 콘솔</p>
            <h1 className="hero__title">
              질문은 한 번,
              <br />
              인사이트는 더 깊이.
            </h1>
            <p className="pull-quote">
              진짜 패널이 모이는 보상형 리서치 플랫폼. 설문을 만들어 발행하면 응답이 차곡차곡
              쌓이고, 어뷰즈 탐지부터 펫 보상까지 한 흐름으로 이어집니다.
            </p>
            <div className="hero__actions">
              <div>
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={() => {
                    document
                      .getElementById('workflow')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  워크플로우 시작하기
                </button>
                <span className="microcopy">1분이면 전체 흐름을 둘러볼 수 있어요.</span>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--lg"
                onClick={() => {
                  document
                    .getElementById('feed')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                진행 중인 설문 보기
              </button>
            </div>
          </div>

          <aside className="hero__metrics" aria-label="시스템 상태">
            <h3>시스템</h3>
            <div className="metric-row">
              <div className="metric">
                <span className="metric__label">API 주소</span>
                <span className="metric__value">{apiBaseUrl.replace(/^https?:\/\//, '')}</span>
              </div>
              <div className="metric">
                <span className="metric__label">상태</span>
                <span className="metric__value">{health?.status ?? '—'}</span>
              </div>
              <div className="metric">
                <span className="metric__label">버전</span>
                <span className="metric__value">MVP · 알파</span>
              </div>
            </div>
          </aside>
        </section>

        <ResearcherPanel />
      </main>

      <footer className="footer">
        <div className="footer__brand">
          <div className="footer__brand-row">
            <span className="brand__dot" aria-hidden />
            <span>itsme</span>
          </div>
          <p className="footer__tagline">
            보상형 리서치로 진짜 응답을 모으고, 패널과 함께 성장하는 인사이트 플랫폼.
          </p>
        </div>

        <div className="footer__col">
          <p className="footer__col-title">Product</p>
          <a href="#dashboard-heading">대시보드</a>
          <a href="#workflow-heading">워크플로우</a>
          <a href="#feed">진행 중인 설문</a>
        </div>

        <div className="footer__col">
          <p className="footer__col-title">Resources</p>
          <span>가이드 (준비 중)</span>
          <span>API 문서 (준비 중)</span>
          <span>릴리스 노트 (준비 중)</span>
        </div>

        <div className="footer__col">
          <p className="footer__col-title">Company</p>
          <span>잇츠미 팀</span>
          <span>채용 (준비 중)</span>
          <span>문의</span>
        </div>

        <div className="footer__bottom">
          <span>© 2026 itsme · 보상형 리서치 플랫폼</span>
          <span className="footer__health">
            <span className={`health-dot ${healthState === 'ok' ? '' : `is-${healthState}`}`} />
            {healthLabel}
            {health?.timestamp ? ` · ${new Date(health.timestamp).toLocaleTimeString()}` : ''}
          </span>
        </div>
      </footer>
    </div>
  )
}

export default App
