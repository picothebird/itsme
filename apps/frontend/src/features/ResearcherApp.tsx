import { useCallback, useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'

import { ResearcherWorkspace } from './ResearcherWorkspace'
import type { ApiHealth } from '../types'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

type HealthState = 'pending' | 'ok' | 'error'

/**
 * Backoffice (researcher) console shell. Fully separated from the responder
 * user app: its own topbar, its own health monitor, no role switching.
 */
export function ResearcherApp() {
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
          <span className="brand__suffix">스튜디오</span>
        </div>

        <div className="topbar__meta">
          <a className="btn btn--ghost btn--sm" href="/" target="_blank" rel="noreferrer">
            응답자 앱 열기
            <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
          </a>
          <span className={`pill ${healthPillClass}`} title={healthLabel}>
            {healthLabel}
          </span>
        </div>
      </header>

      <ResearcherWorkspace />
    </div>
  )
}
