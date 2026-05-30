import { useCallback, useEffect, useState } from 'react'

import { ResearcherPanel } from './features/ResearcherPanel'
import type { ApiHealth } from './types'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

type HealthState = 'pending' | 'ok' | 'error'

function App() {
  const [health, setHealth] = useState<ApiHealth | null>(null)
  const [healthState, setHealthState] = useState<HealthState>('pending')
  const [activeTab, setActiveTab] = useState<string>('hero')

  useEffect(() => {
    const targets = ['hero', 'dashboard-heading', 'workflow', 'library-heading', 'wallet']
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActiveTab(visible.target.id)
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const tabActive = (ids: string[]) => ids.includes(activeTab)

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

        <section id="hero" className="hero">
          <div className="hero__copy">
            <h1 className="hero__title">
              질문은 한 번,
              <br />
              인사이트는 더 깊이.
            </h1>
            <p className="hero__lead">
              보상형 패널로 수집한 응답을 설계·발행·분석까지 한 흐름으로 연결합니다.
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
                워크플로우 시작하기
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
                진행 중인 설문 보기
              </button>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="서비스 하이라이트">
          <div className="trust-item">
            <span className="trust-item__value">3단계</span>
            <span className="trust-item__label">설계·발행·수집이 한 화면에</span>
          </div>
          <div className="trust-item">
            <span className="trust-item__value">자동</span>
            <span className="trust-item__label">어뷰즈 탐지와 펫 보상까지</span>
          </div>
          <div className="trust-item">
            <span className="trust-item__value">실시간</span>
            <span className="trust-item__label">응답 수집과 완료율 집계</span>
          </div>
          <div className="trust-item">
            <span className="trust-item__value">{health?.status ?? '—'}</span>
            <span className="trust-item__label">
              {apiBaseUrl.replace(/^https?:\/\//, '')} · MVP 알파
            </span>
          </div>
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

      <nav className="bottom-tab" aria-label="하단 메뉴">
        <button
          type="button"
          className={`bottom-tab__btn${tabActive(['hero', 'dashboard-heading']) ? ' is-active' : ''}`}
          onClick={() => jumpTo('dashboard-heading')}
          aria-current={tabActive(['hero', 'dashboard-heading']) ? 'page' : undefined}
        >
          <span className="bottom-tab__icon" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="9" rx="1.5" />
              <rect x="14" y="3" width="7" height="5" rx="1.5" />
              <rect x="14" y="12" width="7" height="9" rx="1.5" />
              <rect x="3" y="16" width="7" height="5" rx="1.5" />
            </svg>
          </span>
          <span className="bottom-tab__label">대시보드</span>
        </button>
        <button
          type="button"
          className={`bottom-tab__btn${activeTab === 'workflow' ? ' is-active' : ''}`}
          onClick={() => jumpTo('workflow')}
          aria-current={activeTab === 'workflow' ? 'page' : undefined}
        >
          <span className="bottom-tab__icon" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="5" cy="6" r="2" />
              <circle cx="19" cy="6" r="2" />
              <circle cx="12" cy="18" r="2" />
              <path d="M7 6h10M6 8l5 8M18 8l-5 8" />
            </svg>
          </span>
          <span className="bottom-tab__label">워크플로우</span>
        </button>
        <button
          type="button"
          className={`bottom-tab__btn${activeTab === 'library-heading' ? ' is-active' : ''}`}
          onClick={() => jumpTo('library-heading')}
          aria-current={activeTab === 'library-heading' ? 'page' : undefined}
        >
          <span className="bottom-tab__icon" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 5h12a3 3 0 013 3v11H7a3 3 0 01-3-3V5z" />
              <path d="M4 5v12a3 3 0 003 3" />
              <path d="M8 9h7M8 13h7" />
            </svg>
          </span>
          <span className="bottom-tab__label">설문</span>
        </button>
        <button
          type="button"
          className={`bottom-tab__btn${activeTab === 'wallet' ? ' is-active' : ''}`}
          onClick={() => jumpTo('wallet')}
          aria-current={activeTab === 'wallet' ? 'page' : undefined}
        >
          <span className="bottom-tab__icon" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="6" width="18" height="13" rx="2.5" />
              <path d="M3 10h18" />
              <circle cx="17" cy="14.5" r="1.2" fill="currentColor" />
            </svg>
          </span>
          <span className="bottom-tab__label">지갑</span>
        </button>
      </nav>
    </div>
  )
}

export default App
