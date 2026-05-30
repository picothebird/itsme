import { useEffect, useRef, useState } from 'react'

import { api, getAuthToken, setAuthToken, type Account } from '../lib/api'
import { PanelistMobile } from './PanelistMobile'

type Props = {
  onClose: () => void
}

type Phase = 'loading' | 'login' | 'onboarding' | 'app'

const PROVIDERS: Array<{
  id: 'kakao' | 'apple' | 'google'
  label: string
  className: string
}> = [
  { id: 'kakao', label: '카카오로 시작하기', className: 'pm-oauth--kakao' },
  { id: 'apple', label: 'Apple로 시작하기', className: 'pm-oauth--apple' },
  { id: 'google', label: 'Google로 시작하기', className: 'pm-oauth--google' },
]

const INTEREST_OPTIONS = [
  '음식',
  'IT·테크',
  '뷰티',
  '운동·건강',
  '금융',
  '여행',
  '패션',
  '게임',
  '교육',
  '반려동물',
]

const currentYear = new Date().getFullYear()

export function PanelistApp({ onClose }: Props) {
  const [phase, setPhase] = useState<Phase>(() => (getAuthToken() ? 'loading' : 'login'))
  const [account, setAccount] = useState<Account | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true
    const token = getAuthToken()
    if (!token) return
    api.auth
      .me()
      .then((data) => {
        setAccount(data.account)
        setPhase(data.account.onboarded ? 'app' : 'onboarding')
      })
      .catch(() => {
        setAuthToken(null)
        setPhase('login')
      })
  }, [])

  const handleLogin = async (provider: 'kakao' | 'apple' | 'google') => {
    setBusy(true)
    setError(null)
    try {
      // MVP: a stable per-device pseudo identity stands in for the real OAuth
      // round-trip. Production swaps this for the provider's id_token.
      const providerUserId = deviceIdentity(provider)
      const res = await api.auth.login({ provider, providerUserId, displayName: '데모 패널' })
      setAuthToken(res.token)
      setAccount(res.account)
      setPhase(res.nextStep === 'onboarding' ? 'onboarding' : 'app')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했어요')
    } finally {
      setBusy(false)
    }
  }

  const handleOnboard = async (input: {
    birthYear: number
    gender: 'male' | 'female' | 'unspecified'
    interests: string[]
  }) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.auth.onboarding(input)
      setAccount(res.account)
      setPhase('app')
    } catch (err) {
      setError(err instanceof Error ? err.message : '온보딩에 실패했어요')
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'app' && account) {
    return <PanelistMobile pid={account.pid} onClose={onClose} />
  }

  return (
    <div className="pm-root" role="dialog" aria-modal="true" aria-label="패널 로그인">
      <header className="pm-topbar">
        <button type="button" className="pm-iconbtn" onClick={onClose} aria-label="닫기">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="pm-topbar__center">
          <span className="pm-topbar__title">잇츠미</span>
        </div>
        <div style={{ width: 44 }} />
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

      {phase === 'loading' ? (
        <main className="pm-stage pm-stage--center">
          <p className="pm-muted">불러오는 중...</p>
        </main>
      ) : null}

      {phase === 'login' ? <LoginStage busy={busy} onLogin={handleLogin} /> : null}

      {phase === 'onboarding' ? <OnboardingStage busy={busy} onSubmit={handleOnboard} /> : null}
    </div>
  )
}

function LoginStage({
  busy,
  onLogin,
}: {
  busy: boolean
  onLogin: (provider: 'kakao' | 'apple' | 'google') => void
}) {
  return (
    <main className="pm-stage pm-login">
      <div className="pm-login__hero">
        <div className="pm-login__egg" aria-hidden>
          <div className="pm-login__egg-shine" />
        </div>
        <h1 className="pm-login__title">
          질문에 답하고
          <br />
          정령을 키워요
        </h1>
        <p className="pm-login__sub">
          간단한 설문으로 포인트를 모으고
          <br />
          나만의 데이터 정령을 진화시켜요.
        </p>
      </div>
      <div className="pm-login__providers">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pm-oauth ${p.className}`}
            onClick={() => onLogin(p.id)}
            disabled={busy}
          >
            {p.label}
          </button>
        ))}
        <p className="pm-login__legal">가입 시 이용약관과 개인정보 처리방침에 동의하게 돼요.</p>
      </div>
    </main>
  )
}

function OnboardingStage({
  busy,
  onSubmit,
}: {
  busy: boolean
  onSubmit: (input: {
    birthYear: number
    gender: 'male' | 'female' | 'unspecified'
    interests: string[]
  }) => void
}) {
  const [step, setStep] = useState(0)
  const [birthYear, setBirthYear] = useState<number | null>(null)
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified' | null>(null)
  const [interests, setInterests] = useState<string[]>([])

  const years = Array.from({ length: 60 }, (_, i) => currentYear - 14 - i)

  const toggleInterest = (label: string) => {
    setInterests((cur) => (cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]))
  }

  const canNext =
    step === 0 ? birthYear !== null : step === 1 ? gender !== null : interests.length > 0

  const next = () => {
    if (step < 2) {
      setStep((s) => s + 1)
      return
    }
    if (birthYear && gender && interests.length > 0) {
      onSubmit({ birthYear, gender, interests })
    }
  }

  return (
    <main className="pm-stage pm-onboard">
      <div className="pm-onboard__progress" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`pm-dot${i <= step ? ' is-active' : ''}`} />
        ))}
      </div>

      {step === 0 ? (
        <section className="pm-onboard__step">
          <h2 className="pm-q__text">태어난 해를 알려주세요</h2>
          <p className="pm-q__hint">맞춤 설문을 추천하는 데 사용돼요.</p>
          <div className="pm-yeargrid">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={`pm-chip${birthYear === y ? ' is-selected' : ''}`}
                onClick={() => setBirthYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="pm-onboard__step">
          <h2 className="pm-q__text">성별을 선택해주세요</h2>
          <div className="pm-choices">
            {(
              [
                { v: 'female', l: '여성' },
                { v: 'male', l: '남성' },
                { v: 'unspecified', l: '선택 안 함' },
              ] as const
            ).map((g) => (
              <button
                key={g.v}
                type="button"
                className={`pm-choice${gender === g.v ? ' is-selected' : ''}`}
                onClick={() => setGender(g.v)}
              >
                <span className="pm-choice__bullet" aria-hidden>
                  {gender === g.v ? (
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  ) : null}
                </span>
                <span className="pm-choice__label">{g.l}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="pm-onboard__step">
          <h2 className="pm-q__text">관심사를 골라주세요</h2>
          <p className="pm-q__hint">정령이 좋아하는 주제가 돼요. (1개 이상)</p>
          <div className="pm-taggrid">
            {INTEREST_OPTIONS.map((label) => (
              <button
                key={label}
                type="button"
                className={`pm-chip pm-chip--lg${interests.includes(label) ? ' is-selected' : ''}`}
                onClick={() => toggleInterest(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="pm-bottom-cta">
        <button
          type="button"
          className="pm-btn pm-btn--primary pm-btn--xl"
          onClick={next}
          disabled={!canNext || busy}
        >
          {step < 2 ? '다음' : busy ? '정령을 깨우는 중...' : '정령 깨우기'}
        </button>
      </div>
    </main>
  )
}

/**
 * Stable per-device identity so re-opening the demo resumes the same account.
 * Real builds replace this with the provider's verified user id.
 */
function deviceIdentity(provider: string): string {
  const key = `itsme.device.${provider}`
  let id = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  if (!id) {
    id = `${provider}_${Math.random().toString(36).slice(2, 10)}`
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, id)
  }
  return id
}
