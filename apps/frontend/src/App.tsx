import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ApiHealth } from './types'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

function App() {
  const [health, setHealth] = useState<ApiHealth | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const requestHealth = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/health`, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`)
    }

    return (await response.json()) as ApiHealth
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadInitial = async () => {
      try {
        const payload = await requestHealth()
        if (!isMounted) {
          return
        }

        setHealth(payload)
        setErrorMessage(null)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Unknown error while checking backend status'
        setErrorMessage(message)
        setHealth(null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadInitial()

    return () => {
      isMounted = false
    }
  }, [requestHealth])

  const fetchHealth = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const payload = await requestHealth()
      setHealth(payload)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while checking backend status'
      setErrorMessage(message)
      setHealth(null)
    } finally {
      setIsLoading(false)
    }
  }, [requestHealth])

  const statusLabel = useMemo(() => {
    if (isLoading) {
      return 'Checking backend status'
    }

    if (errorMessage) {
      return 'Backend unreachable'
    }

    return 'Backend connected'
  }, [errorMessage, isLoading])

  return (
    <main className="shell">
      <section className="hero-card">
        <p className="eyebrow">itsme baseline</p>
        <h1>Full-stack workspace is ready.</h1>
        <p className="lead">
          React frontend and Express backend are wired in one monorepo with lint, formatting, tests,
          commit hooks, and CI.
        </p>

        <div className="stack-grid">
          <article>
            <h2>Frontend</h2>
            <p>React 19 + Vite 8 + TypeScript 6</p>
          </article>
          <article>
            <h2>Backend</h2>
            <p>Express 5 + TypeScript + Zod env validation</p>
          </article>
          <article>
            <h2>Quality</h2>
            <p>ESLint, Prettier, Husky, Commitlint, GitHub Actions</p>
          </article>
        </div>
      </section>

      <section className="status-card">
        <p className="status-label">API health</p>
        <p
          className={`status-pill ${
            errorMessage ? 'is-error' : isLoading ? 'is-pending' : 'is-ok'
          }`}
        >
          {statusLabel}
        </p>

        <dl>
          <div>
            <dt>Base URL</dt>
            <dd>{apiBaseUrl}</dd>
          </div>
          <div>
            <dt>Service</dt>
            <dd>{health?.service ?? '-'}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{health?.status ?? '-'}</dd>
          </div>
          <div>
            <dt>Timestamp</dt>
            <dd>{health?.timestamp ?? '-'}</dd>
          </div>
        </dl>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        <button type="button" className="retry-button" onClick={() => void fetchHealth()}>
          Refresh health check
        </button>
      </section>
    </main>
  )
}

export default App
